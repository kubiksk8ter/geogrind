import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { AppMetrics, ResultKey } from "@/shared/metricsContract";
import { resultEntries } from "../appMetricsViewHelper";
import { formatCount, formatPercent } from "../formatNumbers";
import { pieSlices } from "./chartGeometry";

const PIE = { cx: 50, cy: 50, r: 49 };

/**
 * One colour per result, shared by slice and legend swatch. Success and the harmless outcomes
 * ("unsupported", "not found") are green, getting lighter; then yellow, orange and red up to the
 * darkest red for an error. The two light greens are below 3:1 against the white panel (user
 * decision); the slices have a white outline and the legend swatches a grey one. The legend names
 * and counts every result.
 */
const RESULT_COLOURS: Record<ResultKey, string> = {
  success: "#15803d",
  unsupported: "#4cbb6e",
  not_found: "#c3ebd0",
  wait: "#bf8700",
  too_many_requests: "#ea580c",
  ai_resting: "#dc2626",
  error: "#991b1b",
};

export interface ResultsPieProps {
  results: AppMetrics["results"];
  locale: Locale;
}

/** The pie and its legend; with no command today neither is drawn (no stand-in circle). */
export function ResultsPie({ results, locale }: ResultsPieProps) {
  const t = useTranslations("panel.metrics");
  const entries = resultEntries(results);
  const total = entries.reduce((sum, { count }) => sum + count, 0);

  if (total === 0) return <p className="text-neutral-700">{t("noData")}</p>;

  const rows = entries.map(({ key, count }) => ({
    key,
    name: t(`app.results.names.${key}`),
    count: formatCount(count, locale),
    percent: formatPercent(count / total, locale),
  }));
  const chartLabel = t("app.results.chartLabel", {
    list: new Intl.ListFormat(locale, { type: "conjunction" }).format(
      rows.map(({ name, count, percent }) =>
        t("app.results.item", { name, count, percent }),
      ),
    ),
  });

  return (
    <div className="flex items-center justify-between gap-3">
      <svg
        role="img"
        aria-label={chartLabel}
        viewBox="0 0 100 100"
        className="size-24 shrink-0 forced-color-adjust-none"
      >
        {pieSlices(entries, PIE).map(({ key, d }) => (
          <path
            key={key}
            d={d}
            fill={RESULT_COLOURS[key]}
            stroke="white"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        ))}
      </svg>
      <ul className="grid w-fit shrink-0 grid-cols-[auto_auto_auto_auto] gap-x-1.5 text-[11px] leading-tight text-neutral-900">
        {rows.map(({ key, name, count, percent }) => (
          <li
            key={key}
            className="col-span-4 grid grid-cols-subgrid items-center"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 12 12"
              className="size-2.5 shrink-0 forced-color-adjust-none"
            >
              <rect
                x="0.5"
                y="0.5"
                width="11"
                height="11"
                fill={RESULT_COLOURS[key]}
                stroke="#737373"
              />
            </svg>
            <span>{name}</span>
            <span className="text-right font-semibold tabular-nums">
              {count}
            </span>
            <span className="text-right tabular-nums text-neutral-700">
              {percent}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
