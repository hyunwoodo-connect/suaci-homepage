import { describe, expect, it, vi } from "vitest";

import { BRANDPAY_LABEL } from "@/constants/checkout";
import {
  adapterFor,
  availableMethods,
  createMockAdapter,
  defaultMethod,
  methodFromLabel,
  parsePaymentReturn,
  PAY_METHOD_LABEL,
  selectPaymentAdapters,
} from "./providers";

const input = {
  orderId: "o1",
  orderNo: "20261026-ABC123",
  orderName: "[제품명] 1개",
  amount: 31000,
  customerKey: "u1",
  successPath: "/pay/complete?o=o1",
  failPath: "/pay/fail?o=o1",
};

describe("selectPaymentAdapters", () => {
  it("토스 키 있으면 아직 [](위젯 어댑터 전) / 운영+http 면 [] / 그 외 목업 1개(수단 4)", () => {
    const deps = { origin: "https://x", navigate: vi.fn() };
    expect(
      selectPaymentAdapters({ tossClientKey: "ck", apiMode: "http", nodeEnv: "production" }, deps),
    ).toEqual([]);
    expect(selectPaymentAdapters({ apiMode: "http", nodeEnv: "production" }, deps)).toEqual([]);
    const mock = selectPaymentAdapters({ apiMode: "mock", nodeEnv: "production" }, deps);
    expect(mock).toHaveLength(1);
    expect(availableMethods(mock)).toEqual(["BRANDPAY", "KAKAOPAY", "NAVERPAY", "CARD"]);
    expect(adapterFor(mock, "NAVERPAY")?.id).toBe("mock");
    expect(adapterFor([], "CARD")).toBeNull();
  });
});

describe("createMockAdapter", () => {
  it("request → success 경로로 mock_{수단}_{키} 를 붙여 navigate", async () => {
    const navigate = vi.fn();
    const adapter = createMockAdapter({ origin: "https://x", navigate, newKey: () => "k1234567" });
    await adapter.request("BRANDPAY", input);
    expect(navigate).toHaveBeenCalledWith(
      "https://x/pay/complete?o=o1&paymentKey=mock_BRANDPAY_k1234567&orderId=20261026-ABC123&amount=31000",
    );
  });
});

describe("parsePaymentReturn", () => {
  it("정상 → {paymentKey, orderNo, amount}", () => {
    const q = new URLSearchParams({
      paymentKey: "mock_CARD_abc",
      orderId: "20261026-A",
      amount: "31000",
    });
    expect(parsePaymentReturn(q)).toEqual({
      paymentKey: "mock_CARD_abc",
      orderNo: "20261026-A",
      amount: 31000,
    });
  });
  it("amount 소수·paymentKey 없음 → null", () => {
    expect(
      parsePaymentReturn(new URLSearchParams({ paymentKey: "k", orderId: "n", amount: "1.5" })),
    ).toBeNull();
    expect(parsePaymentReturn(new URLSearchParams({ orderId: "n", amount: "1" }))).toBeNull();
  });
});

describe("methodFromLabel / defaultMethod / 라벨", () => {
  it("백엔드 수단 이름 → 수단 id", () => {
    expect(methodFromLabel("간편결제(네이버페이)")).toBe("NAVERPAY");
    expect(methodFromLabel("간편결제(카카오페이)")).toBe("KAKAOPAY");
    expect(methodFromLabel("브랜드페이")).toBe("BRANDPAY");
    expect(methodFromLabel("카드")).toBe("CARD");
    expect(methodFromLabel("가상계좌")).toBeNull();
    expect(methodFromLabel(null)).toBeNull();
  });
  it("기본 수단: 지난 수단 ?? 로그인 프로바이더 페이 ?? CARD", () => {
    expect(defaultMethod({ lastPaymentMethod: "브랜드페이", loginProvider: "naver" })).toBe(
      "BRANDPAY",
    );
    expect(defaultMethod({ lastPaymentMethod: null, loginProvider: "kakao" })).toBe("KAKAOPAY");
    expect(defaultMethod({ lastPaymentMethod: null, loginProvider: "naver" })).toBe("NAVERPAY");
    expect(defaultMethod({ lastPaymentMethod: null, loginProvider: null })).toBe("CARD");
  });
  it("BRANDPAY 라벨은 가칭 상수를 그대로", () => {
    expect(PAY_METHOD_LABEL.BRANDPAY).toBe(BRANDPAY_LABEL);
  });
});
