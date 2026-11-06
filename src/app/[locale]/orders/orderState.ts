import type { BadgeTone } from "@/components/ui/Badge";
import type { ClaimStatus, FulfillmentStatus, OrderStatus, PaymentStatus } from "@/types";

/** 손님에게 보이는 주문 상태 하나 — 백엔드의 세 축(주문·결제·배송)을 한 이름으로 접는다. 화면 이름은 orders.state.* */
export type OrderState =
  | "awaitingPayment"
  | "paid"
  | "partiallyShipped"
  | "shipping"
  | "refunding"
  | "partiallyRefunded"
  | "refunded"
  | "cancelled"
  | "returned";

interface OrderStateInput {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  /** 주문 목록(OrderSummary)에는 아직 없다 — 없으면 배송 단계 없이 결제 축으로만 정한다 */
  fulfillmentStatus?: FulfillmentStatus;
}

/**
 * 세 축 → 상태 이름 하나. 위에서부터 먼저 걸리는 것이 이긴다:
 * 끝난 주문(반품·환불·취소) → 결제 전 → 배송 단계 → 환불 진행 → 결제완료.
 * 백엔드는 전액 환불도 status 를 cancelled 로 두므로 환불완료를 주문취소보다 먼저 본다.
 */
export function orderState({
  status,
  paymentStatus,
  fulfillmentStatus,
}: OrderStateInput): OrderState {
  if (fulfillmentStatus === "returned") return "returned";
  if (paymentStatus === "refunded") return "refunded";
  if (status === "cancelled" || paymentStatus === "voided") return "cancelled";
  if (status === "pending" || paymentStatus === "pending") return "awaitingPayment";
  if (fulfillmentStatus === "fulfilled") return "shipping";
  if (fulfillmentStatus === "partially_fulfilled") return "partiallyShipped";
  if (paymentStatus === "refunding") return "refunding";
  if (paymentStatus === "partially_refunded") return "partiallyRefunded";
  return "paid";
}

/** 상태 이름 → 뱃지 색. 진행 중은 무채색, 닫힌 주문(취소·환불·반품)은 회색 */
export const ORDER_STATE_TONE = {
  awaitingPayment: "neutral",
  paid: "neutral",
  partiallyShipped: "neutral",
  shipping: "neutral",
  refunding: "neutral",
  partiallyRefunded: "neutral",
  refunded: "muted",
  cancelled: "muted",
  returned: "muted",
} as const satisfies Record<OrderState, BadgeTone>;

/** 취소·환불 신청 상태 → 뱃지 색. 승인은 잘 끝난 것, 환불 완료는 닫힌 것(주문의 환불완료와 같은 회색), 거절·지연은 알아야 할 문제 */
export const CLAIM_STATUS_TONE = {
  requested: "neutral",
  approved: "done",
  completed: "muted",
  rejected: "problem",
  failed: "problem",
} as const satisfies Record<ClaimStatus, BadgeTone>;
