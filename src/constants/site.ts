/** 사이트 전역 상수 */
export const SITE = {
  name: "SUACI",
  wordmark: "suaci",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://suaci.com",
  title: "SUACI — Daily Calming Mist",
  description: "피부가 흔들리는 순간을 줄이는, 데일리 카밍 미스트. SUACI.",
  copyright: "© 2026 suaci. All rights reserved.",
  tagline: "Calm your skin, wherever you are.",
} as const;

/** 히어로 슬라이드 자동 전환 간격 (ms) */
export const HERO_SLIDE_INTERVAL = 6000;

/**
 * 매거진 톤 공통 컨테이너
 * - max-width: 1480px
 * - desktop 좌우 패딩 28px / mobile 18px
 *
 * 모든 헤더·푸터·섹션의 컨테이너는 SHELL을 통한다.
 * SHELL_PADDING_X 단독은 풀블리드 섹션이 좌우 패딩만 필요할 때 사용.
 */
export const SHELL_MAX_WIDTH = "max-w-[1480px]";
export const SHELL_PADDING_X = "px-[18px] md:px-[28px]";
export const SECTION_PADDING_X = SHELL_PADDING_X;
export const SHELL = `${SHELL_MAX_WIDTH} mx-auto ${SHELL_PADDING_X}`;

/**
 * 매거진 톤 섹션 수직 패딩 프리셋.
 * 토큰: --spacing-section-sm (80px) / --spacing-section (140px) / --spacing-section-lg (160px)
 *
 *   <section className={SECTION_PADDING_Y}>...           // 일반 섹션
 *   <section className={SECTION_PADDING_Y_LG}>...        // 긴 호흡 (Story 등)
 *
 * 항상 모바일은 -sm, 데스크탑은 기본값. md: 분기는 Tailwind 기본 768px.
 */
export const SECTION_PADDING_Y = "py-section-sm md:py-section";
export const SECTION_PADDING_Y_LG = "py-section-sm md:py-section-lg";
