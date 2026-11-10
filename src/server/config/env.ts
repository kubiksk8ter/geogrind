import "server-only";
import * as v from "valibot";

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";
export const DEFAULT_GEOCODER_URL = "https://nominatim.openstreetmap.org";
export const DEFAULT_STATE_DIR = ".data";
export const DEFAULT_DAILY_CAP = 500;
const DEV_APP_ORIGIN = "http://localhost:3000";

export interface AppEnv {
  groqApiKey: string;
  groqModel: string;
  geocoderUrl: string;
  geocoderContact: string | undefined;
  /** Lower-case name of the trusted header; undefined only outside production. */
  clientIpHeader: string | undefined;
  /** Allowed values of the `Origin` request header. */
  appOrigins: string[];
  stateDir: string;
  dailyCap: number;
}

export class ConfigError extends Error {}

const text = v.pipe(v.string(), v.trim(), v.nonEmpty());

const headerName = v.pipe(
  text,
  v.regex(/^[A-Za-z0-9-]+$/),
  v.transform((name) => name.toLowerCase()),
);

const origin = v.pipe(
  text,
  v.url(),
  v.transform((value) => new URL(value).origin),
);

const origins = v.pipe(
  v.string(),
  v.transform((value) => value.split(",")),
  v.array(origin),
  v.minLength(1),
);

const positiveInteger = v.pipe(
  v.string(),
  v.regex(/^\d+$/),
  v.transform(Number),
  v.safeInteger(),
  v.minValue(1),
);

function envSchema(production: boolean) {
  // Defaults are input values (strings): optional() feeds them through the wrapped schema.
  const requiredInProduction = <T extends v.GenericSchema<string, unknown>>(
    schema: T,
    devDefault?: string,
  ) => (production ? schema : v.optional(schema, devDefault));

  return v.pipe(
    v.object({
      GROQ_API_KEY: text,
      GROQ_MODEL: v.optional(text, DEFAULT_GROQ_MODEL),
      GEOCODER_URL: v.optional(v.pipe(text, v.url()), DEFAULT_GEOCODER_URL),
      GEOCODER_CONTACT: requiredInProduction(text),
      CLIENT_IP_HEADER: requiredInProduction(headerName),
      APP_ORIGIN: requiredInProduction(origins, DEV_APP_ORIGIN),
      STATE_DIR: v.optional(text, DEFAULT_STATE_DIR),
      DAILY_CAP: v.optional(positiveInteger, String(DEFAULT_DAILY_CAP)),
    }),
    v.transform(
      (env): AppEnv => ({
        groqApiKey: env.GROQ_API_KEY,
        groqModel: env.GROQ_MODEL,
        geocoderUrl: env.GEOCODER_URL.replace(/\/+$/, ""),
        geocoderContact: env.GEOCODER_CONTACT,
        clientIpHeader: env.CLIENT_IP_HEADER,
        appOrigins: env.APP_ORIGIN ?? [],
        stateDir: env.STATE_DIR,
        dailyCap: env.DAILY_CAP,
      }),
    ),
  );
}

/** Blank values count as unset, so a copied `.env.example` works. Throws ConfigError without echoing values. */
export function loadEnv(
  source: Record<string, string | undefined>,
  { production }: { production: boolean },
): AppEnv {
  const present = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value?.trim()),
  );
  const result = v.safeParse(envSchema(production), present);
  if (result.success) return result.output;

  const names = result.issues.map((issue) => String(issue.path?.[0]?.key));
  throw new ConfigError(
    `Invalid environment variables: ${[...new Set(names)].join(", ")}`,
  );
}

/** Read lazily so a misconfiguration fails the request, not the build. */
export function getEnv(): AppEnv {
  return loadEnv(process.env, {
    production: process.env.NODE_ENV === "production",
  });
}
