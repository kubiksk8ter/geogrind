import { mkdtemp, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeClock } from "./fakeClock";
import { FileStateStore } from "./fileStateStore";
import { CommandLimits } from "./limits";
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

describe("FileStateStore", () => {
  it("starts from an empty state when there is no file", async () => {
    const store = new FileStateStore(directory);

    expect(
      await store.transact((state) => ({ next: state, result: state })),
    ).toMatchObject({ version: 1, clients: {} });
  });

  it("creates the directory when it is missing", async () => {
    const store = new FileStateStore(join(directory, "nested", "data"));

    expect(await store.transact(increment)).toBe(1);
  });

  it("AC-29: parallel transactions do not lose updates", async () => {
    const store = new FileStateStore(directory);

    const results = await Promise.all(
      Array.from({ length: 25 }, () => store.transact(increment)),
    );

    expect([...results].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 25 }, (_, index) => index + 1),
    );
  });

  it("AC-29: two instances on one directory also serialise", async () => {
    const stores = [
      new FileStateStore(directory),
      new FileStateStore(directory),
    ];

    await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        stores[index % 2]?.transact(increment),
      ),
    );

    expect(await stores[0]?.transact(increment)).toBe(21);
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

  it("releases the lock after a transaction, even a failing one", async () => {
    const store = new FileStateStore(directory, { lockTimeoutMs: 200 });
    await expect(
      store.transact(() => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(await store.transact(increment)).toBe(1);
  });

  it("leaves no temporary file behind", async () => {
    const store = new FileStateStore(directory);
    await store.transact(increment);

    expect(await readFile(join(directory, "state.json"), "utf8")).toContain(
      '"count":1',
    );
    await expect(
      readFile(join(directory, `state.json.${process.pid}.tmp`)),
    ).rejects.toThrow();
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
