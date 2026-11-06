/**
 * 토스 결제창 실패 주소의 `code` → 화면 사유. 손님이 창을 닫은 것·카드사가 거절한 것·그 밖의 실패를 나눈다.
 * 토스 `message` 는 화면에 그대로 쓰지 않는다 — 실패 주소는 누구나 만들 수 있어, 남이 만든 링크로 우리 화면에
 * 아무 글(가짜 연락처 등)이나 띄울 수 있기 때문이다. 문구는 우리 메시지(`pay.result.*`)로만 보여 준다.
 */
export type FailReason = "canceled" | "declined" | "failed";

/** 손님이 결제를 그만둔 코드 — 실패가 아니라 취소로 안내한다 */
const CANCEL_CODES = new Set(["PAY_PROCESS_CANCELED", "USER_CANCEL"]);

/** 실패 주소의 code → 화면 사유. 카드사 거절·한도·카드 정보 문제(REJECT_*·EXCEED_*·…CARD…)는 declined */
export function failReason(code: string | null): FailReason {
  if (!code) return "failed";
  if (CANCEL_CODES.has(code)) return "canceled";
  if (code.startsWith("REJECT_") || code.startsWith("EXCEED_") || code.includes("CARD"))
    return "declined";
  return "failed";
}
