import { ApiClientError } from "@/lib/api";

/** 주문을 만들다 실패한 이유 중 손님에게 따로 알리는 코드 — 메시지 `checkout.error.{code}` */
const KNOWN_ORDER_ERRORS = [
  "ADDRESS_NOT_FOUND",
  "PAYMENT_AMOUNT_MISMATCH",
  "OUT_OF_STOCK",
  "AUTH_REQUIRED",
] as const;

/**
 * 결제 시작(주문 만들기·결제창 열기) 실패 → `checkout` 메시지 키. 주문서와 재구매 시트가 같은 문구를 쓴다.
 * 모르는 코드·네트워크 오류·결제창 오류는 '일시적인 문제'(GENERIC).
 */
export function orderErrorKey(err: unknown): string {
  return err instanceof ApiClientError &&
    (KNOWN_ORDER_ERRORS as readonly string[]).includes(err.code)
    ? `error.${err.code}`
    : "error.GENERIC";
}
