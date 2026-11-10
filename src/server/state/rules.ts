import type { StateData } from "./types";

export const RATE_LIMIT_MAX = 10;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const COOLDOWN_MS = 10_000;
/** Time one request may take on the server; the browser gives up slightly later (10 s). */
export const REQUEST_BUDGET_MS = 9_000;

export type RateLimitDecision =
  | { kind: "allowed" }
  | { kind: "limited"; retryAfterSeconds: number };

export type Admission =
  | { kind: "admitted" }
  | { kind: "wait"; retryAfterSeconds: number }
  | { kind: "busy"; retryAfterSeconds: number }
  | { kind: "ai_resting"; resetAt: number };

export interface SpentQuota {
  retryAfterSeconds?: number;
}

type ClientState = StateData["clients"][string];
type Transition<T> = { next: StateData; result: T };

const secondsUntil = (target: number, now: number) =>
  Math.max(1, Math.ceil((target - now) / 1000));

const dayOf = (now: number) => new Date(now).toISOString().slice(0, 10);

export function nextUtcMidnight(now: number): number {
  const date = new Date(now);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
  );
}

function liveClient(client: ClientState, now: number): ClientState | null {
  const hits = client.hits.filter((hit) => hit > now - RATE_LIMIT_WINDOW_MS);
  const { cooldownUntil, inflightUntil } = client;
  const live: ClientState = {
    hits,
    ...(cooldownUntil !== undefined &&
      cooldownUntil > now && { cooldownUntil }),
    ...(inflightUntil !== undefined &&
      inflightUntil > now && { inflightUntil }),
  };
  const hasState =
    hits.length > 0 ||
    live.cooldownUntil !== undefined ||
    live.inflightUntil !== undefined;
  return hasState ? live : null;
}

/** Drops everything that expired, so IPs and counters live no longer than the limits need. */
export function pruneState(state: StateData, now: number): StateData {
  const today = dayOf(now);
  const clients: StateData["clients"] = {};
  for (const [id, client] of Object.entries(state.clients)) {
    const live = liveClient(client, now);
    if (live) clients[id] = live;
  }
  const { aiBlockedUntil } = state;
  return {
    version: 1,
    daily: state.daily.day === today ? state.daily : { day: today, count: 0 },
    ...(aiBlockedUntil !== undefined &&
      aiBlockedUntil > now && { aiBlockedUntil }),
    clients,
  };
}

function withClient(
  state: StateData,
  clientId: string,
  change: (client: ClientState) => ClientState,
): StateData {
  const current = state.clients[clientId] ?? { hits: [] };
  return {
    ...state,
    clients: { ...state.clients, [clientId]: change(current) },
  };
}

/** Counts a request that passed the guard; a refused request is not counted again. */
export function recordHit(
  state: StateData,
  clientId: string,
  now: number,
): Transition<RateLimitDecision> {
  const pruned = pruneState(state, now);
  const hits = pruned.clients[clientId]?.hits ?? [];
  const oldest = hits[0];
  if (hits.length >= RATE_LIMIT_MAX && oldest !== undefined) {
    return {
      next: pruned,
      result: {
        kind: "limited",
        retryAfterSeconds: secondsUntil(oldest + RATE_LIMIT_WINDOW_MS, now),
      },
    };
  }
  return {
    next: withClient(pruned, clientId, (client) => ({
      ...client,
      hits: [...client.hits, now],
    })),
    result: { kind: "allowed" },
  };
}

/** Decides whether the AI may be called; admitting counts the daily cap and marks the request. */
export function admit(
  state: StateData,
  clientId: string,
  now: number,
  dailyCap: number,
): Transition<Admission> {
  const pruned = pruneState(state, now);
  const client = pruned.clients[clientId];

  if (client?.cooldownUntil !== undefined) {
    return {
      next: pruned,
      result: {
        kind: "wait",
        retryAfterSeconds: secondsUntil(client.cooldownUntil, now),
      },
    };
  }
  if (client?.inflightUntil !== undefined) {
    return {
      next: pruned,
      result: {
        kind: "busy",
        retryAfterSeconds: secondsUntil(client.inflightUntil, now),
      },
    };
  }
  if (pruned.aiBlockedUntil !== undefined) {
    return {
      next: pruned,
      result: { kind: "ai_resting", resetAt: pruned.aiBlockedUntil },
    };
  }
  if (pruned.daily.count >= dailyCap) {
    return {
      next: pruned,
      result: { kind: "ai_resting", resetAt: nextUtcMidnight(now) },
    };
  }

  const counted: StateData = {
    ...pruned,
    daily: { ...pruned.daily, count: pruned.daily.count + 1 },
  };
  return {
    next: withClient(counted, clientId, (current) => ({
      ...current,
      inflightUntil: now + REQUEST_BUDGET_MS,
    })),
    result: { kind: "admitted" },
  };
}

function clearInflight(client: ClientState): ClientState {
  const { inflightUntil: _ended, ...rest } = client;
  return rest;
}

/** An admitted command that was processed, however it ended, starts the cooldown and ends the in-flight mark. */
export function complete(
  state: StateData,
  clientId: string,
  now: number,
): Transition<{ cooldownSeconds: number }> {
  return {
    next: withClient(pruneState(state, now), clientId, (client) => ({
      ...clearInflight(client),
      cooldownUntil: now + COOLDOWN_MS,
    })),
    result: { cooldownSeconds: COOLDOWN_MS / 1000 },
  };
}

/** Ends the in-flight mark without a cooldown; a spent AI quota additionally blocks the AI. */
export function release(
  state: StateData,
  clientId: string,
  now: number,
  spentQuota?: SpentQuota,
): Transition<{ aiBlockedUntil?: number }> {
  const pruned = pruneState(state, now);
  const released = pruned.clients[clientId]
    ? withClient(pruned, clientId, clearInflight)
    : pruned;
  if (!spentQuota) return { next: released, result: {} };

  const midnight = nextUtcMidnight(now);
  const requested =
    spentQuota.retryAfterSeconds === undefined
      ? midnight
      : now + spentQuota.retryAfterSeconds * 1000;
  const aiBlockedUntil = Math.min(requested, midnight);
  return { next: { ...released, aiBlockedUntil }, result: { aiBlockedUntil } };
}
