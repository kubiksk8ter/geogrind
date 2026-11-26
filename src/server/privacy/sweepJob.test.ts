import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { noResults } from "@/shared/metricsContract";
import { FakeClock } from "@/test/fakeClock";
import { createFakeRandomBytes } from "@/test/fakeRandomBytes";
import { FakeTimers } from "@/test/fakeTimers";
import type { AppEnv } from "../config/env";
import { FileStateStore } from "../state/fileStateStore";
import { CommandLimits } from "../state/limits";
import { createClientKeyring } from "./clientKeyring";
import { ClientScopedStateStore } from "./clientScopedStateStore";
import {
  createKeyExpirySweeper,
  type KeyExpirySweeper,
} from "./keyExpirySweeper";
import { createSweepJob } from "./sweepJob";

const IPV4 = "203.0.113.7";
const MIDNIGHT = Date.UTC(2026, 10, 10);

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "geogrind-sweep-"));
});
afterEach(() => rm(directory, { recursive: true, force: true }));

const stateFile = () => join(directory, "state.json");
const fileClients = async () =>
  Object.keys((await new FileStateStore(directory).read()).clients);

function envFor(stateDir: string): AppEnv {
  return {
    groqApiKey: "gsk_test_key_not_real",
    groqModel: "test-model",
    geocoderUrl: "https://geo.test",
    geocoderContact: undefined,
    clientIpHeader: undefined,
    appOrigins: ["http://localhost:3000"],
    stateDir,
    dailyCap: 100,
  };
}

/** One server process wired like `privacy/shared`, but with fakes for time, randomness and timers. */
function startServer(
  clock: FakeClock,
  loadEnv: () => AppEnv = () => envFor(directory),
) {
  const timers = new FakeTimers();
  const random = createFakeRandomBytes();
  const log = vi.fn<(code: string) => void>();
  let sweeper: KeyExpirySweeper | undefined;
  const keyring = createClientKeyring({
    clock,
    randomBytes: random.randomBytes,
    onKeyCreated: (expiresAt) => sweeper?.arm(expiresAt),
  });
  sweeper = createKeyExpirySweeper({
    clock,
    keyring,
    sweep: createSweepJob({ clock, keyring, loadEnv }),
    log,
    timers,
  });
  const store = new ClientScopedStateStore(new FileStateStore(directory), () =>
    keyring.validKeyId(),
  );
  const limits = new CommandLimits(store, clock, 100);
  return { keyring, sweeper, timers, random, log, limits };
}

async function writeLegacyFile(now: number) {
  await writeFile(
    stateFile(),
    JSON.stringify({
      version: 1,
      daily: { day: "2026-11-09", count: 3, tokens: 50, results: noResults() },
      clients: {
        [IPV4]: { hits: [now - 1_000], cooldownUntil: now + 5_000 },
        "Abcdefgh~abcdefghijklmnop": { hits: [now - 1_000] },
      },
    }),
  );
}

describe("boot sweep", () => {
  it("AC-12: cleans raw ids and old pseudonyms from the file before any request", async () => {
    const clock = new FakeClock();
    await writeLegacyFile(clock.now());
    const { sweeper, random } = startServer(clock);

    await sweeper.sweepNow();

    expect(await fileClients()).toEqual([]);
    expect(await readFile(stateFile(), "utf8")).not.toContain(IPV4);
    expect((await new FileStateStore(directory).read()).daily).toMatchObject({
      count: 3,
      tokens: 50,
    });
    expect(random.calls).toHaveLength(0);
  });
});

describe("expiry sweep on an idle server", () => {
  it("AC-5, AC-11: at midnight the timer destroys the key and empties the client records", async () => {
    const clock = new FakeClock();
    const { keyring, limits, timers, random } = startServer(clock);
    await limits.recordHit(keyring.pseudonymize(IPV4));
    expect(timers.delays()).toEqual([MIDNIGHT - clock.now()]);

    clock.set(MIDNIGHT);
    timers.fireAll();

    await vi.waitFor(async () => expect(await fileClients()).toEqual([]));
    expect(random.calls[0]?.every((byte) => byte === 0)).toBe(true);
    expect(keyring.validKeyId()).toBeNull();
    // The sweep never creates a key: only the first key and its keyId were drawn.
    expect(random.calls).toHaveLength(2);
    expect(timers.delays()).toEqual([]);
  });
});
