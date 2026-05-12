/** 사이트 전역 상수 */
export const SITE = {
  name: "SUACI",
  wordmark: "suaci",
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
 */
export const SHELL_MAX_WIDTH = "max-w-[1480px]";
export const SECTION_PADDING_X = "px-[18px] md:px-[28px]";
export const SHELL = `${SHELL_MAX_WIDTH} mx-auto ${SECTION_PADDING_X}`;
