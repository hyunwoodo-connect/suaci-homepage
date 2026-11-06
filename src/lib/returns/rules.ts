import { CHECKOUT_PRICING } from "@/constants/checkout";
import type { Claim, ClaimStatus, Order, ReturnReason } from "@/types";

/** 반품 사유(화면 순서). 배송 지연·기타는 반품 사유가 아니다(발송 전 취소에서만) */
export const RETURN_REASONS: readonly ReturnReason[] = [
  "단순변심",
  "상품하자",
  "오배송",
  "표시광고상이",
];

/** 환불이 시작됐거나 끝난 클레임 상태 — 그 수량·배송비는 이미 돌아간 것으로 센다 */
const REFUNDING: readonly ClaimStatus[] = ["approved", "failed", "completed"];
/** 환불이 시작됐지만 끝나지 않은 상태(취소·반품 모두) */
const IN_FLIGHT: readonly ClaimStatus[] = ["approved", "failed"];
/** 아직 끝나지 않은 반품 상태 — 주문당 하나만 열 수 있다 */
const OPEN_RETURN: readonly ClaimStatus[] = ["requested", "approved", "failed"];

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * `at` 의 KST 날짜에서 days일·months개월 뒤 그날의 끝(23:59:59.999 KST). suaci-api `TimeUtil.kstDayEnd` 와 같은 셈 —
 * '받은 날부터 7일'은 받은 날을 세지 않고 마지막 날 끝까지, 없는 날(2/30)은 다음 달로 넘긴다
 */
export function kstDayEnd(at: number, offset: { days?: number; months?: number }): number {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(at))
    .split("-")
    .map(Number);
  return Date.UTC(y, m - 1 + (offset.months ?? 0), d + (offset.days ?? 0) + 1) - KST_OFFSET_MS - 1;
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

/**
 * 반품 신청 버튼을 보일지 — 결제됨·발송 뒤·진행 중 반품 없음·끝나지 않은 다른 환불 없음·반품할 수량 남음·기한 안.
 * suaci-api 가 같은 조건으로 막는다(끝나지 않은 환불과 겹치면 확정이 꼬여서)
 */
export function canRequestReturn(order: Order, claims: Claim[], now: number): boolean {
  const paid = order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded";
  const shipped = order.fulfillmentStatus === "shipped" || order.fulfillmentStatus === "delivered";
  const hasOpenReturn = claims.some((c) => c.type === "return" && OPEN_RETURN.includes(c.status));
  const refundInFlight = claims.some((c) => IN_FLIGHT.includes(c.status));
  const hasUnits = Object.values(returnableQty(order, claims)).some((n) => n > 0);
  return (
    paid &&
    shipped &&
    !hasOpenReturn &&
    !refundInFlight &&
    hasUnits &&
    returnWindow(order, now).open
  );
}

/** 줄마다 아직 반품할 수 있는 수량 = 주문 수량 − 환불이 시작됐거나 끝난 클레임 수량 */
export function returnableQty(order: Order, claims: Claim[]): Record<string, number> {
  const taken: Record<string, number> = {};
  for (const c of claims) {
    if (!REFUNDING.includes(c.status)) continue;
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
  const left = returnableQty(order, claims);
  const chosen =
    lines ?? order.items.map((i) => ({ lineId: i.lineId, quantity: left[i.lineId] ?? 0 }));
  const itemsAmount = chosen.reduce((sum, l) => {
    const item = order.items.find((i) => i.lineId === l.lineId);
    return sum + (item ? item.unitPrice * l.quantity : 0);
  }, 0);
  const fee = CHECKOUT_PRICING.shippingFee;
  const customerFault = reason === "단순변심";
  const shippingAlreadyBack = claims.some(
    (c) => REFUNDING.includes(c.status) && c.refundedShipping > 0,
  );
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
