/**
 * Runs once when the server starts, before it serves requests: removes client data a previous
 * run left in the state file (its key is gone, so nothing there can be matched any more).
 */
export async function register(): Promise<void> {
  // The cleanup needs the file system; the Edge runtime has none.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { sharedKeyExpirySweeper } = await import("./server/privacy/shared");
    await sharedKeyExpirySweeper().sweepNow();
  } catch (error) {
    // A failed cleanup must never stop the server from starting.
    console.warn("[privacy]", error instanceof Error ? error.name : "unknown");
  }
}
