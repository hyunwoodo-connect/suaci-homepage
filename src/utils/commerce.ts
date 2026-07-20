import type { Price } from "@/types/commerce";

/** ₩ 기호 + 한국 천 단위 콤마. */
export function formatKRW(amount: number): string {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

/** 할인율(%) 반환. 할인가 없으면 null. 정수 반올림. */
export function getDiscountPercent(price: Price): number | null {
  if (!price.sale || price.sale >= price.list) return null;
  return Math.round((1 - price.sale / price.list) * 100);
}

/** 실 결제 금액 (할인가 우선, 없으면 정가). */
export function getEffectivePrice(price: Price): number {
  return price.sale ?? price.list;
}

/** "★ 4.9" 같은 형태로 평점 포맷. */
export function formatRatingScore(score: number): string {
  return `★ ${score.toFixed(1)}`;
}
