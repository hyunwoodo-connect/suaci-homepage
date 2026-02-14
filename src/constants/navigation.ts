import type { NavItem, FooterLinkGroup } from "@/types";

/** 헤더 메인 네비게이션 — 원페이지 앵커 + 이벤트 */
export const NAV_ITEMS: NavItem[] = [
  { label: "PRODUCT", href: "#product" },
  { label: "STORY", href: "#story" },
  { label: "EVENT", href: "/event" },
];

/** 모바일 메뉴 하단 링크 */
export const MOBILE_AUTH_LINKS: NavItem[] = [
  { label: "LOGIN", href: "#" },
  { label: "JOIN US", href: "#" },
];

/** 푸터 링크 그룹 */
export const FOOTER_LINK_GROUPS: FooterLinkGroup[] = [
  {
    title: "PRODUCT",
    links: [
      { label: "Outdoor Mist", href: "#product" },
      { label: "How to Use", href: "#story" },
    ],
  },
  {
    title: "BRAND",
    links: [
      { label: "About SUACI", href: "#story" },
    ],
  },
  {
    title: "SUPPORT",
    links: [
      { label: "Notice", href: "#" },
      { label: "Q&A", href: "#" },
      { label: "Event", href: "/event" },
    ],
  },
];

/** 푸터 하단 법적 링크 */
export const FOOTER_LEGAL_LINKS: NavItem[] = [
  { label: "이용약관", href: "#" },
  { label: "개인정보처리방침", href: "#" },
];
