import { describe, expect, it } from "vitest";
import { noResults } from "@/shared/metricsContract";
import type { StateData } from "../state/types";
import { formatPseudonym, keyIdOf, purgeForeignClients } from "./pseudonym";

const LIVE = "liveKey0";
const OLD = "oldKey00";
const live = formatPseudonym(LIVE, "abcdefghijklmnop");
const old = formatPseudonym(OLD, "abcdefghijklmnop");
const record = { hits: [1] };

function stateWith(ids: string[]): StateData {
  return {
    version: 1,
    daily: { day: "2026-11-09", count: 4, tokens: 99, results: noResults() },
    aiBlockedUntil: 5,
    clients: Object.fromEntries(ids.map((id) => [id, record])),
  };
}

describe("keyIdOf", () => {
  it("reads the key period of a pseudonym", () => {
    expect(keyIdOf(live)).toBe(LIVE);
  });

  it.each([
    "203.0.113.7",
    "2001:0db8:0000:0000::/64",
    "",
    "liveKey0~short",
    `${live}x`,
    "live/ey0~abcdefghijklmnop",
  ])("AC-12: %j is not a pseudonym", (id) => {
    expect(keyIdOf(id)).toBeNull();
  });
});

describe("purgeForeignClients", () => {
  it("AC-11: keeps the records of the live key and drops those of another key", () => {
    const purged = purgeForeignClients(stateWith([live, old]), LIVE);

    expect(Object.keys(purged.clients)).toEqual([live]);
  });

  it("AC-12: drops raw IPv4 and IPv6 ids of earlier versions", () => {
    const purged = purgeForeignClients(
      stateWith(["203.0.113.7", "2001:0db8:0000:0000::/64", live]),
      LIVE,
    );

    expect(Object.keys(purged.clients)).toEqual([live]);
  });

  it("AC-11: without a live key every client record is dropped", () => {
    expect(purgeForeignClients(stateWith([live, old]), null).clients).toEqual(
      {},
    );
  });

  it("AC-10: the daily cap, tokens, results and the AI block are untouched", () => {
    const state = stateWith([old, "203.0.113.7"]);

    const { clients: _dropped, ...rest } = purgeForeignClients(state, LIVE);
    const { clients: _original, ...expected } = state;

    expect(rest).toEqual(expected);
  });
});
