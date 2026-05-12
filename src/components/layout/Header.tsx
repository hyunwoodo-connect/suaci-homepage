"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import LoginModal from "@/components/ui/LoginModal";
import CartDrawer from "@/components/ui/CartDrawer";

const LOCALES: Locale[] = ["ko", "en", "ja", "zh", "th"];

/**
 * 사이트 공통 헤더 — 매거진 톤 sticky 헤더
 *
 * 구조:
 * - notice bar (닫기 가능, 짙은 초록 텍스트)
 * - main row: 로고(소문자 suaci + sup No.01) / nav / 우측(언어·로그인·카트)
 * - category strip
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
      {noticeOpen && (
        <div className="relative z-50 border-b border-line bg-background">
          <div className="max-w-[1480px] mx-auto px-[18px] md:px-[28px] py-[9px] flex items-center justify-center gap-[14px] relative">
            <span className="text-[12px] text-green leading-none">
              {tNotice("text")}
            </span>
            <span className="font-en text-[11px] tracking-[0.08em] uppercase text-green inline-block -translate-y-px">
              →
            </span>
            <button
              type="button"
              onClick={() => setNoticeOpen(false)}
              aria-label={tNotice("close")}
              className="absolute right-[14px] md:right-[22px] top-1/2 -translate-y-1/2 text-ink-mute text-[14px] leading-none p-[6px] hover:text-foreground transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 bg-[rgba(250,250,247,0.92)] backdrop-blur-md backdrop-saturate-150 border-b border-line">
        <div className="max-w-[1480px] mx-auto px-[18px] md:px-[28px] py-[14px] flex items-center gap-4 md:gap-8">
          <Link href="/" className="flex items-baseline leading-none">
            <span className="font-en font-medium text-[22px] tracking-[-0.01em] text-green">
              suaci
            </span>
            <sup className="font-en font-normal text-[9px] text-ink-mute tracking-[0.06em] uppercase ml-[6px]">
              No.01
            </sup>
          </Link>

          <nav className="ml-auto hidden md:flex gap-[30px] font-en text-[13px] tracking-[0.06em] uppercase text-ink-soft">
            <Link href="/#story" className="hover:text-green transition-colors">
              {tNav("story")}
            </Link>
            <Link href="/#product" className="hover:text-green transition-colors">
              {tNav("product")}
            </Link>
            <Link href="/#order" className="hover:text-green transition-colors">
              {tNav("order")}
            </Link>
          </nav>

          <div className="flex items-center gap-[14px] md:gap-[22px] md:pl-[22px] md:border-l md:border-line ml-auto md:ml-0">
            <LangToggle />
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              aria-label={tHeader("login")}
              className="inline-flex items-center justify-center w-[26px] h-[26px] text-ink-soft hover:text-green transition-colors"
            >
              <UserIcon />
            </button>
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              aria-label={tHeader("cart")}
              className="relative inline-flex items-center justify-center w-[26px] h-[26px] text-ink-soft hover:text-green transition-colors"
            >
              <CartIcon />
              <span className="absolute -top-[2px] -right-[6px] min-w-[15px] h-[15px] px-[4px] rounded-full bg-green text-white font-en text-[9px] font-semibold tracking-[0.02em] inline-flex items-center justify-center leading-none">
                2
              </span>
            </button>
          </div>
        </div>

        <div className="max-w-[1480px] mx-auto px-[18px] md:px-[28px] pt-[10px] pb-[14px] flex items-center gap-[22px] font-en text-[12px] tracking-[0.06em] text-ink-mute border-t border-dotted border-line overflow-x-auto">
          <a href="#" className="text-ink hover:text-foreground transition-colors whitespace-nowrap">
            {tNav("categories.all")}
          </a>
          <a href="#" className="hover:text-ink transition-colors whitespace-nowrap">
            {tNav("categories.calming")}
          </a>
          <a href="#" className="hover:text-ink transition-colors whitespace-nowrap">
            {tNav("categories.cleansing")}
          </a>
          <a href="#" className="hover:text-ink transition-colors whitespace-nowrap">
            {tNav("categories.sun")}
          </a>
          <a href="#" className="hover:text-ink transition-colors whitespace-nowrap">
            {tNav("categories.mask")}
          </a>
          <span className="flex-1 h-px bg-transparent" />
          <a
            href="#"
            className="inline-flex items-center gap-[8px] text-green whitespace-nowrap"
          >
            <span className="w-[6px] h-[6px] rounded-full bg-green dot-pulse" />
            {tNav("categories.new")}
          </a>
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
      className="hidden md:flex gap-0 items-center font-en text-[11px] tracking-[0.06em] text-ink-mute uppercase"
    >
      {LOCALES.map((code, idx) => (
        <button
          key={code}
          type="button"
          onClick={() => handleChange(code)}
          className={`px-[6px] leading-none transition-colors ${
            idx > 0 ? "border-l border-line" : ""
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
