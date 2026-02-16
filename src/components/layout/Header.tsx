"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { SECTION_PADDING_X } from "@/constants/site";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";

/**
 * 사이트 공통 헤더
 *
 * 구조: MENU(좌) | 로고(정중앙) | 아이콘 3개(우)
 * 메뉴: 모바일 풀스크린 / 데스크톱 좌측 1/3 사이드 패널
 */
export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const t = useTranslations("header");

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const closeMenu = () => setIsMenuOpen(false);

  // 메뉴 열릴 때 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMenuOpen]);

  // 스크롤 감지 — 히어로(100vh) 지나면 dark 모드
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > window.innerHeight * 0.85);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isDark = scrolled && !isMenuOpen;

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-500 ${
          isDark ? "bg-white/90 backdrop-blur-md" : ""
        }`}
      >
        <div className={`w-full ${SECTION_PADDING_X}`}>
          <div className="grid grid-cols-3 items-center h-14 sm:h-16 md:h-18 lg:h-20">
            {/* ── 좌측: MENU 버튼 ── */}
            <div className="flex items-center justify-start">
              <button
                onClick={toggleMenu}
                className={`text-[11px] sm:text-xs tracking-[0.2em] font-bold transition-colors duration-300 p-1 ${
                  isDark
                    ? "text-foreground hover:text-foreground/50"
                    : "text-white hover:text-white/60"
                }`}
                aria-label={isMenuOpen ? t("menuClose") : t("menuOpen")}
              >
                {isMenuOpen ? t("close") : t("menu")}
              </button>
            </div>

            {/* ── 중앙: 로고 이미지 ── */}
            <div className="flex items-center justify-center">
              <Link href="/" onClick={closeMenu}>
                <Image
                  src="/logo.png"
                  alt="SUACI"
                  width={120}
                  height={40}
                  priority
                  className={`h-4 sm:h-5 lg:h-6 w-auto object-contain transition-[filter] duration-500 ${
                    isDark ? "brightness-0" : "brightness-0 invert"
                  }`}
                />
              </Link>
            </div>

            {/* ── 우측: 아이콘 3개 ── */}
            <div className="flex items-center justify-end gap-3 sm:gap-4 lg:gap-5">
              <IconButton icon="search" label={t("search")} dark={isDark} />
              <IconButton icon="user" label={t("mypage")} dark={isDark} />
              <IconButton icon="cart" label={t("cart")} badgeCount={0} dark={isDark} />
            </div>
          </div>
        </div>
      </header>

      {/* ── 메뉴 패널 ── */}
      <SideMenu isOpen={isMenuOpen} onClose={closeMenu} />
    </>
  );
}

/* ─── 사이드 메뉴 ──────────────────────────────── */

function SideMenu({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("nav");
  const tHeader = useTranslations("header");

  const navItems = [
    { label: t("product"), href: "#product" },
    { label: t("story"), href: "#story" },
    { label: t("event"), href: "/event" },
  ];

  const authLinks = [
    { label: t("login"), href: "/login" },
    { label: t("join"), href: "#" },
  ];

  return (
    <>
      {/* 배경 딤 */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 transition-opacity duration-500 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* 패널 — 모바일: 풀스크린 / md+: 왼쪽 1/3 */}
      <div
        className={`fixed top-0 left-0 z-50 h-full bg-foreground text-white
          w-full md:w-[38%] lg:w-[33%] xl:w-[28%]
          transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
          ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* 닫기 버튼 */}
        <div className="flex items-center h-14 sm:h-16 md:h-18 lg:h-20 px-6 sm:px-8">
          <button
            onClick={onClose}
            className="text-[11px] sm:text-xs tracking-[0.2em] font-bold text-white/70 hover:text-white transition-colors"
          >
            {tHeader("close")}
          </button>
        </div>

        {/* 내비게이션 */}
        <nav className="flex flex-col px-6 sm:px-8 pt-6 sm:pt-10">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href as any}
              onClick={onClose}
              className="block py-3 sm:py-4 text-3xl sm:text-4xl md:text-2xl lg:text-3xl tracking-[0.04em] font-bold text-white hover:text-[#A9FF39] transition-colors duration-300"
            >
              {item.label}
            </Link>
          ))}

          <div className="border-t border-white/10 mt-8 pt-6 flex flex-col gap-3">
            {authLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href as any}
                onClick={onClose}
                className="text-xs tracking-[0.15em] text-white/40 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        {/* 하단 — 언어 스위처 + 태그라인 */}
        <div className="absolute bottom-8 left-6 sm:left-8 right-6 sm:right-8">
          <LanguageSwitcher />
          <p className="text-[10px] tracking-[0.1em] text-white/20 mt-4">
            Recover Right After the Ride.
          </p>
        </div>
      </div>
    </>
  );
}

/* ─── 아이콘 컴포넌트 ────────────────────────────── */

interface IconButtonProps {
  icon: "search" | "user" | "cart";
  label: string;
  badgeCount?: number;
  dark?: boolean;
}

function IconButton({ icon, label, badgeCount, dark }: IconButtonProps) {
  return (
    <button
      className={`p-1 transition-colors relative ${
        dark
          ? "text-foreground hover:text-foreground/50"
          : "text-white hover:text-white/60"
      }`}
      aria-label={label}
    >
      {icon === "search" && <SearchIcon />}
      {icon === "user" && <UserIcon />}
      {icon === "cart" && (
        <>
          <CartIcon />
          {badgeCount !== undefined && (
            <span
              className={`absolute -top-0.5 -right-1 text-[9px] sm:text-[10px] w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full flex items-center justify-center leading-none ${
                dark ? "bg-foreground text-white" : "bg-white text-black"
              }`}
            >
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
