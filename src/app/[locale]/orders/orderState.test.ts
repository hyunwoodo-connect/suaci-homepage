import { describe, expect, it } from "vitest";

import { isShipDelayed, orderState, orderStepIndex } from "./orderState";

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

  it("관리 툴이 배송 준비를 시작 → 상품준비중", () => {
    expect(
      orderState({ status: "open", paymentStatus: "paid", fulfillmentStatus: "preparing" }),
    ).toBe("preparing");
  });

  it("발송됨(shipped) → 배송중", () => {
    expect(
      orderState({ status: "open", paymentStatus: "paid", fulfillmentStatus: "shipped" }),
    ).toBe("shipping");
  });

  it("배송 완료(delivered) → 배송완료", () => {
    expect(
      orderState({ status: "open", paymentStatus: "paid", fulfillmentStatus: "delivered" }),
    ).toBe("delivered");
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
        fulfillmentStatus: "shipped",
      }),
    ).toBe("shipping");
  });

  it("환불 진행 중 → 환불 처리 중", () => {
    expect(
      orderState({ status: "open", paymentStatus: "refunding", fulfillmentStatus: "unfulfilled" }),
    ).toBe("refunding");
  });

  it("자동 환불 중(재고 부족 — status pending, 닫힌 뒤 잡힌 결제 — status cancelled) → 결제 대기·취소가 아니라 환불 처리 중", () => {
    expect(
      orderState({
        status: "pending",
        paymentStatus: "refunding",
        fulfillmentStatus: "unfulfilled",
      }),
    ).toBe("refunding");
    expect(
      orderState({
        status: "cancelled",
        paymentStatus: "refunding",
        fulfillmentStatus: "unfulfilled",
      }),
    ).toBe("refunding");
  });

  it("배송 완료 뒤 반품·교환 진행 중 → 그 이름(배송완료로만 보이지 않게), 목록은 종류 없이", () => {
    const delivered = {
      status: "open",
      paymentStatus: "paid",
      fulfillmentStatus: "delivered",
    } as const;
    expect(orderState({ ...delivered, openClaim: "return" })).toBe("returnInProgress");
    expect(orderState({ ...delivered, openClaim: "exchange" })).toBe("exchangeInProgress");
    expect(orderState({ ...delivered, openClaim: "any" })).toBe("claimInProgress");
  });

  it("받은 뒤 일부 환불(반품 환불) → 배송완료보다 부분환불", () => {
    expect(
      orderState({
        status: "open",
        paymentStatus: "partially_refunded",
        fulfillmentStatus: "delivered",
      }),
    ).toBe("partiallyRefunded");
  });

  it("끝난 주문(환불완료)은 진행 중 클레임 표시보다 먼저", () => {
    expect(
      orderState({
        status: "cancelled",
        paymentStatus: "refunded",
        fulfillmentStatus: "delivered",
        openClaim: "return",
      }),
    ).toBe("refunded");
  });

  it("배송 전 결제 주문 → 결제완료", () => {
    expect(
      orderState({ status: "open", paymentStatus: "paid", fulfillmentStatus: "unfulfilled" }),
    ).toBe("paid");
  });
});

describe("orderStepIndex", () => {
  it("결제완료 0 → 상품준비중 1 → 배송중 2 → 배송완료 3", () => {
    const paid = { status: "open", paymentStatus: "paid" } as const;
    expect(orderStepIndex({ ...paid, fulfillmentStatus: "unfulfilled" })).toBe(0);
    expect(orderStepIndex({ ...paid, fulfillmentStatus: "preparing" })).toBe(1);
    expect(orderStepIndex({ ...paid, fulfillmentStatus: "shipped" })).toBe(2);
    expect(orderStepIndex({ ...paid, fulfillmentStatus: "delivered" })).toBe(3);
  });

  it("결제 대기·취소·전액 환불 → 단계 없음", () => {
    expect(
      orderStepIndex({
        status: "pending",
        paymentStatus: "pending",
        fulfillmentStatus: "unfulfilled",
      }),
    ).toBeNull();
    expect(
      orderStepIndex({
        status: "cancelled",
        paymentStatus: "voided",
        fulfillmentStatus: "unfulfilled",
      }),
    ).toBeNull();
    expect(
      orderStepIndex({
        status: "cancelled",
        paymentStatus: "refunded",
        fulfillmentStatus: "delivered",
      }),
    ).toBeNull();
  });
});

describe("isShipDelayed", () => {
  it("발송기한이 지났다 → true, 기한 전·기한 없음(발송됨·테스트 결제) → false", () => {
    expect(isShipDelayed({ shipBy: 100 }, 101)).toBe(true);
    expect(isShipDelayed({ shipBy: 100 }, 100)).toBe(false);
    expect(isShipDelayed({}, 101)).toBe(false);
  });
});
