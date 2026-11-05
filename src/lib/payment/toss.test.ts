import { describe, expect, it, vi } from "vitest";

import { createTossAdapter, isTestClientKey } from "./toss";

const input = {
  orderId: "o1",
  orderNo: "20261105-ABC123",
  orderName: "라임바질 페이셜 세럼 미스트 1",
  amount: 31000,
  customerKey: "u1",
  successPath: "/pay/complete?o=o1",
  failPath: "/pay/fail?o=o1",
};

function fakeSdk(requestPayment = vi.fn(() => Promise.resolve())) {
  const payment = vi.fn(() => ({ requestPayment }));
  const load = vi.fn(() => Promise.resolve({ payment }));
  return { load, payment, requestPayment };
}

describe("createTossAdapter", () => {
  it("다루는 수단 → 카카오페이·네이버페이·카드(브랜드페이는 따로 계약이라 없음)", () => {
    const { load } = fakeSdk();
    expect(
      createTossAdapter({ clientKey: "test_ck_x", origin: "https://x", load }).methods,
    ).toEqual(["KAKAOPAY", "NAVERPAY", "CARD"]);
  });

  it("카드 → 통합결제창(DEFAULT), 주문번호·금액·돌아올 주소를 그대로", async () => {
    const { load, payment, requestPayment } = fakeSdk();
    await createTossAdapter({ clientKey: "test_ck_x", origin: "https://x", load }).request(
      "CARD",
      input,
    );

    expect(load).toHaveBeenCalledWith("test_ck_x");
    expect(payment).toHaveBeenCalledWith({ customerKey: "u1" });
    expect(requestPayment).toHaveBeenCalledWith({
      method: "CARD",
      amount: { currency: "KRW", value: 31000 },
      orderId: "20261105-ABC123",
      orderName: "라임바질 페이셜 세럼 미스트 1",
      successUrl: "https://x/pay/complete?o=o1",
      failUrl: "https://x/pay/fail?o=o1",
      card: { flowMode: "DEFAULT" },
    });
  });

  it.each(["KAKAOPAY", "NAVERPAY"] as const)(
    "%s → 그 간편결제 창을 바로(DIRECT)",
    async (method) => {
      const { load, requestPayment } = fakeSdk();
      await createTossAdapter({ clientKey: "test_ck_x", origin: "https://x", load }).request(
        method,
        input,
      );
      expect(requestPayment).toHaveBeenCalledWith(
        expect.objectContaining({ method: "CARD", card: { flowMode: "DIRECT", easyPay: method } }),
      );
    },
  );

  it("손님이 결제창을 닫음(USER_CANCEL) → 오류 없이 끝 — 버튼만 다시 눌리게", async () => {
    const cancel = Object.assign(new Error("취소"), { code: "USER_CANCEL" });
    const { load } = fakeSdk(vi.fn(() => Promise.reject(cancel)));
    await expect(
      createTossAdapter({ clientKey: "test_ck_x", origin: "https://x", load }).request(
        "CARD",
        input,
      ),
    ).resolves.toBeUndefined();
  });

  it("그 밖의 실패 → 그대로 던진다(화면이 안내)", async () => {
    const boom = Object.assign(new Error("키가 틀림"), { code: "INVALID_CLIENT_KEY" });
    const { load } = fakeSdk(vi.fn(() => Promise.reject(boom)));
    await expect(
      createTossAdapter({ clientKey: "test_ck_x", origin: "https://x", load }).request(
        "CARD",
        input,
      ),
    ).rejects.toBe(boom);
  });
});

describe("isTestClientKey", () => {
  it("test_ 로 시작하면 테스트 키(돈이 안 움직임)", () => {
    expect(isTestClientKey("test_ck_abc")).toBe(true);
    expect(isTestClientKey("live_ck_abc")).toBe(false);
    expect(isTestClientKey(undefined)).toBe(false);
  });
});
