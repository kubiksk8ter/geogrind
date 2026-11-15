import { describe, expect, it, vi } from "vitest";
import { FakeClock } from "@/test/fakeClock";
import { MemoryStateStore } from "@/test/memoryStateStore";
import type { AiAnswer } from "../ai/aiAnswer";
import { StateUnavailableError } from "../state/types";
import { InMemoryAiFigures } from "./aiFigures";
import { createAiMetricsRecorder } from "./aiMetricsRecorder";

const NO_FIGURE = { remaining: null, limit: null, resetsAt: null };

function answer(overrides: Partial<AiAnswer> = {}): AiAnswer {
  return {
    receivedAt: 1000,
    usage: null,
    limits: { requests: NO_FIGURE, tokens: NO_FIGURE },
    ...overrides,
  };
}

const usage = (
  total: number | null,
  prompt: number | null = null,
  completion: number | null = null,
) => ({ prompt, completion, total });

const withTokens = (remaining: number): AiAnswer["limits"] => ({
  requests: NO_FIGURE,
  tokens: { remaining, limit: 8000, resetsAt: null },
});

function setup() {
  const clock = new FakeClock();
  const store = new MemoryStateStore();
  const figures = new InMemoryAiFigures();
  const log = vi.fn();
  const recorder = createAiMetricsRecorder({ store, figures, clock, log });
  return { clock, store, figures, log, recorder };
}

describe("AI metrics recorder", () => {
  it("AC-4: adds the totals of the day", async () => {
    const { recorder, store } = setup();

    await recorder.record(answer({ usage: usage(150) }));
    await recorder.record(answer({ usage: usage(120) }));

    expect(store.snapshot().daily.tokens).toBe(270);
  });

  it("AC-4: two simultaneous answers are both counted", async () => {
    const { recorder, store } = setup();

    await Promise.all([
      recorder.record(answer({ usage: usage(150) })),
      recorder.record(answer({ usage: usage(120) })),
    ]);

    expect(store.snapshot().daily.tokens).toBe(270);
  });

  it("AC-4: the total starts again after UTC midnight", async () => {
    const { recorder, store, clock } = setup();
    await recorder.record(answer({ usage: usage(150) }));

    clock.advance(24 * 60 * 60 * 1000);
    await recorder.record(answer({ usage: usage(7) }));

    expect(store.snapshot().daily.tokens).toBe(7);
  });

  it("AC-3: adds nothing without a valid total (429, missing, not invented)", async () => {
    const { recorder, store } = setup();

    await recorder.record(answer());
    await recorder.record(answer({ usage: usage(null, 100, 20) }));

    expect(store.snapshot().daily.tokens).toBe(0);
  });

  it("AC-2, AC-3: the last request is the latest answer with usage", async () => {
    const { recorder, figures } = setup();

    await recorder.record(
      answer({ receivedAt: 1000, usage: usage(150, 120, 30) }),
    );
    await recorder.record(answer({ receivedAt: 2000, limits: withTokens(5) }));

    expect(figures.current().lastRequest).toEqual({
      at: 1000,
      prompt: 120,
      completion: 30,
      total: 150,
    });
  });

  it("latest wins by receivedAt even when answers arrive out of order", async () => {
    const { recorder, figures } = setup();

    await recorder.record(answer({ receivedAt: 2000, limits: withTokens(10) }));
    await recorder.record(answer({ receivedAt: 1000, limits: withTokens(99) }));

    expect(figures.current().limits?.tokens.remaining).toBe(10);
  });

  it("AC-12: an answer without limit headers does not wipe good figures", async () => {
    const { recorder, figures } = setup();
    await recorder.record(
      answer({ receivedAt: 1000, limits: withTokens(6000) }),
    );

    await recorder.record(answer({ receivedAt: 2000 }));

    expect(figures.current().limits?.tokens.remaining).toBe(6000);
  });

  it("AC-11: nothing is known before the first answer", () => {
    expect(setup().figures.current()).toEqual({
      lastRequest: null,
      limits: null,
    });
  });

  it("AC-20: a failing store is swallowed and logged as a code only", async () => {
    const { recorder, store, log, figures } = setup();
    vi.spyOn(store, "transact").mockRejectedValue(
      new StateUnavailableError("secret path /data/state.json"),
    );

    await expect(
      recorder.record(answer({ usage: usage(5, 2, 3) })),
    ).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledWith("StateUnavailableError");
    expect(figures.current().lastRequest?.total).toBe(5);
  });
});
