/**
 * 구매 흐름의 미정 값 — 전부 임시. 판매가·배송비는 오너가 정하면 여기만 바꾼다.
 * 브랜드페이 표시 이름(가칭 'suaci 바로결제')은 언어별로 메시지 `pay.method.BRANDPAY` 에 있다.
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

/** 배송비까지 더한 결제 금액 — 주문서·재구매 시트의 합계(사기 바엔 상품가만) */
export function displayTotal(qty: number): number {
  const subtotal = CHECKOUT_PRICING.price * qty;
  const shipping = subtotal >= CHECKOUT_PRICING.freeShippingOver ? 0 : CHECKOUT_PRICING.shippingFee;
  return subtotal + shipping;
}

/**
 * 배송 메모 칩(기본 첫 번째). 값은 택배 기사에게 그대로 가는 한국어 — 화면 이름만 언어별(`pay.memo.*`).
 * 화면에는 "직접 쓸게요"가 하나 더 붙는다
 */
export const DELIVERY_MEMOS = [
  "문 앞에 놓아 주세요",
  "경비실에 맡겨 주세요",
  "택배함에 넣어 주세요",
] as const;

/** 예전 칩 값(이미 손님 기기에 저장돼 있다) → 지금 칩 값. 읽을 때 바꿔 칩이 다시 골라지게 한다 */
const LEGACY_MEMOS: Record<string, (typeof DELIVERY_MEMOS)[number]> = {
  "문 앞": "문 앞에 놓아 주세요",
  경비실: "경비실에 맡겨 주세요",
  택배함: "택배함에 넣어 주세요",
};

/** 저장된 배송 메모 → 지금 쓸 값(예전 칩 값이면 새 문장, 아니면 그대로) */
export function normalizeMemo(saved: string): string {
  return LEGACY_MEMOS[saved] ?? saved;
}

/** 배송 메모 값 → 화면 이름 메시지 키(`pay.memo.{key}`) */
export const DELIVERY_MEMO_KEYS: Record<(typeof DELIVERY_MEMOS)[number], string> = {
  "문 앞에 놓아 주세요": "door",
  "경비실에 맡겨 주세요": "guard",
  "택배함에 넣어 주세요": "box",
};
