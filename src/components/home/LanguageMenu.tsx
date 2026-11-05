"use client";

import { useEffect, useId, useRef, useState } from "react";

import { useLocale, useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";

interface LanguageOption {
  code: Locale;
  /** 단추에 보이는 짧은 이름 — 로케일 코드와 다르다(ko→kr, ja→jp) */
  short: string;
  /** 그 언어로 쓴 이름. 영어도 사이트 규칙대로 소문자 */
  name: string;
}

/** 기본 시장(한국) 먼저 */
const LANGUAGES: ReadonlyArray<LanguageOption> = [
  { code: "ko", short: "kr", name: "한국어" },
  { code: "en", short: "en", name: "english" },
  { code: "ja", short: "jp", name: "日本語" },
];

/**
 * 헤더 언어 고르기 — 지구본 + 지금 언어(kr) 단추, 누르면 작은 목록이 펼쳐진다. 지금 언어엔 라임 동그라미 체크.
 * 펼침 단추(disclosure) 방식: 목록은 링크라서 role="menu" 를 쓰지 않는다(WAI 사이트 길찾기 관례).
 * 닫기: 다시 누르기 · Esc(초점은 단추로) · 바깥 누르기 · Tab 으로 밖에 나가기 · 언어 고르기.
 */
export default function LanguageMenu() {
  const t = useTranslations("home.header");
  const locale = useLocale();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const focusFirstRef = useRef(false);
  const listId = useId();
  const current = LANGUAGES.find((l) => l.code === locale) ?? LANGUAGES[0];

  useEffect(() => {
    if (!isOpen) return;
    if (focusFirstRef.current) {
      focusFirstRef.current = false;
      getItems(rootRef.current)[0]?.focus();
    }
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setIsOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  const onButtonKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown") return;
    e.preventDefault();
    if (isOpen) {
      getItems(rootRef.current)[0]?.focus();
      return;
    }
    focusFirstRef.current = true;
    setIsOpen(true);
  };

  const onItemKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const list = getItems(rootRef.current);
    const at = list.indexOf(e.currentTarget as HTMLAnchorElement);
    const step = e.key === "ArrowDown" ? 1 : -1;
    list[(at + step + list.length) % list.length]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onBlur={(e) => {
        // Safari 는 누른 링크에 초점을 주지 않아 relatedTarget 이 비어 온다 — 그땐 바깥 누르기 처리에 맡긴다
        const next = e.relatedTarget as Node | null;
        if (next && !rootRef.current?.contains(next)) setIsOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={onButtonKeyDown}
        className="flex h-[44px] cursor-pointer items-center gap-[4px] rounded-full px-[8px] text-[13px] text-ink transition-colors hover:bg-ink/5"
      >
        <GlobeIcon />
        {/* 읽는 이름은 '언어 kr 한국어' — 보이는 글자(kr)를 이름 안에 둔다(음성 조작으로 부를 수 있게) */}
        <span className="sr-only">{t("lang")} </span>
        <span>{current.short}</span>
        <span className="sr-only"> {current.name}</span>
        <ChevronIcon isOpen={isOpen} />
      </button>

      {/* 보이고 숨기기(visibility)는 바로 — 서서히 바꾸면 펼친 순간엔 아직 숨은 상태라 ↓ 로 첫 언어에 초점을 못 준다 */}
      <ul
        id={listId}
        className={`absolute right-0 top-full m-0 mt-[4px] min-w-[176px] list-none rounded-[16px] bg-paper p-[6px] shadow-[0_8px_28px_rgba(20,20,20,0.14)] ring-1 ring-line transition-[opacity,translate] duration-150 motion-reduce:transition-none ${isOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-[4px] opacity-0"}`}
      >
        {LANGUAGES.map((lang) => {
          const isCurrent = lang.code === locale;
          return (
            <li key={lang.code}>
              <Link
                href={pathname}
                locale={lang.code}
                lang={lang.code}
                hrefLang={lang.code}
                aria-current={isCurrent ? "true" : undefined}
                data-language-item=""
                onClick={() => setIsOpen(false)}
                onKeyDown={onItemKeyDown}
                className={`flex min-h-[44px] items-center justify-between gap-[16px] rounded-[10px] px-[12px] text-[15px] text-ink transition-colors hover:bg-ink/5 ${isCurrent ? "font-medium" : ""}`}
              >
                {lang.name}
                {isCurrent && <CheckDot />}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M3.75 12h16.5M12 3.75c2.15 2.3 3.25 5.05 3.25 8.25s-1.1 5.95-3.25 8.25M12 3.75C9.85 6.05 8.75 8.8 8.75 12s1.1 5.95 3.25 8.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

interface ChevronIconProps {
  isOpen: boolean;
}

function ChevronIcon({ isOpen }: ChevronIconProps) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={`transition-transform duration-150 motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 지금 언어 표시 — 라임 동그라미 위 먹색 체크(라임 위 글자·선은 ink) */
function CheckDot() {
  return (
    <span
      aria-hidden="true"
      className="flex size-[20px] shrink-0 items-center justify-center rounded-full bg-lime text-ink"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path
          d="m2.75 6.25 2.25 2.25 4.25-4.75"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/* ─── 내부 ─────────────────────────── */

function getItems(root: HTMLElement | null): HTMLAnchorElement[] {
  return [...(root?.querySelectorAll<HTMLAnchorElement>("[data-language-item]") ?? [])];
}
