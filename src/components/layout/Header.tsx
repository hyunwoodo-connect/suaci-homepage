"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { SITE, SECTION_PADDING_X } from "@/constants/site";
import { NAV_ITEMS, MOBILE_AUTH_LINKS } from "@/constants/navigation";

/**
 * 사이트 공통 헤더
 *
 * 구조: MENU(좌) | 로고(정중앙) | 아이콘 3개(우)
 *
 * - 배경 투명 → 비디오/히어로 위에 떠 있음
 * - 모든 콘텐츠(텍스트, 로고, 아이콘) 흰색
 */
export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div className={`w-full ${SECTION_PADDING_X}`}>
        <div className="grid grid-cols-3 items-center h-14 sm:h-16 md:h-18 lg:h-20">
          {/* ── 좌측: MENU 버튼 ── */}
          <div className="flex items-center justify-start">
            <button
              onClick={toggleMenu}
              className="text-[11px] sm:text-xs tracking-[0.2em] font-bold text-white hover:text-white/60 transition-colors duration-300 p-1"
              aria-label={isMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
            >
              {isMenuOpen ? "CLOSE" : "MENU"}
            </button>
          </div>

          {/* ── 중앙: 로고 이미지 ── */}
          <div className="flex items-center justify-center">
            <Link href="/">
              <Image
                src="/logo.png"
                alt={SITE.name}
                width={120}
                height={40}
                priority
                className="h-4 sm:h-5 lg:h-6 w-auto object-contain brightness-0 invert"
              />
            </Link>
          </div>

          {/* ── 우측: 아이콘 3개 ── */}
          <div className="flex items-center justify-end gap-3 sm:gap-4 lg:gap-5">
            <IconButton icon="search" label="검색" />
            <IconButton icon="user" label="마이페이지" />
            <IconButton icon="cart" label="장바구니" badgeCount={0} />
          </div>
        </div>
      </div>

      {/* ── 메뉴 오버레이 ── */}
      {isMenuOpen && <FullscreenMenu onClose={closeMenu} />}
    </header>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────────── */

/** 풀스크린 메뉴 오버레이 */
function FullscreenMenu({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 top-14 sm:top-16 md:top-18 lg:top-20 bg-white z-40 overflow-y-auto">
      <nav className="max-w-[600px] mx-auto flex flex-col px-6 sm:px-8 py-10 sm:py-14 gap-6 sm:gap-8">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            onClick={onClose}
            className="text-2xl sm:text-3xl md:text-4xl tracking-[0.12em] font-bold text-foreground hover:text-muted transition-colors duration-300"
          >
            {item.label}
          </Link>
        ))}

        <div className="border-t border-border mt-4 pt-8 flex flex-col gap-4 sm:gap-5">
          {MOBILE_AUTH_LINKS.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={onClose}
              className="text-xs tracking-[0.15em] text-muted hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

/* ─── 아이콘 컴포넌트 ────────────────────────────── */

interface IconButtonProps {
  icon: "search" | "user" | "cart";
  label: string;
  badgeCount?: number;
}

function IconButton({ icon, label, badgeCount }: IconButtonProps) {
  return (
    <button
      className="p-1 text-white hover:text-white/60 transition-colors relative"
      aria-label={label}
    >
      {icon === "search" && <SearchIcon />}
      {icon === "user" && <UserIcon />}
      {icon === "cart" && (
        <>
          <CartIcon />
          {badgeCount !== undefined && (
            <span className="absolute -top-0.5 -right-1 bg-white text-black text-[9px] sm:text-[10px] w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center leading-none">
              {badgeCount}
            </span>
          )}
        </>
      )}
    </button>
  );
}

/* ─── SVG 아이콘 ──────────────────────────────────── */

const ICON_PROPS = {
  xmlns: "http://www.w3.org/2000/svg",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "w-[18px] h-[18px] sm:w-5 sm:h-5",
};

function SearchIcon() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}
