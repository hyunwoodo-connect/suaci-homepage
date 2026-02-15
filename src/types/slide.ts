/** 히어로 슬라이드 한 장의 정보 */
export interface HeroSlide {
  /** 상단 소제목 (예: "2025 NEW COLLECTION") */
  subtitle: string;
  /** 메인 타이틀 — \n 으로 줄바꿈 */
  title: string;
  /** 설명 문구 */
  description: string;
  /** CTA 버튼 텍스트 */
  cta: string;
  /** 배경 Tailwind 클래스 */
  bg: string;
}
