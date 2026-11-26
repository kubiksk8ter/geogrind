export const MAX_BODY_BYTES = 1024;

export type GuardResult =
  | { ok: true; body: string }
  | { ok: false; status: 403 | 405 | 413 | 415 };

/** Reads at most `limit` bytes; null means the body is longer. */
async function readLimitedText(
  request: Request,
  limit: number,
): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    received += value.byteLength;
    if (received > limit) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

function isJson(request: Request): boolean {
  const mediaType = request.headers.get("content-type")?.split(";")[0];
  return mediaType?.trim().toLowerCase() === "application/json";
}

/** Method, origin, content type and size; nothing here needs the AI or any stored state. */
export async function guardRequest(
  request: Request,
  allowedOrigins: readonly string[],
): Promise<GuardResult> {
  if (request.method !== "POST") return { ok: false, status: 405 };

  const origin = request.headers.get("origin");
  if (origin === null || !allowedOrigins.includes(origin)) {
    return { ok: false, status: 403 };
  }
  if (!isJson(request)) return { ok: false, status: 415 };

  const declared = Number(request.headers.get("content-length"));
  if (declared > MAX_BODY_BYTES) return { ok: false, status: 413 };

  const body = await readLimitedText(request, MAX_BODY_BYTES);
  return body === null ? { ok: false, status: 413 } : { ok: true, body };
}
