/**
 * 주문서·재구매 시트의 고르기 칩(배송 메모·결제수단) 한 모양 — 누르는 자리 44px, 글자 14px.
 * 고른 칩은 잉크 채움, 나머지는 가는 선.
 */
export const CHIP =
  "inline-flex min-h-[44px] cursor-pointer items-center rounded-full border px-[16px] text-[14px] transition-colors";
export const CHIP_ON = "border-ink bg-ink text-paper";
export const CHIP_OFF = "border-line text-ink hover:border-ink";
