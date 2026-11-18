"use client";

import { useTranslations } from "next-intl";
import { useLocaleSwitch } from "@/i18n/LocaleProvider";
import { useMapAvailability } from "../map/mapAvailability";
import { AiMetricsView } from "./AiMetricsView";
import { AppMetricsView } from "./AppMetricsView";
import { useMetricsPoll } from "./useMetricsPoll";
import { useServerNow } from "./useServerNow";

export function MetricsTab() {
  const t = useTranslations("panel.metrics");
  const { locale } = useLocaleSwitch();
  const { snapshot, clockOffsetMs, failed } = useMetricsPoll();
  const now = useServerNow(clockOffsetMs, snapshot !== null, snapshot);
  const map = useMapAvailability();

  if (!snapshot) {
    return (
      <p className="p-4 text-sm text-neutral-700">
        {failed ? t("loadFailed") : t("loading")}
      </p>
    );
  }

  return (
    <>
      {failed && (
        <p className="border-b border-neutral-300 bg-neutral-100 p-4 text-sm text-neutral-900">
          {t("outdated")}
        </p>
      )}
      <AppMetricsView
        app={snapshot.app}
        serverNow={snapshot.serverNow}
        map={map}
        locale={locale}
      />
      {/* Full width: cancels the horizontal padding of the panel. */}
      <hr className="-mx-4 border-neutral-300 mt-4" />
      <AiMetricsView ai={snapshot.ai} now={now} locale={locale} />
    </>
  );
}
