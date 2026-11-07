import { ApiClientError } from "@/lib/api";

/**
 * 주문 관리(취소·반품·교환·철회·배송지 변경)가 막힌 이유 중 손님에게 따로 알리는 서버 코드 — 메시지 `claims.error.{code}`.
 * 그 밖(네트워크·모르는 코드)은 `claims.error.default`(잠시 뒤 다시)
 */
const KNOWN_CODES: readonly string[] = [
  "ORDER_NOT_CANCELLABLE",
  "CLAIM_NOT_ALLOWED",
  "OVER_REFUND",
  "INVALID_CLAIM_QUANTITY",
  "REFUND_IN_PROGRESS",
  "RETURN_WINDOW_CLOSED",
  "RETURN_ALREADY_REQUESTED",
  "RETURN_NOT_ALLOWED",
  "RETURN_UNOPENED_REQUIRED",
  "NOTHING_TO_REFUND",
  "EXCHANGE_NOT_ALLOWED",
  "EXCHANGE_WINDOW_CLOSED",
  "CLAIM_NOT_WITHDRAWABLE",
  "ADDRESS_CHANGE_NOT_ALLOWED",
  "ADDRESS_NOT_FOUND",
];

/** 실패 → `claims` 메시지 키(`error.{code}` 또는 `error.default`) */
export function claimErrorKey(err: unknown): string {
  return err instanceof ApiClientError && KNOWN_CODES.includes(err.code)
    ? `error.${err.code}`
    : "error.default";
}
