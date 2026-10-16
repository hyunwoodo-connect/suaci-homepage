/**
 * v5 단일 SKU — brume no.1.
 * 홈·구매 시트가 참조하는 정적 값. 가격·재고의 권위는 백엔드(seam)이며,
 * id는 fixtures(`prod_daily_mist` / `var_daily_80`)와 1:1로 맞춘다.
 */
export const PRODUCT = {
  productId: "prod_daily_mist",
  variantId: "var_daily_80",
  slug: "daily-calming-mist",
  name: "brume no.1",
  volume: "100 ml",
  /** KRW 정가 — 임시 가격 */
  price: 38000,
  maxQuantity: 9,
} as const;

/** v5 홈 에셋 경로 */
export const HOME_MEDIA = {
  heroPoster: "/image/v5/hero-poster.webp",
  heroWebm: "/video/v5/hero.webm",
  heroMp4: "/video/v5/hero.mp4",
  heroMp4Small: "/video/v5/hero-720.mp4",
  sofa: "/image/v5/moment-sofa.webp",
  paper: "/image/v5/moment-paper.webp",
  water: "/image/v5/moment-water.webp",
  turntable: "/image/v5/moment-turntable.webp",
  bottle: "/image/v5/moment-bottle.webp",
  basket: "/image/v5/moment-basket.webp",
  earrings: "/image/v5/moment-earrings.webp",
  productReference: "/image/v5/product-reference.webp",
  logoBlack: "/brand/logo-black.svg",
  logoWhite: "/brand/logo-white.svg",
} as const;
