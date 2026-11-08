import { CHECKOUT_PRICING } from "./checkout";

/**
 * v5 단일 SKU — 라임바질 페이셜 세럼 미스트 · take-01(정확한 문자열은 진시우 최종).
 * 홈·구매 시트가 참조하는 정적 값. 가격·재고의 권위는 백엔드(seam)이며,
 * id는 운영 상품(관리 API로 2026-11-06 등록, slug `take-01`)의 번호 그대로 — 목업 fixtures 도 같은 번호를 쓴다.
 */
export const PRODUCT = {
  productId: "01M6Q9CRE26QQ23008GC0M9C0N",
  variantId: "01M6Q9CSF159ZC0FD4GMR8WDQB",
  name: "라임바질 페이셜 세럼 미스트 · take-01",
  /** KRW 정가 — 한 곳(constants/checkout)의 임시 값을 그대로 쓴다 */
  price: CHECKOUT_PRICING.price,
  maxQuantity: 9,
} as const;

/**
 * 실제 제품 사진(public 경로, 예: `/image/product/take-01-main.webp`). 카드사 심사는 실제 상품 사진을 본다 —
 * AI·샘플 사진은 반려될 수 있다(토스 답). 파일을 public/image/product/ 에 넣고 경로를 채우면 그 자리의
 * '제품 사진 준비 중'이 사진으로 바뀐다(4:5 틀에 가운데 기준으로 채움). null 이면 준비 중 자리.
 */
export const PRODUCT_PHOTOS: Readonly<Record<"main" | "moment", string | null>> = {
  /** 제품 섹션 큰 컷 */
  main: null,
  /** 무드 갤러리의 모델+보틀 컷 자리 */
  moment: null,
};

/** v5 홈 에셋 경로 */
export const HOME_MEDIA = {
  heroPoster: "/image/v5/hero-poster.webp",
  /** 폰 화면에 보이는 가운데 부분만 자른 포스터(1100×1440) — 폰은 큰 포스터의 3분의 1만 보여서 */
  heroPosterMobile: "/image/v5/hero-poster-m.webp",
  heroWebm: "/video/v5/hero.webm",
  heroMp4: "/video/v5/hero.mp4",
  chair: "/image/v5/moment-chair.webp",
  paper: "/image/v5/moment-paper.webp",
  waterPoster: "/image/v5/moment-water-poster.webp",
  waterWebm: "/video/v5/water.webm",
  waterMp4: "/video/v5/water.mp4",
  turntable: "/image/v5/moment-turntable.webp",
  basket: "/image/v5/moment-basket.webp",
  earrings: "/image/v5/moment-earrings.webp",
  logoBlack: "/brand/logo-black.svg",
} as const;
