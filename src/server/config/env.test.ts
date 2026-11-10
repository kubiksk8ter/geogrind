import { describe, expect, it } from "vitest";
import {
  ConfigError,
  DEFAULT_DAILY_CAP,
  DEFAULT_GEOCODER_URL,
  DEFAULT_GROQ_MODEL,
  loadEnv,
} from "./env";

const PRODUCTION_ENV = {
  GROQ_API_KEY: "test-key",
  GEOCODER_CONTACT: "ops@example.test",
  CLIENT_IP_HEADER: "X-Real-IP",
  APP_ORIGIN: "https://geogrind.example, https://www.geogrind.example/",
};

describe("loadEnv", () => {
  it("applies development defaults when only the key is set", () => {
    const env = loadEnv({ GROQ_API_KEY: "test-key" }, { production: false });

    expect(env).toEqual({
      groqApiKey: "test-key",
      groqModel: DEFAULT_GROQ_MODEL,
      geocoderUrl: DEFAULT_GEOCODER_URL,
      geocoderContact: undefined,
      clientIpHeader: undefined,
      appOrigins: ["http://localhost:3000"],
      stateDir: ".data",
      dailyCap: DEFAULT_DAILY_CAP,
    });
  });

  it("normalises header name, origins and URL", () => {
    const env = loadEnv(
      { ...PRODUCTION_ENV, GEOCODER_URL: "https://geo.example/" },
      { production: true },
    );

    expect(env.clientIpHeader).toBe("x-real-ip");
    expect(env.appOrigins).toEqual([
      "https://geogrind.example",
      "https://www.geogrind.example",
    ]);
    expect(env.geocoderUrl).toBe("https://geo.example");
  });

  it("treats blank values as unset", () => {
    const env = loadEnv(
      { GROQ_API_KEY: "test-key", GROQ_MODEL: "  ", DAILY_CAP: "" },
      { production: false },
    );

    expect(env.groqModel).toBe(DEFAULT_GROQ_MODEL);
    expect(env.dailyCap).toBe(DEFAULT_DAILY_CAP);
  });

  it("reads DAILY_CAP as a positive integer", () => {
    const env = loadEnv(
      { GROQ_API_KEY: "test-key", DAILY_CAP: "120" },
      { production: false },
    );

    expect(env.dailyCap).toBe(120);
  });

  it.each(["0", "-3", "1.5", "many"])("rejects DAILY_CAP %s", (cap) => {
    expect(() =>
      loadEnv({ GROQ_API_KEY: "k", DAILY_CAP: cap }, { production: false }),
    ).toThrow(ConfigError);
  });

  it("rejects a missing key and names the variable but not any value", () => {
    expect(() => loadEnv({}, { production: false })).toThrow(
      "Invalid environment variables: GROQ_API_KEY",
    );
  });

  it.each(["GEOCODER_CONTACT", "CLIENT_IP_HEADER", "APP_ORIGIN"])(
    "requires %s in production only",
    (name) => {
      const rest = Object.fromEntries(
        Object.entries(PRODUCTION_ENV).filter(([key]) => key !== name),
      );

      expect(() => loadEnv(rest, { production: true })).toThrow(name);
      expect(() => loadEnv(rest, { production: false })).not.toThrow();
    },
  );

  it("rejects an invalid origin and header name without echoing them", () => {
    expect(() =>
      loadEnv(
        { ...PRODUCTION_ENV, APP_ORIGIN: "not a url secret" },
        { production: true },
      ),
    ).toThrow(/^Invalid environment variables: APP_ORIGIN$/);
    expect(() =>
      loadEnv(
        { ...PRODUCTION_ENV, CLIENT_IP_HEADER: "bad header" },
        { production: true },
      ),
    ).toThrow(/CLIENT_IP_HEADER$/);
  });
});
