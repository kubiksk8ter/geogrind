import type messages from "../../messages/cs.json";
import type { Locale } from "./routing";

declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
