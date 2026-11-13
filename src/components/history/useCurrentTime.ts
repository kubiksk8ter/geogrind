import { useEffect, useState } from "react";

const readSystemClock = () => Date.now();

const msUntilNextMidnight = (now: number) => {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now;
};

/**
 * The current time as state, so renders stay pure. It is read again when `refreshKey` changes
 * and at every midnight, because relative labels such as "today" change then.
 */
export function useCurrentTime(
  refreshKey: unknown,
  readClock: () => number = readSystemClock,
) {
  const [now, setNow] = useState(readClock);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshKey only triggers the re-read.
  useEffect(() => {
    setNow(readClock());
  }, [refreshKey, readClock]);

  useEffect(() => {
    const timerId = window.setTimeout(
      () => setNow(readClock()),
      msUntilNextMidnight(now),
    );
    return () => window.clearTimeout(timerId);
  }, [now, readClock]);

  return now;
}
