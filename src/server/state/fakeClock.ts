import type { Clock } from "./types";

/** Manually advanced clock for tests. */
export class FakeClock implements Clock {
  constructor(private current = Date.UTC(2026, 10, 9, 12, 0, 0)) {}

  now(): number {
    return this.current;
  }

  advance(milliseconds: number): void {
    this.current += milliseconds;
  }

  set(epochMilliseconds: number): void {
    this.current = epochMilliseconds;
  }
}
