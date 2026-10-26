import { defineRouting } from "next-intl/routing";

/**
 * 한국어 기본(2026-10-26 오너 결정 #93, 1차 시장 한국) + 영어 + 일본어.
 * ko는 접두사 없음, en은 /en, ja는 /ja. 예전 /ko 주소는 next-intl이 접두사 없는 주소로 보낸다.
 */
export const routing = defineRouting({
  locales: ["ko", "en", "ja"],
  defaultLocale: "ko",
  localePrefix: "as-needed",
});

export type Locale = (typeof routing.locales)[number];
