/** 사이트 전역 상수 */
export const SITE = {
  name: "SUACI",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://suaci.com",
  title: "SUACI — Outdoor Recovery Skincare",
  description: "아웃도어 활동 직후, 피부의 즉각적인 회복. SUACI 공식 웹사이트.",
  copyright: "© 2025 SUACI. All rights reserved.",
  tagline: "Recover Right After the Ride.",
} as const;

/** 히어로 슬라이드 자동 전환 간격 (ms) */
export const HERO_SLIDE_INTERVAL = 5000;

/**
 * 공통 섹션 좌우 패딩
 * 모든 섹션/헤더/푸터에서 동일하게 사용
 */
export const SECTION_PADDING_X = "px-5 sm:px-6 md:px-8 lg:px-12 xl:px-16";
