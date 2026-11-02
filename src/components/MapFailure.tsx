import { useTranslations } from "next-intl";
import { FULL_SCREEN } from "./styles";

export function MapFailure() {
  const t = useTranslations("map");

  return (
    <div
      className={`${FULL_SCREEN} grid place-items-center bg-neutral-100 p-4 text-center wrap-anywhere`}
      role="alert"
    >
      <p>{t("loadError")}</p>
    </div>
  );
}
