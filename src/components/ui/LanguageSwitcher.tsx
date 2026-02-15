"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

const LOCALE_LABELS: Record<Locale, string> = {
  ko: "KR",
  en: "EN",
  ja: "JP",
  th: "TH",
};

const LOCALES: Locale[] = ["ko", "en", "ja", "th"];

/**
 * 언어 전환 컴포넌트
 * 현재 로케일을 표시하고 클릭 시 다음 로케일로 순환
 */
export default function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const cycleLocale = () => {
    const currentIndex = LOCALES.indexOf(locale);
    const nextIndex = (currentIndex + 1) % LOCALES.length;
    const nextLocale = LOCALES[nextIndex];
    router.replace(pathname, { locale: nextLocale });
  };

  return (
    <button
      onClick={cycleLocale}
      className="text-[10px] sm:text-[11px] tracking-[0.15em] font-medium text-white/60 hover:text-white transition-colors duration-300 p-1"
      aria-label="Change language"
    >
      {LOCALE_LABELS[locale]}
    </button>
  );
}
