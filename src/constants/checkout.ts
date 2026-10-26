/**
 * 구매 흐름의 미정 값 — 전부 임시. 판매가·배송비는 오너가, 브랜드페이 이름은 시우가 정하면 여기만 바꾼다.
 * 버튼 총액은 이 식으로 그리고, 최종 금액의 권위는 서버 totals 다(mock 서버도 같은 상수를 쓴다).
 */
export const CHECKOUT_PRICING = {
  /** KRW 판매가(임시 — UX 설계의 자리 숫자) */
  price: 28000,
  /** KRW 배송비(임시) */
  shippingFee: 3000,
  /** 이 금액(소계)부터 무료 배송 */
  freeShippingOver: 50000,
} as const;

/** 상품 페이지 버튼에 쓰는 배송비 포함 총액 — UX §5 "총액이 늦게 보이면 이탈 1위" */
export function displayTotal(qty: number): number {
  const subtotal = CHECKOUT_PRICING.price * qty;
  const shipping = subtotal >= CHECKOUT_PRICING.freeShippingOver ? 0 : CHECKOUT_PRICING.shippingFee;
  return subtotal + shipping;
}

/** 브랜드페이 표시 이름 — 가칭. 시우 결정 전(UX "오너에게 남긴 것") */
export const BRANDPAY_LABEL = "suaci 바로결제";

/** 배송 메모 칩(기본 첫 번째). 화면에는 "직접 쓸게요"가 하나 더 붙는다 */
export const DELIVERY_MEMOS = ["문 앞", "경비실", "택배함"] as const;
