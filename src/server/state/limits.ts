import {
  type Admission,
  admit,
  complete,
  type RateLimitDecision,
  recordHit,
  release,
  type SpentQuota,
} from "./rules";
import type { Clock, StateStore } from "./types";

/** Cooldown, rate limit and daily cap on top of a StateStore and a Clock. */
export class CommandLimits {
  constructor(
    private readonly store: StateStore,
    private readonly clock: Clock,
    private readonly dailyCap: number,
  ) {}

  recordHit(clientId: string): Promise<RateLimitDecision> {
    return this.store.transact((state) =>
      recordHit(state, clientId, this.clock.now()),
    );
  }

  admit(clientId: string): Promise<Admission> {
    return this.store.transact((state) =>
      admit(state, clientId, this.clock.now(), this.dailyCap),
    );
  }

  /** Returns the cooldown the browser must show. */
  complete(clientId: string): Promise<{ cooldownSeconds: number }> {
    return this.store.transact((state) =>
      complete(state, clientId, this.clock.now()),
    );
  }

  release(
    clientId: string,
    spentQuota?: SpentQuota,
  ): Promise<{ aiBlockedUntil?: number }> {
    return this.store.transact((state) =>
      release(state, clientId, this.clock.now(), spentQuota),
    );
  }
}
