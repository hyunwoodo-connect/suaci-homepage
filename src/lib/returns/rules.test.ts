import { describe, expect, it } from "vitest";

import type { Claim, Order } from "@/types";

import { canRequestReturn, kstDayEnd, returnQuote, returnWindow, returnableQty } from "./rules";

const ORDER: Order = {
  orderId: "o1",
  orderNo: "20261106-ABC123",
  status: "open",
  paymentStatus: "paid",
  fulfillmentStatus: "delivered",
  totals: {
    itemsSubtotal: 56000,
    discountTotal: 0,
    shippingFee: 3000,
    taxTotal: 0,
    grandTotal: 59000,
  },
  shippingAddress: { recipient: "지우", phone: "010", zipcode: "1", addr1: "a" },
  items: [
    {
      lineId: "l1",
      productId: "p1",
      variantId: "v1",
      sku: "S",
      productName: "take-01",
      optionName: "100 ml",
      unitPrice: 28000,
      compareAtPrice: 28000,
      quantity: 2,
      lineSubtotal: 56000,
    },
  ],
  deliveredAt: Date.parse("2026-11-05T15:00:00+09:00"),
  createdAt: 0,
  createdDtm: "",
};

function claim(over: Partial<Claim>): Claim {
  return {
    claimId: "c1",
    orderId: "o1",
    type: "return",
    status: "requested",
    reasonCode: "단순변심",
    lines: [{ lineId: "l1", productId: "p1", variantId: "v1", quantity: 1 }],
    refundAmount: 25000,
    refundedShipping: 0,
    returnShippingFee: 3000,
    createdAt: 0,
    createdDtm: "",
    ...over,
  };
}

describe("kstDayEnd", () => {
  it("받은 날은 세지 않고 7일째 끝(KST), 달 끝을 넘으면 다음 달로", () => {
    expect(kstDayEnd(Date.parse("2026-11-01T23:30:00+09:00"), { days: 7 })).toBe(
      Date.parse("2026-11-08T23:59:59.999+09:00"),
    );
    expect(kstDayEnd(Date.parse("2026-11-30T12:00:00+09:00"), { months: 3 })).toBe(
      Date.parse("2027-03-02T23:59:59.999+09:00"),
    );
  });
});

describe("returnWindow", () => {
  it("배송 완료 7일 안 → 둘 다 열림, 8일째 → 단순 변심만 닫힘, 3개월 뒤 → 다 닫힘", () => {
    expect(returnWindow(ORDER, Date.parse("2026-11-12T23:59:00+09:00"))).toEqual({
      open: true,
      changeOfMindOpen: true,
    });
    expect(returnWindow(ORDER, Date.parse("2026-11-13T00:00:01+09:00"))).toEqual({
      open: true,
      changeOfMindOpen: false,
    });
    expect(returnWindow(ORDER, Date.parse("2027-02-06T00:00:01+09:00")).open).toBe(false);
  });

  it("배송 완료 전 → 기한이 시작되지 않았다", () => {
    expect(returnWindow({ deliveredAt: undefined }, Date.parse("2030-01-01"))).toEqual({
      open: true,
      changeOfMindOpen: true,
    });
  });
});

describe("canRequestReturn", () => {
  const now = Date.parse("2026-11-10T12:00:00+09:00");

  it("결제됨·배송 완료·기한 안·진행 중 반품 없음 → 보인다", () => {
    expect(canRequestReturn(ORDER, [], now)).toBe(true);
  });

  it.each([
    ["발송 전", { fulfillmentStatus: "preparing" as const }],
    ["전액 환불", { paymentStatus: "refunded" as const }],
  ])("%s → 안 보인다", (_label, over) => {
    expect(canRequestReturn({ ...ORDER, ...over }, [], now)).toBe(false);
  });

  it("끝나지 않은 다른 환불(취소 failed)이 있거나 반품할 수량이 없으면 → 안 보인다", () => {
    expect(canRequestReturn(ORDER, [claim({ type: "cancel", status: "failed" })], now)).toBe(false);
    const allBack = claim({
      status: "completed",
      lines: [{ lineId: "l1", productId: "p1", variantId: "v1", quantity: 2 }],
    });
    expect(
      canRequestReturn({ ...ORDER, paymentStatus: "partially_refunded" }, [allBack], now),
    ).toBe(false);
  });

  it("진행 중 반품이 있으면 안 보이고, 거절됐으면 다시 보인다", () => {
    expect(canRequestReturn(ORDER, [claim({ status: "requested" })], now)).toBe(false);
    expect(canRequestReturn(ORDER, [claim({ status: "rejected" })], now)).toBe(true);
  });
});

describe("returnQuote", () => {
  it("단순 변심, 배송비 낸 주문 → 상품 금액 − 3,000원", () => {
    expect(returnQuote(ORDER, [], "단순변심")).toEqual({
      itemsAmount: 56000,
      returnShippingFee: 3000,
      refundedShipping: 0,
      refundAmount: 53000,
    });
  });

  it("단순 변심, 무료 배송 주문 → 처음 배송비까지 6,000원", () => {
    const free = { ...ORDER, totals: { ...ORDER.totals, shippingFee: 0, grandTotal: 56000 } };
    expect(returnQuote(free, [], "단순변심").returnShippingFee).toBe(6000);
  });

  it("무료 배송 주문의 두 번째 단순 변심 반품 → 처음 배송비는 이미 냈으니 편도만", () => {
    const free = { ...ORDER, totals: { ...ORDER.totals, shippingFee: 0, grandTotal: 56000 } };
    const first = claim({ status: "completed", returnShippingFee: 6000 });
    expect(returnQuote(free, [first], "단순변심")).toMatchObject({
      itemsAmount: 28000,
      returnShippingFee: 3000,
      refundAmount: 25000,
    });
  });

  it("하자 일부 반품 → 반품 배송비 0, 처음 배송비 3,000원 더함", () => {
    expect(returnQuote(ORDER, [], "상품하자", [{ lineId: "l1", quantity: 1 }])).toEqual({
      itemsAmount: 28000,
      returnShippingFee: 0,
      refundedShipping: 3000,
      refundAmount: 31000,
    });
  });

  it("이미 환불된 수량은 빼고, 처음 배송비를 이미 돌려줬으면 다시 안 더한다", () => {
    const done = claim({ status: "completed", reasonCode: "상품하자", refundedShipping: 3000 });
    expect(returnableQty(ORDER, [done])).toEqual({ l1: 1 });
    expect(returnQuote(ORDER, [done], "오배송")).toMatchObject({
      itemsAmount: 28000,
      refundedShipping: 0,
    });
  });
});
