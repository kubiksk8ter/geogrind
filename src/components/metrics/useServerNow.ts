import { useEffect, useState } from "react";

const TICK_MS = 1_000;

/**
 * The server's current time (device time plus the offset of the last answer) as state, so renders
 * stay pure. It ticks once a second while `ticking`; `refreshKey` forces a re-read.
 */
export function useServerNow(
  clockOffsetMs: number,
  ticking: boolean,
  refreshKey: unknown,
) {
  const [deviceNow, setDeviceNow] = useState(Date.now);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey only triggers the re-read.
  useEffect(() => {
    setDeviceNow(Date.now());
    if (!ticking) return;
    const timerId = window.setInterval(() => setDeviceNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timerId);
  }, [ticking, refreshKey]);

  return deviceNow + clockOffsetMs;
}
