import { describe, expect, it, vi } from "vitest";
import { FakeClock } from "@/test/fakeClock";
import { MemoryStateStore } from "@/test/memoryStateStore";
import { ConfigError } from "../../config/env";
import { StateUnavailableError } from "../../state/types";
import { createCommandMeasurement } from "./commandMeasurement";
import { CommandWindow } from "./commandWindow";

function setup() {
  const clock = new FakeClock();
  const store = new MemoryStateStore();
  const window = new CommandWindow({ clock });
  const log = vi.fn();
  const state = { openStore: () => store };
  const measurement = createCommandMeasurement({
    window,
    openStore: () => state.openStore(),
    clock,
    log,
  });
  return { clock, store, window, log, state, measurement };
}

const entry = {
  result: "success",
  durationMs: 420,
  clientId: "203.0.113.7",
} as const;

describe("command measurement", () => {
  it("AC-2: adds the result to today's counts and to the window", async () => {
    const { measurement, store, window } = setup();

    measurement(entry);
    measurement({ ...entry, result: "not_found" });

    await vi.waitFor(() =>
      expect(store.snapshot().daily.results).toMatchObject({
        success: 1,
        not_found: 1,
      }),
    );
    expect(window.summary().latency).toMatchObject({ count: 2 });
  });

  it("AC-7: the stored figures hold no client address", async () => {
    const { measurement, store } = setup();

    measurement(entry);

    await vi.waitFor(() =>
      expect(store.snapshot().daily.results.success).toBe(1),
    );
    expect(JSON.stringify(store.snapshot())).not.toContain("203.0.113.7");
  });

  it("NFR-6: a failing store is swallowed and logged as a code only; the window still counts", async () => {
    const { measurement, store, window, log } = setup();
    vi.spyOn(store, "transact").mockRejectedValue(
      new StateUnavailableError("secret path /data/state.json"),
    );

    expect(() => measurement(entry)).not.toThrow();

    await vi.waitFor(() =>
      expect(log).toHaveBeenCalledWith("StateUnavailableError"),
    );
    expect(window.summary().load.lastHour).toBe(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain("/data");
  });

  it("NFR-6: a broken configuration is swallowed and logged as a code only", () => {
    const { measurement, state, log } = setup();
    state.openStore = () => {
      throw new ConfigError("Invalid environment variables: X");
    };

    expect(() => measurement(entry)).not.toThrow();
    expect(log).toHaveBeenCalledExactlyOnceWith("Error");
  });
});
