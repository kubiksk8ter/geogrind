import type { StateData } from "../state/types";

/** `<keyId>~<digest>`; a raw IPv4 address or IPv6 /64 prefix can never have this shape. */
const PSEUDONYM_PATTERN = /^([A-Za-z0-9_-]{8})~[A-Za-z0-9_-]{16}$/;

/** 96 bits of the HMAC: unique enough for the limits, short so the pseudonym stays less unique. */
export const DIGEST_LENGTH = 16;

export function formatPseudonym(keyId: string, digest: string): string {
  return `${keyId}~${digest}`;
}

/** The key period a stored client id belongs to; null for anything that is not a pseudonym. */
export function keyIdOf(clientId: string): string | null {
  return PSEUDONYM_PATTERN.exec(clientId)?.[1] ?? null;
}

/**
 * Keeps only the client records hashed with the live key. Records of other or expired keys and
 * raw ids of earlier versions are dropped; without a live key every client record goes.
 */
export function purgeForeignClients(
  state: StateData,
  validKeyId: string | null,
): StateData {
  const clients: StateData["clients"] = {};
  if (validKeyId !== null) {
    for (const [id, client] of Object.entries(state.clients)) {
      if (keyIdOf(id) === validKeyId) clients[id] = client;
    }
  }
  return { ...state, clients };
}
