import "server-only";
import { resolve } from "node:path";
import { GroqClient } from "../ai/groqClient";
import type { AppEnv } from "../config/env";
import { NominatimGeocoder } from "../geocoding/nominatimGeocoder";
import { abortableSleep } from "../geocoding/requestSpacer";
import { FileStateStore } from "../state/fileStateStore";
import { CommandLimits } from "../state/limits";
import { systemClock } from "../state/types";
import type { CommandServices } from "./commandHandler";

// The geocoder keeps the 1 request/s spacing and the cache, so there must be only one.
let geocoder: { key: string; instance: NominatimGeocoder } | undefined;

function sharedGeocoder({ geocoderUrl, geocoderContact }: AppEnv) {
  const key = `${geocoderUrl}|${geocoderContact ?? ""}`;
  if (geocoder?.key !== key) {
    geocoder = {
      key,
      instance: new NominatimGeocoder({
        baseUrl: geocoderUrl,
        contact: geocoderContact,
        clock: systemClock,
        sleep: abortableSleep,
      }),
    };
  }
  return geocoder.instance;
}

export function createServices(env: AppEnv): CommandServices {
  return {
    ai: new GroqClient({ apiKey: env.groqApiKey, model: env.groqModel }),
    geocoder: sharedGeocoder(env),
    limits: new CommandLimits(
      new FileStateStore(
        // A runtime data folder, not a source file: it must not make Turbopack trace the project.
        resolve(/* turbopackIgnore: true */ process.cwd(), env.stateDir),
      ),
      systemClock,
      env.dailyCap,
    ),
  };
}
