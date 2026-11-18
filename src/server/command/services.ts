import "server-only";
import { GroqClient } from "../ai/groqClient";
import type { AppEnv } from "../config/env";
import { NominatimGeocoder } from "../geocoding/nominatimGeocoder";
import { abortableSleep } from "../geocoding/requestSpacer";
import { sharedAiFigures } from "../metrics/ai/aiFigures";
import { createAiMetricsRecorder } from "../metrics/ai/aiMetricsRecorder";
import { sharedNominatimStatus } from "../metrics/app/serviceStatus";
import { createStateStore } from "../state/createStateStore";
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
        observe: (available) => sharedNominatimStatus().report(available),
      }),
    };
  }
  return geocoder.instance;
}

export function createServices(env: AppEnv): CommandServices {
  const store = createStateStore(env);
  const metrics = createAiMetricsRecorder({
    store,
    figures: sharedAiFigures(),
    clock: systemClock,
    log: (code) => console.warn("[metrics]", code),
  });
  return {
    ai: new GroqClient({
      apiKey: env.groqApiKey,
      model: env.groqModel,
      observe: (answer) => {
        // Not awaited: collecting metrics never delays a command; the recorder never rejects.
        void metrics.record(answer);
      },
    }),
    geocoder: sharedGeocoder(env),
    limits: new CommandLimits(store, systemClock, env.dailyCap),
  };
}
