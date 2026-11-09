import { CHECKOUT_PRICING } from "@/constants/checkout";
import type {
  Claim,
  ClaimStatus,
  ClaimType,
  ExchangeReason,
  FulfillmentStatus,
  Order,
  ReturnReason,
} from "@/types";

/** 반품 사유(화면 순서). 배송 지연·기타는 반품 사유가 아니다(발송 전 취소에서만) */
export const RETURN_REASONS: readonly ReturnReason[] = [
  "단순변심",
  "상품하자",
  "오배송",
  "표시광고상이",
];

/** 교환 사유(화면 순서) — 회사 탓만. 단순 변심은 반품 후 새 주문(왕복 배송비가 같다) */
export const EXCHANGE_REASONS: readonly ExchangeReason[] = ["상품하자", "오배송", "표시광고상이"];

/** 돈을 돌려주는 클레임 — 교환은 환불하지 않아 남은 수량·진행 중 환불에 세지 않는다 */
const REFUND_TYPES: readonly ClaimType[] = ["cancel", "return"];
/** 환불이 시작됐거나 끝난 클레임 상태 — 그 수량·배송비는 이미 돌아간 것으로 센다 */
const REFUNDING: readonly ClaimStatus[] = ["approved", "failed", "completed"];
/** 환불이 시작됐지만 끝나지 않은 상태(취소·반품 모두) */
const IN_FLIGHT: readonly ClaimStatus[] = ["approved", "failed"];
/** 아직 끝나지 않은 반품·교환 상태 — 둘을 합쳐 주문당 하나만 열 수 있다(서버 RETURN_ALREADY_REQUESTED) */
const OPEN_AFTER_DELIVERY: Readonly<Partial<Record<ClaimType, readonly ClaimStatus[]>>> = {
  return: ["requested", "approved", "failed"],
  exchange: ["requested", "received", "shipped"],
};
/** 손님이 철회할 수 있는 클레임 — 회수 확인 전(신청 상태)의 반품·교환 */
const WITHDRAWABLE: readonly ClaimType[] = ["return", "exchange"];

