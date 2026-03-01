"use client";

import { useState, useRef, useEffect } from "react";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

const LOCALES: { code: Locale; label: string }[] = [
  { code: "ko", label: "KR" },
  { code: "en", label: "EN" },
  { code: "zh", label: "CN" },
  { code: "ja", label: "JP" },
  { code: "th", label: "TH" },
];

/**
 * 언어 전환 — 사이드메뉴용 (가로 나열)
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

/**
 * 헤더용 언어 드롭다운 — 현재 로케일 표시 + 클릭 시 드롭다운
 */
export function HeaderLanguageSwitcher({ dark }: { dark?: boolean }) {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LOCALES.find((l) => l.code === locale)!;

  const handleChange = (code: Locale) => {
    if (code !== locale) router.replace(pathname, { locale: code });
    setOpen(false);
  };

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`text-[11px] sm:text-xs tracking-[0.1em] font-medium p-1 transition-colors ${
          dark
            ? "text-foreground/60 hover:text-foreground"
            : "text-white/60 hover:text-white"
        }`}
      >
        {current.label}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 bg-white shadow-lg border border-foreground/10 min-w-[48px] py-1 z-50">
          {LOCALES.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => handleChange(code)}
              className={`block w-full text-left px-4 py-2 text-[11px] tracking-[0.1em] transition-colors ${
                code === locale
                  ? "text-foreground font-semibold"
                  : "text-foreground/40 hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
