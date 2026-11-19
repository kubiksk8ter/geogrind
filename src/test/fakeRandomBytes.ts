/**
 * Deterministic stand-in for `randomBytes`: every call returns fresh bytes that differ from
 * those of earlier calls. `calls` keeps every returned array, so tests can inspect a discarded key.
 */
export function createFakeRandomBytes(seed = 1) {
  const calls: Uint8Array[] = [];
  let next = seed;
  const randomBytes = (length: number): Uint8Array => {
    const call = next++;
    const bytes = Uint8Array.from(
      { length },
      (_, index) => (call * 37 + index * 11) % 256,
    );
    calls.push(bytes);
    return bytes;
  };
  return { randomBytes, calls };
}
