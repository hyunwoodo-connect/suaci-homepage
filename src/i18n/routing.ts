import { defineRouting } from "next-intl/routing";

/**
 * 영어 기본 + 일본어 + 한국어.
 * en은 접두사 없음, ja는 /ja, ko는 /ko. 기본 언어를 바꾸는 결정(#93)이 나면 defaultLocale만 바꾼다.
 */
export const routing = defineRouting({
  locales: ["en", "ja", "ko"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
