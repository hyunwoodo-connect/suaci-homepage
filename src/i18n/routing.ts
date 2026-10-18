import { defineRouting } from "next-intl/routing";

/**
 * v5 — 영어 기본 + 일본어.
 * en은 접두사 없음, ja는 /ja.
 */
export const routing = defineRouting({
  locales: ["en", "ja"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
