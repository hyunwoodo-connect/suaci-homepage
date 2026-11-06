/**
 * 토스 결제창 실패 주소의 `code`·`message` → 화면 사유. 손님이 창을 닫은 것과 결제가 안 된 것을 나눈다.
 * message 는 토스가 손님에게 보여 주라고 준 글이라 그대로 쓰되, 길이를 잘라 화면이 넘치지 않게 한다.
 */
export interface FailReason {
  kind: "canceled" | "failed";
  /** 토스 안내 글(실패일 때만). 없으면 빈 글 */
  message: string;
}

/** 손님이 결제를 그만둔 코드 — 실패가 아니라 취소로 안내한다 */
const CANCEL_CODES = new Set(["PAY_PROCESS_CANCELED", "USER_CANCEL"]);
const MAX_MESSAGE = 120;

/** 실패 주소 쿼리 → 화면 사유 */
export function failReason(code: string | null, message: string | null): FailReason {
  if (code && CANCEL_CODES.has(code)) return { kind: "canceled", message: "" };
  const text = (message ?? "").trim().slice(0, MAX_MESSAGE);
  return { kind: "failed", message: text };
}
