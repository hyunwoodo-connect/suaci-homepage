"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import LoginModal from "@/components/ui/LoginModal";
import CartDrawer from "@/components/ui/CartDrawer";

const LOCALES: Locale[] = ["ko", "en", "ja", "zh", "th"];

/**
 * 사이트 공통 헤더 — Home v2 매거진 톤 sticky 헤더
 *
 * 구조:
 * - notice bar (짙은 초록 배경, cream 텍스트, 닫기 가능)
 * - main row: 로고(소문자 suaci + sup No.01) / nav / 우측(언어·로그인·카트)
 */
export default function Header() {
  const [noticeOpen, setNoticeOpen] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const tNotice = useTranslations("notice");
  const tHeader = useTranslations("header");
  const tNav = useTranslations("nav");

  return (
    <>
      {/* ── Notice bar ── */}
      {noticeOpen && (
        <div className="relative z-50 bg-green border-b border-white/[0.08]">
          <div className="max-w-[1480px] mx-auto px-[18px] md:px-[32px] py-[10px] flex items-center justify-center gap-[14px] text-[12px] leading-none text-cream-on-green max-sm:text-[11px] max-sm:gap-[8px]">
            <span className="w-[5px] h-[5px] rounded-full bg-cream-on-green opacity-70" />
            <span>{tNotice("text")}</span>
            <span className="font-en text-[11px] tracking-[0.22em] uppercase">
              →
            </span>
            <button
              type="button"
              onClick={() => setNoticeOpen(false)}
              aria-label={tNotice("close")}
              className="absolute right-[18px] top-1/2 -translate-y-1/2 text-cream-on-green/55 text-[14px] leading-none p-[6px] hover:text-cream-on-green transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-[rgba(250,250,247,0.92)] backdrop-blur-[12px] backdrop-saturate-150 border-b border-line">
        <div className="max-w-[1480px] mx-auto px-[18px] md:px-[32px] py-[18px] flex items-center gap-[36px] max-sm:py-[14px] max-sm:gap-[18px]">
          {/* Logo */}
          <Link href="/" className="flex items-baseline gap-[6px] leading-none">
            <span className="font-en font-medium text-[24px] tracking-[-0.01em] text-green">
              suaci
            </span>
            <sup className="font-en text-[9px] text-ink-mute tracking-[0.18em] uppercase">
              No.01
            </sup>
          </Link>

          {/* Nav */}
          <nav className="ml-auto hidden lg:flex gap-[36px]">
            <Link
              href="/#story"
              className="font-en text-[12px] tracking-[0.18em] uppercase text-ink-soft hover:text-green transition-colors"
            >
              {tNav("story")}
            </Link>
            <Link
              href="/#product"
              className="font-en text-[12px] tracking-[0.18em] uppercase text-ink-soft hover:text-green transition-colors"
            >
              {tNav("product")}
            </Link>
            <Link
              href="/#moments"
              className="font-en text-[12px] tracking-[0.18em] uppercase text-ink-soft hover:text-green transition-colors"
            >
              {tNav("moments")}
            </Link>
            <Link
              href="/#order"
              className="font-en text-[12px] tracking-[0.18em] uppercase text-ink-soft hover:text-green transition-colors"
            >
              {tNav("order")}
            </Link>
          </nav>

          {/* Right */}
          <div className="flex items-center gap-[18px] pl-[24px] border-l border-line ml-auto lg:ml-0 max-sm:pl-[14px]">
            <LangToggle />
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              aria-label={tHeader("login")}
              className="inline-flex items-center justify-center w-[24px] h-[24px] text-ink-soft hover:text-green transition-colors"
            >
              <UserIcon />
            </button>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label={tHeader("cart")}
              className="relative inline-flex items-center justify-center w-[24px] h-[24px] text-ink-soft hover:text-green transition-colors"
            >
              <CartIcon />
              <span className="absolute -top-[3px] -right-[6px] min-w-[15px] h-[15px] px-[4px] rounded-full bg-green text-white font-en text-[9px] font-semibold inline-flex items-center justify-center leading-none">
                2
              </span>
            </button>
          </div>
        </div>
      </header>

      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
      <CartDrawer isOpen={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function LangToggle() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (code: Locale) => {
    if (code === locale) return;
    router.replace(pathname, { locale: code });
  };

  return (
    <div
      aria-label="language"
      className="hidden md:flex items-center font-en text-[10px] tracking-[0.18em] text-ink-mute uppercase"
    >
      {LOCALES.map((code, idx) => (
        <button
          key={code}
          type="button"
          onClick={() => handleChange(code)}
          className={`px-[7px] leading-none transition-colors ${
            idx > 0 ? "border-l border-line" : "pl-0"
          } ${code === locale ? "text-green" : "hover:text-foreground"}`}
        >
          {code}
        </button>
      ))}
    </div>
  );
}

function UserIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M2.5 14c.5-3 3-4.5 5.5-4.5s5 1.5 5.5 4.5" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
    >
      <path d="M3 4.5h10l-.9 8.2a1 1 0 0 1-1 .9H4.9a1 1 0 0 1-1-.9L3 4.5Z" />
      <path d="M5.5 4.5V3a2.5 2.5 0 0 1 5 0v1.5" />
    </svg>
  );
}
