/**
 * 주문서·재구매 시트의 고르기 칩(배송 메모·결제수단) 한 모양 — 누르는 자리 44px, 글자 14px.
 * 고른 상태는 `CHIP_ON`·`CHIP_OFF` 중 하나를 덧붙여 나타낸다.
 */
export const CHIP =
  "inline-flex min-h-[44px] cursor-pointer items-center rounded-full border px-[16px] text-[14px] transition-colors";
/** 고른 칩 — 잉크 채움 */
export const CHIP_ON = "border-ink bg-ink text-paper";
/** 안 고른 칩 — 가는 선, 마우스를 올리면 잉크 선 */
export const CHIP_OFF = "border-line text-ink hover:border-ink";
