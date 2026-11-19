import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { FakeClock } from "@/test/fakeClock";
import { createFakeRandomBytes } from "@/test/fakeRandomBytes";
import { createClientKeyring, KEY_BYTES } from "./clientKeyring";
import { keyIdOf } from "./pseudonym";

const IPV4 = "203.0.113.7";
const IPV6_PREFIX = "2001:0db8:0000:0000::/64";
const MIDNIGHT = Date.UTC(2026, 10, 10);
const DAY_MS = 24 * 60 * 60_000;
const PSEUDONYM = /^[A-Za-z0-9_-]{8}~[A-Za-z0-9_-]{16}$/;

function setup(seed = 1) {
  const clock = new FakeClock();
  const random = createFakeRandomBytes(seed);
  const onKeyCreated = vi.fn<(expiresAt: number) => void>();
  const keyring = createClientKeyring({
    clock,
    randomBytes: random.randomBytes,
    onKeyCreated,
  });
  return { clock, random, onKeyCreated, keyring };
}

describe("ClientKeyring pseudonyms", () => {
  it("AC-3: the same id gives the same pseudonym while the key is valid", () => {
    const { keyring, clock } = setup();

    const first = keyring.pseudonymize(IPV4);
    clock.advance(60_000);

    expect(keyring.pseudonymize(IPV4)).toBe(first);
    expect(first).toMatch(PSEUDONYM);
  });

  it("AC-3: different ids give different pseudonyms", () => {
    const { keyring } = setup();

    expect(keyring.pseudonymize(IPV4)).not.toBe(
      keyring.pseudonymize("203.0.113.8"),
    );
    expect(keyring.pseudonymize(IPV6_PREFIX)).toMatch(PSEUDONYM);
  });

  it("AC-1: the pseudonym contains neither the IPv4 address nor the IPv6 prefix", () => {
    const { keyring } = setup();

    expect(keyring.pseudonymize(IPV4)).not.toContain(IPV4);
    expect(keyring.pseudonymize(IPV6_PREFIX)).not.toContain("2001");
  });

  it("AC-4: the pseudonym cannot be reproduced by a plain SHA-256 of the id", () => {
    const { keyring } = setup();
    const [, digest = ""] = keyring.pseudonymize(IPV4).split("~");
    const plain = createHash("sha256").update(IPV4);
    const encodings = [plain.copy().digest("base64url"), plain.digest("hex")];

    for (const encoded of encodings) {
      expect(encoded).not.toContain(digest);
    }
  });

  it("uses node:crypto randomness by default", () => {
    const keyring = createClientKeyring({ clock: new FakeClock() });

    expect(keyring.pseudonymize(IPV4)).toMatch(PSEUDONYM);
  });
});

describe("ClientKeyring rotation", () => {
  it("AC-7: just before UTC midnight the old pseudonym is used, at midnight a new one", () => {
    const { keyring, clock } = setup();
    const before = keyring.pseudonymize(IPV4);

    clock.set(MIDNIGHT - 1);
    expect(keyring.pseudonymize(IPV4)).toBe(before);

    clock.set(MIDNIGHT);
    const after = keyring.pseudonymize(IPV4);
    expect(after).not.toBe(before);
    expect(keyIdOf(after)).not.toBe(keyIdOf(before));
  });

  it("AC-7: a key created at midnight lives 24 h and not a millisecond longer", () => {
    const { keyring, clock, onKeyCreated } = setup();
    clock.set(MIDNIGHT);
    const first = keyring.pseudonymize(IPV4);

    clock.set(MIDNIGHT + DAY_MS - 1);
    expect(keyring.pseudonymize(IPV4)).toBe(first);
    clock.set(MIDNIGHT + DAY_MS);
    expect(keyring.pseudonymize(IPV4)).not.toBe(first);
    expect(onKeyCreated.mock.calls).toEqual([
      [MIDNIGHT + DAY_MS],
      [MIDNIGHT + 2 * DAY_MS],
    ]);
  });

  it("AC-7: a key created after a restart late in the day ends at the next midnight", () => {
    const { keyring, clock, onKeyCreated } = setup();
    clock.set(MIDNIGHT - 5_000);

    keyring.pseudonymize(IPV4);

    expect(onKeyCreated).toHaveBeenCalledExactlyOnceWith(MIDNIGHT);
  });

  it("AC-8: the rotated key is zero-filled and the next key differs from it", () => {
    const { keyring, clock, random } = setup();
    keyring.pseudonymize(IPV4);
    const [oldKey] = random.calls;
    const oldKeyCopy = Uint8Array.from(oldKey ?? []);

    clock.set(MIDNIGHT);
    keyring.pseudonymize(IPV4);
    const newKey = random.calls[2];

    expect(oldKey).toHaveLength(KEY_BYTES);
    expect(oldKey?.every((byte) => byte === 0)).toBe(true);
    expect(newKey).toHaveLength(KEY_BYTES);
    expect(newKey).not.toEqual(oldKeyCopy);
  });

  it("AC-6: after a restart (new keyring) the same id gets a different pseudonym", () => {
    const beforeRestart = setup(1).keyring.pseudonymize(IPV4);
    const afterRestart = setup(2).keyring.pseudonymize(IPV4);

    expect(afterRestart).not.toBe(beforeRestart);
    expect(keyIdOf(afterRestart)).not.toBe(keyIdOf(beforeRestart));
  });
});

describe("ClientKeyring key state", () => {
  it("validKeyId never creates a key", () => {
    const { keyring, onKeyCreated, random } = setup();

    expect(keyring.validKeyId()).toBeNull();
    expect(onKeyCreated).not.toHaveBeenCalled();
    expect(random.calls).toHaveLength(0);
  });

  it("validKeyId names the live key and is null once it expired", () => {
    const { keyring, clock } = setup();
    const pseudonym = keyring.pseudonymize(IPV4);

    expect(keyring.validKeyId()).toBe(keyIdOf(pseudonym));
    clock.set(MIDNIGHT);
    expect(keyring.validKeyId()).toBeNull();
  });

  it("discardIfExpired keeps a valid key and destroys an expired one", () => {
    const { keyring, clock, random } = setup();
    keyring.pseudonymize(IPV4);

    keyring.discardIfExpired();
    expect(keyring.validKeyId()).not.toBeNull();

    clock.set(MIDNIGHT);
    keyring.discardIfExpired();
    expect(random.calls[0]?.every((byte) => byte === 0)).toBe(true);
  });

  it("a new key is announced once, not on every use", () => {
    const { keyring, onKeyCreated } = setup();

    keyring.pseudonymize(IPV4);
    keyring.pseudonymize("203.0.113.8");

    expect(onKeyCreated).toHaveBeenCalledExactlyOnceWith(MIDNIGHT);
  });
});

describe("ClientKeyring failures", () => {
  it("AC-15: a key shorter than 256 bits is rejected without the id in the error", () => {
    const keyring = createClientKeyring({
      clock: new FakeClock(),
      randomBytes: (length) => new Uint8Array(length - 1),
    });

    let thrown: unknown;
    try {
      keyring.pseudonymize(IPV4);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({ name: "PseudonymizationError" });
    expect(String(thrown)).not.toContain(IPV4);
    expect(keyring.validKeyId()).toBeNull();
  });

  it("AC-15: a failing random source fails the call and creates no key", () => {
    const keyring = createClientKeyring({
      clock: new FakeClock(),
      randomBytes: () => {
        throw new Error("entropy unavailable");
      },
    });

    expect(() => keyring.pseudonymize(IPV4)).toThrow();
    expect(keyring.validKeyId()).toBeNull();
  });
});
