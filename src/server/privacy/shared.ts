import "server-only";
import { getEnv } from "../config/env";
import { systemClock } from "../state/types";
import { type ClientKeyring, createClientKeyring } from "./clientKeyring";
import {
  createKeyExpirySweeper,
  type KeyExpirySweeper,
} from "./keyExpirySweeper";
import { createSweepJob } from "./sweepJob";

// Bundles may contain this module more than once, so the instances live on globalThis.
declare global {
  var geogrindClientKeyring: ClientKeyring | undefined;
  var geogrindKeyExpirySweeper: KeyExpirySweeper | undefined;
}

/** Receives error names only, never ids or keys. */
const log = (code: string) => console.warn("[privacy]", code);

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}

/** The one keyring of the process, shared by the limits and the metrics window. */
export function sharedClientKeyring(): ClientKeyring {
  globalThis.geogrindClientKeyring ??= createClientKeyring({
    clock: systemClock,
    onKeyCreated: (expiresAt) => {
      // The lazy expiry check still rotates the key, so a failure here must not fail the request.
      try {
        sharedKeyExpirySweeper().arm(expiresAt);
      } catch (error) {
        log(errorName(error));
      }
    },
  });
  return globalThis.geogrindClientKeyring;
}

/** The one cleanup timer of the process. */
export function sharedKeyExpirySweeper(): KeyExpirySweeper {
  if (globalThis.geogrindKeyExpirySweeper === undefined) {
    const keyring = sharedClientKeyring();
    globalThis.geogrindKeyExpirySweeper = createKeyExpirySweeper({
      clock: systemClock,
      keyring,
      sweep: createSweepJob({ clock: systemClock, keyring, loadEnv: getEnv }),
      log,
    });
  }
  return globalThis.geogrindKeyExpirySweeper;
}
