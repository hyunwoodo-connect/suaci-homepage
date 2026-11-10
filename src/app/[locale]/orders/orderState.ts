import type { BadgeTone } from "@/components/ui/Badge";
import type { FulfillmentStatus, OrderStatus, PaymentStatus } from "@/types";

/** 손님에게 보이는 주문 상태 하나 — 백엔드의 세 축(주문·결제·배송)을 한 이름으로 접는다. 화면 이름은 orders.state.* */
export type OrderState =
  | "awaitingPayment"
  | "paid"
  | "preparing"
  | "shipping"
  | "delivered"
  | "returnInProgress"
  | "exchangeInProgress"
  | "claimInProgress"
  | "refunding"
  | "partiallyRefunded"
  | "refunded"
  | "cancelled";

interface OrderStateInput {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  /**
   * 진행 중인 반품·교환 — 상세는 클레임에서 종류까지(`return`·`exchange`), 목록은 있다는 것만(`any`).
   * 없으면 undefined
   */
  openClaim?: "return" | "exchange" | "any";
}

/** 진행 중인 반품·교환 → 상태 이름 */
const OPEN_CLAIM_STATE = {
  return: "returnInProgress",
  exchange: "exchangeInProgress",
  any: "claimInProgress",
} as const satisfies Record<NonNullable<OrderStateInput["openClaim"]>, OrderState>;

/**
 * 세 축(+진행 중 반품·교환) → 상태 이름 하나. 위에서부터 먼저 걸리는 것이 이긴다:
 * 환불완료 → 환불 진행 → 취소 → 결제 전 → 진행 중 반품·교환 → 받은 뒤 일부 환불 → 배송 단계 → 일부 환불 → 결제완료.
 * 결제 단위 환불 진행(refunding)은 자동 환불(재고 부족·닫힌 뒤 잡힌 결제)뿐이고 그때 주문 status 는 pending·cancelled 그대로라
 * 그보다 먼저 본다 — 멈춘 자동 환불이 '결제 대기'로 보여 결제하기·취소 버튼이 뜨지 않게(유즈케이스 리뷰 E1).
 * 손님에게 가장 최근에 일어난 일을 하나로 — 반품을 신청했거나 환불된 주문이 '배송완료'로만 보이지 않게(UX 리뷰 E1).
 * 배송 단계는 상세의 진행 단계가 따로 보인다. 백엔드는 전액 환불도 status 를 cancelled 로 두므로 환불완료를 주문취소보다 먼저 본다.
 */
export function orderState({
  status,
  paymentStatus,
  fulfillmentStatus,
  openClaim,
}: OrderStateInput): OrderState {
  if (paymentStatus === "refunded") return "refunded";
  if (paymentStatus === "refunding") return "refunding";
  if (status === "cancelled" || paymentStatus === "voided") return "cancelled";
  if (status === "pending" || paymentStatus === "pending") return "awaitingPayment";
  if (openClaim) return OPEN_CLAIM_STATE[openClaim];
  // 받은 뒤의 일부 환불(반품 환불)은 배송완료보다 새 소식이다 — 보내기 전·보내는 중의 일부 취소는 배송 단계가 먼저
  if (fulfillmentStatus === "delivered" && paymentStatus === "partially_refunded") {
    return "partiallyRefunded";
  }
  if (fulfillmentStatus === "delivered") return "delivered";
  if (fulfillmentStatus === "shipped") return "shipping";
  if (fulfillmentStatus === "preparing") return "preparing";
  if (paymentStatus === "partially_refunded") return "partiallyRefunded";
  return "paid";
}

/** 진행 단계(결제완료 → 상품준비중 → 배송중 → 배송완료) — 결제 대기·취소·환불완료 주문은 없음(null) */
export const ORDER_STEPS = ["paid", "preparing", "shipping", "delivered"] as const;

/** 지금 몇 번째 단계까지 왔나(0부터). 단계가 없는 주문이면 null */
export function orderStepIndex(o: OrderStateInput): number | null {
  if (
    o.paymentStatus === "refunded" ||
    o.paymentStatus === "voided" ||
    o.paymentStatus === "pending"
  ) {
    return null;
  }
  if (o.status === "cancelled" || o.status === "pending") return null;
  const byFulfillment = { unfulfilled: 0, preparing: 1, shipped: 2, delivered: 3 } as const;
  return byFulfillment[o.fulfillmentStatus];
}

/** 상태 이름 → 뱃지 색. 진행 중은 무채색, 배송 완료는 끝나고 잘 된 것, 닫힌 주문(취소·환불)은 회색 */
export const ORDER_STATE_TONE = {
  awaitingPayment: "neutral",
  paid: "neutral",
  preparing: "neutral",
  shipping: "neutral",
  delivered: "done",
  returnInProgress: "neutral",
  exchangeInProgress: "neutral",
  claimInProgress: "neutral",
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
