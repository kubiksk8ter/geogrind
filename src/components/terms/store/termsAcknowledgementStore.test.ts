import { describe, expect, it } from "vitest";
import { FakeStorage } from "@/test/fakeStorage";
import { termsStore } from "@/test/termsStore";
import { TERMS_VERSION } from "../termsConstants";
import { ACKNOWLEDGEMENT_STORAGE_KEY } from "./termsAcknowledgementStorage";
import { needsTermsNotice } from "./termsAcknowledgementStore";

const noticeNeeded = (storage: Storage, version = TERMS_VERSION) =>
  needsTermsNotice(termsStore(storage, version).getState());

function storageWith(raw: string) {
  const storage = new FakeStorage();
  storage.items.set(ACKNOWLEDGEMENT_STORAGE_KEY, raw);
  return storage;
}

describe("terms acknowledgement store", () => {
  it("FR-7: the first terms version is 2026-11-19", () => {
    expect(TERMS_VERSION).toBe("2026-11-19");
  });

  it("AC-1: with an empty storage the notice is needed", () => {
    expect(noticeNeeded(new FakeStorage())).toBe(true);
  });

  it("AC-2: the acknowledgement is stored and survives a reload", () => {
    const storage = new FakeStorage();
    const store = termsStore(storage);

    store.getState().acknowledge();

    expect(needsTermsNotice(store.getState())).toBe(false);
    expect(noticeNeeded(storage)).toBe(false);
  });

  it("AC-21: the stored value holds the terms version and nothing else", () => {
    const storage = new FakeStorage();

    termsStore(storage).getState().acknowledge();

    expect(
      JSON.parse(storage.items.get(ACKNOWLEDGEMENT_STORAGE_KEY) ?? ""),
    ).toEqual({ state: { acknowledgedVersion: TERMS_VERSION }, version: 1 });
  });

  it("nothing is written before the acknowledgement", () => {
    const storage = new FakeStorage();

    termsStore(storage);

    expect(storage.items.size).toBe(0);
  });

  it.each([
    ["an older", "2025-01-01"],
    ["a newer", "2099-01-01"],
  ])(
    "AC-7: an acknowledgement of %s version shows the notice again",
    (_, stored) => {
      const storage = new FakeStorage();
      termsStore(storage, stored).getState().acknowledge();

      expect(noticeNeeded(storage)).toBe(true);
    },
  );

  it("AC-13: a changed terms version in the code shows the notice to a visitor with the old acknowledgement", () => {
    const storage = new FakeStorage();
    termsStore(storage).getState().acknowledge();

    expect(noticeNeeded(storage, "2027-01-01")).toBe(true);
  });

  it.each([
    ["empty", ""],
    ["not JSON", "{oops"],
    ["of an unknown shape", JSON.stringify({ accepted: true })],
    ["a number", "42"],
    [
      "of another storage version",
      JSON.stringify({
        state: { acknowledgedVersion: TERMS_VERSION },
        version: 2,
      }),
    ],
    [
      "with a wrong type",
      JSON.stringify({ state: { acknowledgedVersion: 20261119 }, version: 1 }),
    ],
  ])(
    "AC-8: a stored value that is %s is ignored and the notice shown",
    (_, raw) => {
      expect(noticeNeeded(storageWith(raw))).toBe(true);
    },
  );

  it("AC-8: unknown extra fields are dropped from the state", () => {
    const store = termsStore(
      storageWith(
        JSON.stringify({
          state: { acknowledgedVersion: TERMS_VERSION, currentVersion: "x" },
          version: 1,
        }),
      ),
    );

    expect(store.getState().currentVersion).toBe(TERMS_VERSION);
    expect(needsTermsNotice(store.getState())).toBe(false);
  });

  it("AC-9: a storage that throws shows the notice, and after the acknowledgement it stays closed for this page view", () => {
    const storage = new FakeStorage();
    storage.throwOnAccess = true;
    const store = termsStore(storage);
    expect(needsTermsNotice(store.getState())).toBe(true);

    expect(() => store.getState().acknowledge()).not.toThrow();

    expect(needsTermsNotice(store.getState())).toBe(false);
    expect(noticeNeeded(storage)).toBe(true);
  });

  it("AC-9: a full storage does not break the acknowledgement", () => {
    const storage = new FakeStorage();
    storage.maxValueLength = 0;
    const store = termsStore(storage);

    expect(() => store.getState().acknowledge()).not.toThrow();

    expect(needsTermsNotice(store.getState())).toBe(false);
    expect(noticeNeeded(storage)).toBe(true);
  });
});