/** 환불이 시작됐거나 끝난 취소·반품 */
function isRefunded(c: Claim): boolean {
  return REFUND_TYPES.includes(c.type) && REFUNDING.includes(c.status);
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * `at` 의 KST 날짜에서 days일·months개월 뒤 그날의 끝(23:59:59.999 KST). suaci-api `TimeUtil.kstDayEnd` 와 같은 셈 —
 * '받은 날부터 7일'은 받은 날을 세지 않고 마지막 날 끝까지, 없는 날(2/30)은 다음 달로 넘긴다
 */
export function kstDayEnd(at: number, offset: { days?: number; months?: number }): number {
  const instant = new Date(at);
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(instant)
    .split("-")
    .map(Number);
  const monthIndex = m - 1 + (offset.months ?? 0);
  const dayAfterLast = d + (offset.days ?? 0) + 1;
  return Date.UTC(y, monthIndex, dayAfterLast) - KST_OFFSET_MS - 1;
}

/** 반품 신청 기한(환불 정책 v2): 배송 완료부터 단순 변심 7일, 하자·오배송·표시와 다름 3개월. 배송 완료 전이면 둘 다 열려 있다 */
export function returnWindow(
  order: Pick<Order, "deliveredAt">,
  now: number,
): { open: boolean; changeOfMindOpen: boolean } {
  if (order.deliveredAt === undefined) return { open: true, changeOfMindOpen: true };
  return {
    open: now <= kstDayEnd(order.deliveredAt, { months: 3 }),
    changeOfMindOpen: now <= kstDayEnd(order.deliveredAt, { days: 7 }),
  };
}

/** 손님이 취소 요청할 수 있는 배송 상태 — 발송 전까지(환불 정책 v2 '발송 전 취소는 바로 환불') */
const BEFORE_SHIPMENT: readonly FulfillmentStatus[] = ["unfulfilled", "preparing"];

/** 결제를 받았고 전액 환불되지 않은 주문 */
function isPaid(order: Order): boolean {
  return order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded";
}

/** 결제됐고 발송된(배송중·배송완료) 주문 — 취소 대신 반품·교환의 길 */
export function isShippedPaid(order: Order): boolean {
  return (
    isPaid(order) &&
    (order.fulfillmentStatus === "shipped" || order.fulfillmentStatus === "delivered")
  );
}

/** 배송지를 손님이 바꿀 수 있나 — 결제됐고 상품 준비 전(관리자가 포장을 시작하면 막힌다). suaci-api 가 같은 조건으로 막는다 */
export function canChangeShippingAddress(order: Order): boolean {
  return isPaid(order) && order.fulfillmentStatus === "unfulfilled";
}

/** 손님이 '신청 철회'할 수 있나 — 신청 상태(회수 확인 전)의 반품·교환 */
export function canWithdraw(claim: Claim): boolean {
  return WITHDRAWABLE.includes(claim.type) && claim.status === "requested";
}

/** 취소 요청 버튼을 보일지 — 결제됨·발송 전·취소할 수량이 남음. suaci-api 가 같은 조건으로 막는다 */
export function canRequestCancel(order: Order, claims: Claim[]): boolean {
  return (
    isPaid(order) &&
    BEFORE_SHIPMENT.includes(order.fulfillmentStatus) &&
    Object.values(remainingQty(order, claims)).some((n) => n > 0)
  );
}

/**
 * 반품·교환 신청 버튼을 보일지(조건이 같다) — 결제됨·발송 뒤·진행 중 반품·교환 없음·끝나지 않은 환불 없음·남은 수량·
 * 배송 완료 3개월 안. suaci-api 가 같은 조건으로 막는다(끝나지 않은 환불과 겹치면 확정이 꼬여서)
 */
export function canRequestAfterDelivery(order: Order, claims: Claim[], now: number): boolean {
  const hasUnits = Object.values(remainingQty(order, claims)).some((n) => n > 0);
  return (
    isShippedPaid(order) &&
    !hasOpenAfterDelivery(claims) &&
    !hasRefundInFlight(claims) &&
    hasUnits &&
    returnWindow(order, now).open
  );
}

/** 끝나지 않은 반품·교환이 있나 — 주문당 하나만 열 수 있다 */
export function hasOpenAfterDelivery(claims: Claim[]): boolean {
  return claims.some((c) => OPEN_AFTER_DELIVERY[c.type]?.includes(c.status));
}

/** 진행 중인 받은 뒤 클레임의 종류(반품·교환) — 주문 상태 이름이 '배송완료'로만 보이지 않게. 없으면 undefined */
export function openAfterDeliveryType(claims: Claim[]): "return" | "exchange" | undefined {
  const open = claims.find((c) => OPEN_AFTER_DELIVERY[c.type]?.includes(c.status));
  return open?.type === "return" || open?.type === "exchange" ? open.type : undefined;
}

/** 환불을 시작했지만 끝나지 않은 취소·반품이 있나 — 그동안 다른 환불·교환을 시작하지 않는다(서버 환불 잠금) */
export function hasRefundInFlight(claims: Claim[]): boolean {
  return claims.some((c) => REFUND_TYPES.includes(c.type) && IN_FLIGHT.includes(c.status));
}

/** 줄마다 남은 수량(취소·반품·교환할 수 있는 수량) = 주문 수량 − 환불이 시작됐거나 끝난 취소·반품 수량 */
export function remainingQty(order: Order, claims: Claim[]): Record<string, number> {
  const taken: Record<string, number> = {};
  for (const c of claims) {
    if (!isRefunded(c)) continue;
    for (const l of c.lines) taken[l.lineId] = (taken[l.lineId] ?? 0) + l.quantity;
  }
  return Object.fromEntries(
    order.items.map((i) => [i.lineId, Math.max(0, i.quantity - (taken[i.lineId] ?? 0))]),
  );
}

/** 예상 환불 금액 나눠 보기. 최종 금액은 서버가 신청 때 정한다(같은 규칙) */
export interface ReturnQuote {
  itemsAmount: number;
  /** 손님 부담 반품 배송비(단순 변심) */
  returnShippingFee: number;
  /** 돌려주는 처음 배송비(회사 탓) */
  refundedShipping: number;
  refundAmount: number;
}

/**
 * 예상 환불 금액(환불 정책 v2). 단순 변심은 반품 배송비 편도(무료 배송 주문이면 처음 배송비까지)를 빼고,
 * 회사 탓은 처음 낸 배송비를 (아직 안 돌려줬으면) 더한다. `lines` 가 없으면 남은 수량 전부
 */
export function returnQuote(
  order: Order,
  claims: Claim[],
  reason: ReturnReason,
  lines?: { lineId: string; quantity: number }[],
): ReturnQuote {
  const left = remainingQty(order, claims);
  const chosen =
    lines ?? order.items.map((i) => ({ lineId: i.lineId, quantity: left[i.lineId] ?? 0 }));
  const itemsAmount = chosen.reduce((sum, l) => {
    const item = order.items.find((i) => i.lineId === l.lineId);
    return sum + (item ? item.unitPrice * l.quantity : 0);
  }, 0);
  const fee = CHECKOUT_PRICING.shippingFee;
  const customerFault = reason === "단순변심";
  const shippingAlreadyBack = claims.some((c) => isRefunded(c) && c.refundedShipping > 0);
  // 무료 배송 주문의 처음 배송비는 주문당 한 번 — 앞선 단순 변심 반품이 냈으면(편도보다 많이 뺐으면) 다시 안 뺀다
  const outboundCharged = claims.some(
    (c) => c.type === "return" && c.status === "completed" && c.returnShippingFee > fee,
  );
  const outbound = order.totals.shippingFee === 0 && !outboundCharged ? fee : 0;
  const returnShippingFee = customerFault ? fee + outbound : 0;
  const refundedShipping = !customerFault && !shippingAlreadyBack ? order.totals.shippingFee : 0;
  return {
    itemsAmount,
    returnShippingFee,
    refundedShipping,
    refundAmount: itemsAmount + refundedShipping - returnShippingFee,
  };
}
