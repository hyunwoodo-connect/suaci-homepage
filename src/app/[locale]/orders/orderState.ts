import type { BadgeTone } from "@/components/ui/Badge";
import type { Order, OrderState } from "@/types";

/**
 * 상태 이름 → 뱃지 색. 이름은 서버가 정하고(`order.state`) 화면은 문구(orders.state.*)와 색만 정한다.
 * 진행 중은 무채색, 배송 완료는 끝나고 잘 된 것, 닫힌 주문(취소·환불)은 회색
 */
export const ORDER_STATE_TONE = {
  awaitingPayment: "neutral",
  paid: "neutral",
  preparing: "neutral",
  shipping: "neutral",
  delivered: "done",
  returnInProgress: "neutral",
  exchangeInProgress: "neutral",
  refunding: "neutral",
  partiallyRefunded: "neutral",
  refunded: "muted",
  cancelled: "muted",
} as const satisfies Record<OrderState, BadgeTone>;

/** 진행 단계(결제완료 → 상품준비중 → 배송중 → 배송완료) — 단계 이름은 같은 상태 문구를 쓴다 */
export const ORDER_STEPS = [
  "paid",
  "preparing",
  "shipping",
  "delivered",
] as const satisfies readonly OrderState[];

/** 진행 단계가 없는 상태 — 결제 전이거나 닫힌 주문(취소·환불) */
const STEPLESS_STATES: readonly OrderState[] = [
  "awaitingPayment",
  "refunding",
  "refunded",
  "cancelled",
];

/** 배송 축 → 진행 단계 자리(ORDER_STEPS 의 순서) */
const STEP_BY_FULFILLMENT = { unfulfilled: 0, preparing: 1, shipped: 2, delivered: 3 } as const;

/**
 * 지금 몇 번째 단계까지 왔나(0부터). 단계가 없는 주문이면 null.
 * 단계는 상태 이름이 아니라 배송 축에서 읽는다 — 상태가 반품·교환 진행 중·부분환불을 말할 때도 배송이 어디까지 왔는지 보이게.
 */
export function orderStepIndex(order: Pick<Order, "state" | "fulfillmentStatus">): number | null {
  if (STEPLESS_STATES.includes(order.state)) return null;
  return STEP_BY_FULFILLMENT[order.fulfillmentStatus];
}

/**
 * 발송이 늦었나 — 서버가 준 발송기한(보낼 주문만 있다)이 지났다. 정책 v2 "발송이 늦어지면 먼저 알립니다. 발송 전이면 전액 취소할 수 있습니다".
 * 같은 날 손님에게 발송 지연 안내 메일도 간다(서버 스케줄).
 */
export function isShipDelayed({ shipBy }: { shipBy?: number }, now: number): boolean {
  return shipBy !== undefined && now > shipBy;
}
