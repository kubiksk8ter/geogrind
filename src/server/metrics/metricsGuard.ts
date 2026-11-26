export type MetricsGuardResult =
  | { ok: true }
  | { ok: false; status: 403 | 405 };

/**
 * Browsers send no `Origin` on a same-origin GET, so the command guard cannot be reused:
 * the fetch site must be the app itself and an `Origin`, when present, must be an allowed one.
 * It keeps foreign pages from reading the figures; it is not authentication.
 */
export function guardMetricsRequest(
  request: Request,
  allowedOrigins: readonly string[],
): MetricsGuardResult {
  if (request.method !== "GET") return { ok: false, status: 405 };
  if (request.headers.get("sec-fetch-site") !== "same-origin") {
    return { ok: false, status: 403 };
  }
  const origin = request.headers.get("origin");
  if (origin !== null && !allowedOrigins.includes(origin)) {
    return { ok: false, status: 403 };
  }
  return { ok: true };
}
