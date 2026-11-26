import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { MapAvailability } from "@/map";
import type { AppMetrics } from "@/shared/metricsContract";
import { formatDuration } from "@/shared/timeFormatters";
import {
  isPartialWindow,
  type ServiceState,
  serviceState,
  windowSpanMinutes,
} from "./appMetricsViewHelper";
import { formatCount } from "./formatNumbers";
import { MetricsSection } from "./MetricsSection";
import { LatencySparkline } from "./visuals/LatencySparkline";
import { ResultsPie } from "./visuals/ResultsPie";
import { ServiceLight } from "./visuals/ServiceLight";

export interface AppMetricsViewProps {
  app: AppMetrics;
  /** The server's time of the snapshot, to tell whether the hour window is still partial. */
  serverNow: number;
  /** The map state of this browser, independent of the snapshot. */
  map: MapAvailability;
  locale: Locale;
}

const MINUTE_MS = 60_000;

export function AppMetricsView({
  app,
  serverNow,
  map,
  locale,
}: AppMetricsViewProps) {
  const t = useTranslations("panel.metrics.app");
  const partial = isPartialWindow(app.window, serverNow);

  return (
    <div className="flex flex-col gap-3 p-4 pt-3 pb-0 text-sm">
      <h2 className="text-base font-semibold text-neutral-900">{t("title")}</h2>
      <MetricsSection title={t("services.title")}>
        <Services map={map} nominatim={serviceState(app.services.nominatim)} />
      </MetricsSection>
      <hr className="border-neutral-300" />
      <MetricsSection title={t("results.title")}>
        <ResultsPie results={app.results} locale={locale} />
      </MetricsSection>
      <hr className="border-neutral-300" />
      <MetricsSection
        title={partial ? t("latency.titleSinceStart") : t("latency.title")}
      >
        <Latency
          latency={app.latency}
          window={app.window}
          serverNow={serverNow}
          locale={locale}
        />
      </MetricsSection>
      <hr className="border-neutral-300" />
      <MetricsSection title={t("load.title")}>
        <Load load={app.load} partial={partial} locale={locale} />
      </MetricsSection>
    </div>
  );
}

function Latency({
  latency,
  window,
  serverNow,
  locale,
}: {
  latency: AppMetrics["latency"];
  window: AppMetrics["window"];
  serverNow: number;
  locale: Locale;
}) {
  const t = useTranslations("panel.metrics");
  if (latency === null)
    return <p className="text-neutral-700">{t("noData")}</p>;

  const median = formatDuration(latency.medianMs, locale);
  const p95 = formatDuration(latency.p95Ms, locale);
  const label = t("app.latency.chartLabel", {
    bucket: Math.round(window.bucketMs / MINUTE_MS),
    minutes: windowSpanMinutes(window, serverNow),
    median,
    p95,
    count: latency.count,
  });

  return (
    <div className="flex flex-col gap-2">
      <LatencySparkline
        series={latency.series}
        label={label}
        axis={{
          zero: "0",
          start: t("app.latency.axisStart"),
          end: t("app.latency.axisEnd"),
        }}
      />
      <dl className="grid grid-cols-[auto_auto] justify-start gap-x-2 gap-y-0.5 text-[11px]">
        <dt className="text-neutral-700">{t("app.latency.median")}</dt>
        <dd className="font-semibold tabular-nums text-neutral-900">
          {median}
        </dd>
        <dt className="text-neutral-700">{t("app.latency.p95")}</dt>
        <dd className="font-semibold tabular-nums text-neutral-900">{p95}</dd>
      </dl>
    </div>
  );
}

function Load({
  load,
  partial,
  locale,
}: {
  load: AppMetrics["load"];
  partial: boolean;
  locale: Locale;
}) {
  const t = useTranslations("panel.metrics");
  const value = (figure: number | null) =>
    figure === null ? t("noData") : formatCount(figure, locale);
  const rows = [
    [t("app.load.lastMinute"), value(load.lastMinute)],
    [
      partial ? t("app.load.lastHourSinceStart") : t("app.load.lastHour"),
      value(load.lastHour),
    ],
    [
      partial
        ? t("app.load.activeClientsSinceStart")
        : t("app.load.activeClients"),
      value(load.activeClients),
    ],
    [t("app.load.inProgress"), value(load.inProgress)],
  ] as const;

  return (
    <dl className="flex flex-col gap-1 text-xs">
      {rows.map(([label, figure]) => (
        <div key={label} className="flex items-baseline justify-between gap-2">
          <dt className="text-neutral-700">{label}</dt>
          <dd className="font-semibold tabular-nums text-neutral-900">
            {figure}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Services({
  map,
  nominatim,
}: {
  map: ServiceState;
  nominatim: ServiceState;
}) {
  const t = useTranslations("panel.metrics.app");
  const tCommon = useTranslations("panel.metrics");
  const services = [
    ["map", t("services.map"), map],
    ["nominatim", t("services.nominatim"), nominatim],
  ] as const;

  return (
    <>
      <ul className="flex flex-col gap-1 text-xs text-neutral-900">
        {services.map(([key, name, state]) => (
          <li key={key} className="flex items-center gap-2">
            <ServiceLight state={state} title={t(`services.${state}`)} />
            <span>{name}</span>
          </li>
        ))}
      </ul>
      {nominatim === "unknown" && (
        <p className="text-xs text-neutral-700">{tCommon("empty")}</p>
      )}
    </>
  );
}
