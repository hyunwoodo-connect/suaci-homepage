import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ko", "en", "zh", "ja", "th"],
  defaultLocale: "ko",
  localePrefix: "as-needed", // ko는 접두사 없음, 나머지는 /en, /ja, /th
});

export type Locale = (typeof routing.locales)[number];
