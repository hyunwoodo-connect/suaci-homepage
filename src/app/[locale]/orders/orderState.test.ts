import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import ko from "@/messages/ko.json";

import { isShipDelayed, ORDER_STATE_TONE, orderStepIndex } from "./orderState";

describe("orders.state 문구", () => {
  // 색 표(ORDER_STATE_TONE)의 키는 컴파일 때 서버 상태 이름과 정확히 같다(satisfies) — 문구 키를 그 표와 맞춘다
  it.each([
    ["ko", ko],
    ["en", en],
    ["ja", ja],
  ])("%s: 문구 키가 서버 상태 이름과 정확히 같다(빠진 이름·남은 이름 없음)", (_locale, catalog) => {
    const messageKeys = Object.keys(catalog.orders.state).sort();
    const stateNames = Object.keys(ORDER_STATE_TONE).sort();
    expect(messageKeys).toEqual(stateNames);
  });
});

describe("orderStepIndex", () => {
  it("결제완료 0 → 상품준비중 1 → 배송중 2 → 배송완료 3", () => {
    expect(orderStepIndex({ state: "paid", fulfillmentStatus: "unfulfilled" })).toBe(0);
    expect(orderStepIndex({ state: "preparing", fulfillmentStatus: "preparing" })).toBe(1);
    expect(orderStepIndex({ state: "shipping", fulfillmentStatus: "shipped" })).toBe(2);
    expect(orderStepIndex({ state: "delivered", fulfillmentStatus: "delivered" })).toBe(3);
  });

  it("상태가 반품·교환 진행 중·부분환불을 말해도 → 배송이 어디까지 왔는지 그대로", () => {
    expect(orderStepIndex({ state: "returnInProgress", fulfillmentStatus: "shipped" })).toBe(2);
    expect(orderStepIndex({ state: "exchangeInProgress", fulfillmentStatus: "delivered" })).toBe(3);
    expect(orderStepIndex({ state: "partiallyRefunded", fulfillmentStatus: "unfulfilled" })).toBe(
      0,
    );
    expect(orderStepIndex({ state: "partiallyRefunded", fulfillmentStatus: "delivered" })).toBe(3);
  });

  it.each(["awaitingPayment", "cancelled", "refunding", "refunded"] as const)(
    "%s(결제 전·닫힌 주문) → 단계 없음",
    (state) => {
      expect(orderStepIndex({ state, fulfillmentStatus: "unfulfilled" })).toBeNull();
      expect(orderStepIndex({ state, fulfillmentStatus: "delivered" })).toBeNull();
    },
  );
});

describe("isShipDelayed", () => {
  it("발송기한이 지났다 → true, 기한 전·기한 없음(발송됨·테스트 결제) → false", () => {
    expect(isShipDelayed({ shipBy: 100 }, 101)).toBe(true);
    expect(isShipDelayed({ shipBy: 100 }, 100)).toBe(false);
    expect(isShipDelayed({}, 101)).toBe(false);
  });
});
