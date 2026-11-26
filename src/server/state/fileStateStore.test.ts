import { mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { noResults } from "@/shared/metricsContract";
import { FakeClock } from "@/test/fakeClock";
import { FileStateStore } from "./fileStateStore";
import { CommandLimits } from "./limits";
import { addResult, addTokens } from "./rules";
import { type StateData, StateUnavailableError } from "./types";

let directory: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "geogrind-state-"));
});
afterEach(() => rm(directory, { recursive: true, force: true }));

const increment = (state: StateData) => ({
  next: { ...state, daily: { ...state.daily, count: state.daily.count + 1 } },
  result: state.daily.count + 1,
});

const NOW = Date.UTC(2026, 10, 9, 12);
const addOneToken = (state: StateData) => addTokens(state, 1, NOW);

describe("FileStateStore tokens and read", () => {
  it("AC-21: a file written before tokens existed stays valid and reads 0", async () => {
    await writeFile(
      join(directory, "state.json"),
      JSON.stringify({
        version: 1,
        daily: { day: "2026-11-09", count: 3 },
        clients: {},
      }),
    );
    const store = new FileStateStore(directory);

    expect((await store.read()).daily).toEqual({
      day: "2026-11-09",
      count: 3,
      tokens: 0,
      results: noResults(),
    });
  });

  it("AC-4: parallel additions neither lose nor double count tokens", async () => {
    const store = new FileStateStore(directory);

    await Promise.all(
      Array.from({ length: 25 }, () => store.transact(addOneToken)),
    );

    expect((await store.read()).daily.tokens).toBe(25);
  });

  it("AC-21: the day's tokens survive a restart", async () => {
    await new FileStateStore(directory).transact((state) =>
      addTokens(state, 150, NOW),
    );

    const afterRestart = new FileStateStore(directory);

    expect((await afterRestart.read()).daily.tokens).toBe(150);
  });

  it("read starts from an empty state when there is no file and writes nothing", async () => {
    const store = new FileStateStore(join(directory, "missing"));

    expect((await store.read()).daily.tokens).toBe(0);
    await expect(
      readFile(join(directory, "missing", "state.json")),
    ).rejects.toThrow();
  });

  it("AC-13: reads while writers are busy always see a complete state", async () => {
    const store = new FileStateStore(directory);
    await store.transact(addOneToken);

    const writes = Array.from({ length: 30 }, () =>
      store.transact(addOneToken),
    );
    const reads = Array.from({ length: 30 }, () => store.read());
    const seen = (await Promise.all(reads)).map((state) => state.daily.tokens);
    await Promise.all(writes);

    expect(seen.every((tokens) => tokens >= 1 && tokens <= 31)).toBe(true);
    expect((await store.read()).daily.tokens).toBe(31);
  });

  it("AC-14: a corrupt file makes read fail safe", async () => {
    await writeFile(join(directory, "state.json"), "{ nope");

    await expect(new FileStateStore(directory).read()).rejects.toBeInstanceOf(
      StateUnavailableError,
    );
  });
});

describe("FileStateStore results of the day", () => {
  const addSuccess = (state: StateData) => addResult(state, "success", NOW);

  it("a file written before results existed stays valid and reads zeros", async () => {
    await writeFile(
      join(directory, "state.json"),
      JSON.stringify({
        version: 1,
        daily: { day: "2026-11-09", count: 3, tokens: 270 },
        clients: {},
      }),
    );

    expect((await new FileStateStore(directory).read()).daily.results).toEqual(
      noResults(),
    );
  });

  it("AC-19: the day's results survive a restart", async () => {
    const before = new FileStateStore(directory);
    await before.transact(addSuccess);
    await before.transact((state) => addResult(state, "not_found", NOW));

    const afterRestart = new FileStateStore(directory);

    expect((await afterRestart.read()).daily.results).toEqual({
      ...noResults(),
      success: 1,
      not_found: 1,
    });
  });
});

describe("FileStateStore", () => {
  it("AC-29: parallel transactions do not lose updates", async () => {
    const store = new FileStateStore(directory);

    const results = await Promise.all(
      Array.from({ length: 25 }, () => store.transact(increment)),
    );

    expect([...results].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 25 }, (_, index) => index + 1),
    );
  });

  it("AC-29: an active cooldown survives a restart", async () => {
    const clock = new FakeClock();
    const before = new CommandLimits(new FileStateStore(directory), clock, 500);
    await before.admit("203.0.113.7");
    await before.complete("203.0.113.7");
    clock.advance(4_000);

    const afterRestart = new CommandLimits(
      new FileStateStore(directory),
      clock,
      500,
    );

    expect(await afterRestart.admit("203.0.113.7")).toEqual({
      kind: "wait",
      retryAfterSeconds: 6,
    });
  });

  it.each([
    ["not JSON", "{ nope"],
    ["an unexpected shape", JSON.stringify({ version: 2 })],
    [
      "extra fields",
      JSON.stringify({
        version: 1,
        daily: { day: "", count: 0 },
        clients: {},
        x: 1,
      }),
    ],
    ["an empty file", ""],
  ])(
    "AC-29: a corrupt state file (%s) fails safe and is not overwritten",
    async (_name, content) => {
      await writeFile(join(directory, "state.json"), content);
      const store = new FileStateStore(directory);

      await expect(store.transact(increment)).rejects.toBeInstanceOf(
        StateUnavailableError,
      );
      expect(await readFile(join(directory, "state.json"), "utf8")).toBe(
        content,
      );
    },
  );

  it("AC-29: an unwritable location fails safe", async () => {
    const blocker = join(directory, "file");
    await writeFile(blocker, "");
    const store = new FileStateStore(join(blocker, "data"));

    await expect(store.transact(increment)).rejects.toBeInstanceOf(
      StateUnavailableError,
    );
  });

  it("fails safe when the lock stays taken", async () => {
    await writeFile(join(directory, "state.lock"), "other");
    const store = new FileStateStore(directory, {
      lockTimeoutMs: 100,
      lockRetryMs: 10,
    });

    await expect(store.transact(increment)).rejects.toBeInstanceOf(
      StateUnavailableError,
    );
  });

  it("takes over a stale lock left by a crashed process", async () => {
    const lock = join(directory, "state.lock");
    await writeFile(lock, "crashed");
    const longAgo = new Date(Date.now() - 60_000);
    await utimes(lock, longAgo, longAgo);
    const store = new FileStateStore(directory, {
      lockTimeoutMs: 1_000,
      lockStaleMs: 10_000,
      lockRetryMs: 10,
    });

    expect(await store.transact(increment)).toBe(1);
  });
});
