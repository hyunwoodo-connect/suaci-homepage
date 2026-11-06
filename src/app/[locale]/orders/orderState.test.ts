import { describe, expect, it } from "vitest";

import { orderState } from "./orderState";

describe("orderState", () => {
  it("결제 전(pending) → 결제 대기", () => {
    expect(
      orderState({ status: "pending", paymentStatus: "pending", fulfillmentStatus: "unfulfilled" }),
    ).toBe("awaitingPayment");
  });

  it("결제했고 아직 안 보냄 → 결제완료", () => {
    expect(
      orderState({ status: "open", paymentStatus: "paid", fulfillmentStatus: "unfulfilled" }),
    ).toBe("paid");
  });

  it("승인(authorized)도 손님에겐 결제완료", () => {
    expect(
      orderState({ status: "open", paymentStatus: "authorized", fulfillmentStatus: "unfulfilled" }),
    ).toBe("paid");
  });

  it("일부만 보냄 → 부분 발송", () => {
    expect(
      orderState({
        status: "open",
        paymentStatus: "paid",
        fulfillmentStatus: "partially_fulfilled",
      }),
    ).toBe("partiallyShipped");
  });

  it("다 보냄(fulfilled) → 배송중", () => {
    expect(
      orderState({ status: "open", paymentStatus: "paid", fulfillmentStatus: "fulfilled" }),
    ).toBe("shipping");
  });

  it("결제 전에 취소 → 주문취소", () => {
    expect(
      orderState({
        status: "cancelled",
        paymentStatus: "pending",
        fulfillmentStatus: "unfulfilled",
      }),
    ).toBe("cancelled");
  });

  it("시간이 지나 닫힌 주문(voided) → 주문취소", () => {
    expect(
      orderState({
        status: "cancelled",
        paymentStatus: "voided",
        fulfillmentStatus: "unfulfilled",
      }),
    ).toBe("cancelled");
  });

  it("전액 환불(백엔드는 status 도 cancelled) → 주문취소가 아니라 환불완료", () => {
    expect(
      orderState({
        status: "cancelled",
        paymentStatus: "refunded",
        fulfillmentStatus: "unfulfilled",
      }),
    ).toBe("refunded");
  });

  it("일부 환불 → 부분환불", () => {
    expect(
      orderState({
        status: "open",
        paymentStatus: "partially_refunded",
        fulfillmentStatus: "unfulfilled",
      }),
    ).toBe("partiallyRefunded");
  });

  it("일부 환불 뒤 남은 걸 보냄 → 배송 단계가 먼저(배송중)", () => {
    expect(
      orderState({
        status: "open",
        paymentStatus: "partially_refunded",
        fulfillmentStatus: "fulfilled",
      }),
    ).toBe("shipping");
  });

  it("환불 진행 중 → 환불 처리 중", () => {
    expect(
      orderState({ status: "open", paymentStatus: "refunding", fulfillmentStatus: "unfulfilled" }),
    ).toBe("refunding");
  });

  it("반품 → 반품완료(환불 상태보다 먼저)", () => {
    expect(
      orderState({ status: "cancelled", paymentStatus: "refunded", fulfillmentStatus: "returned" }),
    ).toBe("returned");
  });

  it("목록(배송 축 없음)에서 결제했으면 → 결제완료", () => {
    expect(orderState({ status: "open", paymentStatus: "paid" })).toBe("paid");
  });
});
