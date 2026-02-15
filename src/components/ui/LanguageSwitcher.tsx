"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

const LOCALES: { code: Locale; label: string }[] = [
  { code: "ko", label: "KR" },
  { code: "en", label: "EN" },
  { code: "ja", label: "JP" },
  { code: "th", label: "TH" },
];

/**
 * 언어 전환 — 가로 나열, 현재 로케일 하이라이트
 */
export default function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (code: Locale) => {
    if (code === locale) return;
    router.replace(pathname, { locale: code });
  };

  return (
    <div className="flex items-center gap-3">
      {LOCALES.map(({ code, label }) => (
        <button
          key={code}
          onClick={() => handleChange(code)}
          className={`text-[10px] tracking-[0.15em] transition-colors duration-300 ${
            code === locale
              ? "text-white font-semibold"
              : "text-white/30 hover:text-white/60"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
