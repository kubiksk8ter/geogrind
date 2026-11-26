import { useEffect, useRef, useState } from "react";
import type { MapTarget } from "@/map";
import type { CommandResult } from "@/shared/actions";
import type { Locale } from "@/shared/commandContract";
import { normalizeCommandText } from "@/shared/text";
import type { CommandClient } from "./commandClient";
import { readCooldownEnd, saveCooldownEnd } from "./cooldownStorage";
import { isTransient, NOTICE_DURATION_MS, type Notice } from "./notice";

const COUNTDOWN_TICK_MS = 250;
// Used when the server says "wait" without a time (it always sends one; this is only a guard).
const FALLBACK_COOLDOWN_SECONDS = 10;

const secondsUntil = (end: number) =>
  Math.max(0, Math.ceil((end - Date.now()) / 1000));

export interface CommandInputOptions {
  client: CommandClient;
  /** Null while the map is not ready; submitting then shows the generic error. */
  onMove: ((target: MapTarget) => void) | null;
  /** Called once a command is sent, so the previous result is not left on the map. */
  onSend: () => void;
  /** Called right after `onMove` for a successful command only, with the text that was typed. */
  onSuccess?: (text: string, result: CommandResult) => void;
  /** Called with true when a request starts and with false when it ends. */
  onRequestRunningChange?: (running: boolean) => void;
  locale: Locale;
}

/** State and behaviour of the command input; the component only renders it. */
export function useCommandInputController({
  client,
  onMove,
  onSend,
  onSuccess,
  onRequestRunningChange,
  locale,
}: CommandInputOptions) {
  const [value, setValueState] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pausedUntil, setPausedUntil] = useState(() =>
    readCooldownEnd(Date.now()),
  );
  const [secondsLeft, setSecondsLeft] = useState(() =>
    pausedUntil === null ? 0 : secondsUntil(pausedUntil),
  );
  const inputRef = useRef<HTMLElement>(null);
  const requestRunning = useRef(false);
  const refocusAfterPause = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (notice === null || !isTransient(notice)) return;
    const timerId = window.setTimeout(
      () => setNotice(null),
      NOTICE_DURATION_MS,
    );
    return () => window.clearTimeout(timerId);
  }, [notice]);

  useEffect(() => {
    if (pausedUntil === null) return;
    const tick = () => {
      const left = secondsUntil(pausedUntil);
      if (left > 0) {
        setSecondsLeft(left);
        return;
      }
      setPausedUntil(null);
      setNotice({ kind: "resumed" });
    };
    tick();
    const timerId = window.setInterval(tick, COUNTDOWN_TICK_MS);
    return () => window.clearInterval(timerId);
  }, [pausedUntil]);

  const paused = pausedUntil !== null;
  useEffect(() => {
    if (paused || !refocusAfterPause.current) return;
    refocusAfterPause.current = false;
    inputRef.current?.focus();
  }, [paused]);

  const startPause = (seconds: number, { announce = true } = {}) => {
    // A disabled input loses focus, so remember it now to give it back afterwards.
    refocusAfterPause.current = document.activeElement === inputRef.current;
    const end = Date.now() + seconds * 1000;
    saveCooldownEnd(end);
    setSecondsLeft(seconds);
    setPausedUntil(end);
    // After a failure its own message stays visible; the pause is only shown in the field.
    if (announce) setNotice({ kind: "pausedStart", seconds });
  };

  const setValue = (next: string) => {
    setValueState(next);
    setNotice((current) => (current && isTransient(current) ? null : current));
  };

  const submit = async () => {
    if (requestRunning.current || paused) return;
    const text = normalizeCommandText(value);
    if (text === "") return;

    if (!onMove) {
      setNotice({ kind: "failure", code: "error" });
      return;
    }

    onSend();
    requestRunning.current = true;
    onRequestRunningChange?.(true);
    setNotice({ kind: "loading" });
    try {
      const response = await client({ text, locale });
      if (!mounted.current) return;

      if (response.ok) {
        onMove(response.result);
        onSuccess?.(text, response.result);
        // The command has been carried out, so the field is emptied for the next one.
        setValueState("");
        startPause(response.cooldownSeconds);
        return;
      }
      const { code, retryAfterSeconds, resetAt, cooldownSeconds } =
        response.error;
      if (code === "wait") {
        startPause(retryAfterSeconds ?? FALLBACK_COOLDOWN_SECONDS);
        return;
      }
      setNotice({ kind: "failure", code, retryAfterSeconds, resetAt });
      if (cooldownSeconds) startPause(cooldownSeconds, { announce: false });
    } finally {
      // Also after an exception, so the history is never left locked for a finished request.
      requestRunning.current = false;
      onRequestRunningChange?.(false);
    }
  };

  return {
    value,
    setValue,
    submit,
    notice,
    pausedSeconds: paused ? secondsLeft : null,
    inputRef,
  };
}
