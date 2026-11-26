import "server-only";
import { createHmac, randomBytes as cryptoRandomBytes } from "node:crypto";
import { nextUtcMidnight } from "../state/rules";
import type { Clock } from "../state/types";
import { DIGEST_LENGTH, formatPseudonym } from "./pseudonym";

/** Turns a raw client id into its pseudonym; throws on failure, never with the input in it. */
export type Pseudonymizer = (clientId: string) => string;

export interface ClientKeyringOptions {
  clock: Clock;
  /** Cryptographically secure randomness; the default is `node:crypto` randomBytes. */
  randomBytes?(length: number): Uint8Array;
  /** Told when a key is created; must not throw into the caller. */
  onKeyCreated?(expiresAt: number): void;
}

export interface ClientKeyring {
  pseudonymize: Pseudonymizer;
  /** keyId of the live key; null when none or expired (an expired key is discarded). Never creates. */
  validKeyId(): string | null;
  discardIfExpired(): void;
}

/** 256 bits, the strength of HMAC-SHA-256. */
export const KEY_BYTES = 32;
/** Six bytes are exactly eight base64url characters. */
const KEY_ID_BYTES = 6;

export class PseudonymizationError extends Error {
  name = "PseudonymizationError";
}

interface LiveKey {
  key: Uint8Array;
  keyId: string;
  expiresAt: number;
}

function drawBytes(
  randomBytes: (length: number) => Uint8Array,
  length: number,
): Uint8Array {
  const bytes = randomBytes(length);
  if (bytes.length < length) {
    throw new PseudonymizationError("Not enough random bytes");
  }
  return bytes.subarray(0, length);
}

/**
 * The key for client pseudonyms. It exists only in this object, is created on first use and
 * ends at the next UTC midnight (so it never lives longer than 24 h); a discarded key is
 * zero-filled. The keyId is drawn separately, so it tells nothing about the key.
 */
export function createClientKeyring({
  clock,
  randomBytes = cryptoRandomBytes,
  onKeyCreated,
}: ClientKeyringOptions): ClientKeyring {
  let live: LiveKey | null = null;

  function discardIfExpired(): void {
    if (live === null || clock.now() < live.expiresAt) return;
    live.key.fill(0);
    live = null;
  }

  function createKey(): LiveKey {
    const key = drawBytes(randomBytes, KEY_BYTES);
    const keyId = Buffer.from(drawBytes(randomBytes, KEY_ID_BYTES)).toString(
      "base64url",
    );
    return { key, keyId, expiresAt: nextUtcMidnight(clock.now()) };
  }

  function currentKey(): LiveKey {
    discardIfExpired();
    if (live !== null) return live;
    const created = createKey();
    live = created;
    onKeyCreated?.(created.expiresAt);
    return created;
  }

  function pseudonymize(clientId: string): string {
    const { key, keyId } = currentKey();
    let digest: string;
    try {
      digest = createHmac("sha256", key)
        .update(clientId)
        .digest("base64url")
        .slice(0, DIGEST_LENGTH);
    } catch {
      // A new error without a cause, so nothing about the input can leak through it.
      throw new PseudonymizationError("Hashing failed");
    }
    return formatPseudonym(keyId, digest);
  }

  return {
    pseudonymize,
    validKeyId() {
      discardIfExpired();
      return live?.keyId ?? null;
    },
    discardIfExpired,
  };
}
