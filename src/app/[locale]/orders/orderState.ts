import type { BadgeTone } from "@/components/ui/Badge";
import type { FulfillmentStatus, OrderStatus, PaymentStatus } from "@/types";

/** 손님에게 보이는 주문 상태 하나 — 백엔드의 세 축(주문·결제·배송)을 한 이름으로 접는다. 화면 이름은 orders.state.* */
export type OrderState =
  | "awaitingPayment"
  | "paid"
  | "preparing"
  | "shipping"
  | "delivered"
  | "refunding"
  | "partiallyRefunded"
  | "refunded"
  | "cancelled";

interface OrderStateInput {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
}

/**
 * 세 축 → 상태 이름 하나. 위에서부터 먼저 걸리는 것이 이긴다:
 * 끝난 주문(환불·취소) → 결제 전 → 배송 단계(상품준비중·배송중·배송완료) → 환불 진행 → 결제완료.
 * 백엔드는 전액 환불도 status 를 cancelled 로 두므로 환불완료를 주문취소보다 먼저 본다.
 */
export function orderState({
  status,
  paymentStatus,
  fulfillmentStatus,
}: OrderStateInput): OrderState {
  if (paymentStatus === "refunded") return "refunded";
  if (status === "cancelled" || paymentStatus === "voided") return "cancelled";
  if (status === "pending" || paymentStatus === "pending") return "awaitingPayment";
  if (fulfillmentStatus === "delivered") return "delivered";
  if (fulfillmentStatus === "shipped") return "shipping";
  if (fulfillmentStatus === "preparing") return "preparing";
  if (paymentStatus === "refunding") return "refunding";
  if (paymentStatus === "partially_refunded") return "partiallyRefunded";
  return "paid";
}

/** 상태 이름 → 뱃지 색. 진행 중은 무채색, 배송 완료는 끝나고 잘 된 것, 닫힌 주문(취소·환불)은 회색 */
export const ORDER_STATE_TONE = {
  awaitingPayment: "neutral",
  paid: "neutral",
  preparing: "neutral",
  shipping: "neutral",
  delivered: "done",
  refunding: "neutral",
  partiallyRefunded: "neutral",
  refunded: "muted",
  cancelled: "muted",
} as const satisfies Record<OrderState, BadgeTone>;

/**
 * 발송이 늦었나 — 서버가 준 발송기한(보낼 주문만 있다)이 지났다. 정책 v2 "발송이 늦어지면 먼저 알립니다. 발송 전이면 전액 취소할 수 있습니다".
 * 같은 날 손님에게 발송 지연 안내 메일도 간다(서버 스케줄).
 */
export function isShipDelayed({ shipBy }: { shipBy?: number }, now: number): boolean {
  return shipBy !== undefined && now > shipBy;
}
