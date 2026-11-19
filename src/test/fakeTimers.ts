import type { SweeperTimers } from "@/server/privacy/keyExpirySweeper";

interface PendingTimer {
  fn: () => void;
  ms: number;
}

/** Timers that only run when a test fires them. */
export class FakeTimers implements SweeperTimers {
  private readonly pending = new Map<number, PendingTimer>();
  private nextId = 1;

  set(fn: () => void, ms: number): number {
    const id = this.nextId++;
    this.pending.set(id, { fn, ms });
    return id;
  }

  clear(handle: unknown): void {
    if (typeof handle === "number") this.pending.delete(handle);
  }

  /** Delays of the timers that have not fired yet. */
  delays(): number[] {
    return [...this.pending.values()].map(({ ms }) => ms);
  }

  /**
   * Runs every pending timer once, in the order they were set. Timers they set stay pending;
   * timers they clear do not run, as with real timers.
   */
  fireAll(): void {
    const due = [...this.pending.entries()];
    for (const [id, { fn }] of due) {
      if (!this.pending.delete(id)) continue;
      fn();
    }
  }
}
