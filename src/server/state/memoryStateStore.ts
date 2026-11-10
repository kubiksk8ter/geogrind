import { EMPTY_STATE, type StateData, type StateStore } from "./types";

/** In-memory store for tests. */
export class MemoryStateStore implements StateStore {
  constructor(private state: StateData = EMPTY_STATE) {}

  async transact<T>(
    fn: (state: StateData) => { next: StateData; result: T },
  ): Promise<T> {
    const { next, result } = fn(this.state);
    this.state = next;
    return result;
  }

  snapshot(): StateData {
    return this.state;
  }
}
