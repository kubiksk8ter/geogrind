import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { noResults } from "@/shared/metricsContract";
import { FakeClock } from "@/test/fakeClock";
import { createFakeRandomBytes } from "@/test/fakeRandomBytes";
import { FileStateStore } from "../state/fileStateStore";
import { CommandLimits } from "../state/limits";
import { addResult, addTokens, RATE_LIMIT_MAX } from "../state/rules";
import { createClientKeyring } from "./clientKeyring";
import { ClientScopedStateStore } from "./clientScopedStateStore";
import { keyIdOf } from "./pseudonym";

const IPV4 = "203.0.113.7";
const IPV6_PREFIX = "2001:0db8:0000:0000::/64";
const DAILY_CAP = 100;
const MIDNIGHT = Date.UTC(2026, 10, 10);

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "geogrind-privacy-"));
});
afterEach(() => rm(directory, { recursive: true, force: true }));

const stateFile = () => join(directory, "state.json");
const fileText = () => readFile(stateFile(), "utf8");
/** The client ids as they are on disk, read past the decorator. */
const fileClients = async () =>
  Object.keys((await new FileStateStore(directory).read()).clients);

/** One server process: its own keyring over the shared state folder. */
function startServer(clock: FakeClock, seed: number) {
  const random = createFakeRandomBytes(seed);
  const keyring = createClientKeyring({
    clock,
    randomBytes: random.randomBytes,
  });
  const store = new ClientScopedStateStore(new FileStateStore(directory), () =>
    keyring.validKeyId(),
  );
  const limits = new CommandLimits(store, clock, DAILY_CAP);
  return { keyring, store, limits, random };
}

async function writeLegacyFile(clock: FakeClock) {
  const now = clock.now();
  const hits = Array.from({ length: RATE_LIMIT_MAX }, () => now - 1_000);
  await writeFile(
    stateFile(),
    JSON.stringify({
      version: 1,
      daily: {
        day: "2026-11-09",
        count: 7,
        tokens: 1234,
        results: noResults(),
      },
      clients: {
        [IPV4]: { hits, cooldownUntil: now + 5_000 },
        [IPV6_PREFIX]: { hits, inflightUntil: now + 5_000 },
      },
    }),
  );
}

describe("ClientScopedStateStore with a legacy state file", () => {
  it("AC-12: raw ids of an earlier version are gone after the first request", async () => {
    const clock = new FakeClock();
    await writeLegacyFile(clock);
    const { keyring, limits } = startServer(clock, 1);

    await limits.recordHit(keyring.pseudonymize(IPV4));

    const text = await fileText();
    expect(text).not.toContain(IPV4);
    expect(text).not.toContain("2001");
    expect(await fileClients()).toEqual([keyring.pseudonymize(IPV4)]);
  });

  it("AC-12: a raw id at the limit and in cooldown is never matched to the client", async () => {
    const clock = new FakeClock();
    await writeLegacyFile(clock);
    const { keyring, limits } = startServer(clock, 1);
    const client = keyring.pseudonymize(IPV4);

    expect(await limits.recordHit(client)).toEqual({ kind: "allowed" });
    expect(await limits.admit(client)).toEqual({ kind: "admitted" });
  });

  it("AC-10: the daily cap counter and the tokens survive the purge", async () => {
    const clock = new FakeClock();
    await writeLegacyFile(clock);
    const { store } = startServer(clock, 1);

    await store.transact((state) => addResult(state, "success", clock.now()));

    expect((await store.read()).daily).toMatchObject({
      count: 7,
      tokens: 1234,
    });
  });
});

describe("ClientScopedStateStore across keys", () => {
  it("AC-11: records of the expired key are removed by the next write after midnight", async () => {
    const clock = new FakeClock(MIDNIGHT - 2_000);
    const { keyring, limits, store } = startServer(clock, 1);
    const before = keyring.pseudonymize(IPV4);
    await limits.recordHit(before);
    await limits.admit(before);

    clock.set(MIDNIGHT);
    await store.transact((state) => addTokens(state, 5, clock.now()));

    expect(await fileClients()).toEqual([]);
    const after = keyring.pseudonymize(IPV4);
    await limits.recordHit(after);
    expect(await fileClients()).toEqual([after]);
    expect(keyIdOf(after)).not.toBe(keyIdOf(before));
  });

  it("AC-6, AC-11: records of a previous process are removed by the first write after a restart", async () => {
    const clock = new FakeClock();
    const first = startServer(clock, 1);
    const beforeRestart = first.keyring.pseudonymize(IPV4);
    await first.limits.recordHit(beforeRestart);

    const second = startServer(clock, 2);
    const afterRestart = second.keyring.pseudonymize(IPV4);
    await second.limits.recordHit(afterRestart);

    expect(afterRestart).not.toBe(beforeRestart);
    expect(await fileClients()).toEqual([afterRestart]);
  });

  it("FR-6: a request that straddles midnight is purged at once and the client starts fresh", async () => {
    const clock = new FakeClock(MIDNIGHT - 1);
    const { keyring, limits } = startServer(clock, 1);
    const straddling = keyring.pseudonymize(IPV4);

    clock.set(MIDNIGHT);
    await limits.recordHit(straddling);

    expect(await fileClients()).toEqual([]);
  });

  it("read() hides records of other keys without writing the file", async () => {
    const clock = new FakeClock();
    await writeLegacyFile(clock);
    const original = await fileText();
    const { store } = startServer(clock, 1);

    expect((await store.read()).clients).toEqual({});
    expect(await fileText()).toBe(original);
  });

  it("read() keeps the records of the live key, so in-progress commands are counted", async () => {
    const clock = new FakeClock();
    const { keyring, limits, store } = startServer(clock, 1);
    const client = keyring.pseudonymize(IPV4);
    await limits.recordHit(client);
    await limits.admit(client);

    expect(Object.keys((await store.read()).clients)).toEqual([client]);
  });
});

describe("ClientScopedStateStore privacy", () => {
  it("AC-1, AC-5: the file holds pseudonyms only, never an IP or the key", async () => {
    const clock = new FakeClock();
    const { keyring, limits, random } = startServer(clock, 1);
    for (const id of [IPV4, IPV6_PREFIX]) {
      await limits.recordHit(keyring.pseudonymize(id));
    }

    const text = await fileText();
    const [key = new Uint8Array()] = random.calls;
    for (const encoding of ["hex", "base64", "base64url"] as const) {
      expect(text).not.toContain(Buffer.from(key).toString(encoding));
    }
    expect(text).not.toContain(IPV4);
    expect(text).not.toContain("2001");
    expect((await fileClients()).every((id) => keyIdOf(id) !== null)).toBe(
      true,
    );
    expect(await readdir(directory)).toEqual(["state.json"]);
  });
});
