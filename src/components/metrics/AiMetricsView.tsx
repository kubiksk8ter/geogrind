import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { AiMetrics, LimitFigure } from "@/shared/metricsContract";
import { formatClock, formatCountdown } from "@/shared/timeFormatters";
import { formatCount } from "./formatNumbers";
import { limitView, UNKNOWN_LIMIT } from "./limitView";
import { MetricsSection } from "./MetricsSection";
import { MeterBar } from "./visuals/MeterBar";

export interface AiMetricsViewProps {
  ai: AiMetrics;
  /** The server's time, already corrected for the device clock. */
  now: number;
  locale: Locale;
}

export function AiMetricsView({ ai, now, locale }: AiMetricsViewProps) {
  const t = useTranslations("panel.metrics");
  const nothingKnown = ai.lastRequest === null && ai.limits === null;

  return (
    <div className="flex flex-col gap-3 p-4 pt-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-neutral-900">
          {t("ai.title")}
        </h2>
        <p className="min-w-0 break-all text-right text-[11px] text-neutral-700">
          {t.rich("ai.model.line", {
            model: ai.model,
            label: (chunks) => (
              <span className="font-semibold text-neutral-900">{chunks}</span>
            ),
          })}
        </p>
      </div>
      <DailyCap cap={ai.dailyCap} now={now} locale={locale} />
      <hr className="border-neutral-300" />
      {nothingKnown ? (
        <p className="text-neutral-700">{t("empty")}</p>
      ) : (
        <LastRequest lastRequest={ai.lastRequest} locale={locale} />
      )}
      <hr className="border-neutral-300" />
      {!nothingKnown && (
        <>
          <LimitItem
            label={t("ai.limits.requests")}
            figure={ai.limits?.requests ?? UNKNOWN_LIMIT}
            now={now}
            locale={locale}
          />
          <LimitItem
            label={t("ai.limits.tokens")}
            figure={ai.limits?.tokens ?? UNKNOWN_LIMIT}
            now={now}
            locale={locale}
          />
          <hr className="border-neutral-300" />
        </>
      )}
      <MetricsSection title={t("ai.tokensToday.title")}>
        <p className="text-base font-semibold text-neutral-900">
          {formatCount(ai.dailyTokens, locale)}
        </p>
      </MetricsSection>
    </div>
  );
}

function LastRequest({
  lastRequest,
  locale,
}: {
  lastRequest: AiMetrics["lastRequest"];
  locale: Locale;
}) {
  const t = useTranslations("panel.metrics");
  const columns = [
    ["prompt", lastRequest?.prompt],
    ["completion", lastRequest?.completion],
    ["total", lastRequest?.total],
  ] as const;

  return (
    <MetricsSection title={t("ai.lastRequest.title")}>
      <table className="w-full table-fixed text-neutral-900">
        <thead>
          <tr>
            {columns.map(([key]) => (
              <th
                key={key}
                scope="col"
                className="pb-1 text-left text-xs font-semibold text-neutral-700"
              >
                {t(`ai.lastRequest.${key}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {columns.map(([key, value]) => (
              <td key={key} className="text-left text-xs">
                {value === null || value === undefined
                  ? t("noData")
                  : formatCount(value, locale)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </MetricsSection>
  );
}

function LimitItem({
  label,
  figure,
  now,
  locale,
}: {
  label: string;
  figure: LimitFigure;
  now: number;
  locale: Locale;
}) {
  const t = useTranslations("panel.metrics");
  const view = limitView(figure, now);

  if (view.kind === "renewed") {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-neutral-900">{label}</p>
        {/* Appears once when the countdown ends, so it is announced once, not every second. */}
        <p role="status" className="text-xs text-neutral-700">
          {t("ai.limits.renewed")}
        </p>
      </div>
    );
  }

  const { remaining, bar } = view;
  const numbers = ({
    remaining,
    limit,
  }: {
    remaining: number;
    limit: number;
  }) => ({
    remaining: formatCount(remaining, locale),
    limit: formatCount(limit, locale),
  });
  const resetText =
    view.resetInMs === null
      ? t("ai.limits.resetUnknown")
      : t("ai.limits.resets", {
          time: formatCountdown(view.resetInMs, locale),
        });

  return (
    <div className="flex flex-col gap-1">
      {bar ? (
        <MeterBar
          label={label}
          value={bar.remaining}
          max={bar.limit}
          display={t("ai.limits.value", numbers(bar))}
          ariaValueText={t("ai.limits.ariaValueText", numbers(bar))}
        />
      ) : (
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-neutral-900">{label}</p>
          <p className="font-semibold text-neutral-900">
            {remaining === null
              ? t("noData")
              : t("ai.limits.remainingOnly", {
                  remaining: formatCount(remaining, locale),
                })}
          </p>
        </div>
      )}
      <p className="text-xs text-neutral-700">{resetText}</p>
    </div>
  );
}

function DailyCap({
  cap,
  now,
  locale,
}: {
  cap: AiMetrics["dailyCap"];
  now: number;
  locale: Locale;
}) {
  const t = useTranslations("panel.metrics");
  const numbers = {
    used: formatCount(cap.used, locale),
    cap: formatCount(cap.cap, locale),
  };

  return (
    <section className="flex flex-col gap-2">
      <MeterBar
        label={t("ai.cap.title")}
        value={cap.used}
        max={cap.cap}
        display={t("ai.cap.value", numbers)}
        ariaValueText={t("ai.cap.ariaValueText", numbers)}
      />
      <p className="text-xs text-neutral-700">
        {t("ai.cap.resets", { time: formatClock(cap.resetsAt - now) })}
      </p>
    </section>
  );
}
