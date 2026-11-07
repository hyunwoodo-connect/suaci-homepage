import { describe, it, expect, beforeEach } from "vitest";
import { createMockClient } from "./index";
import { tokenStore } from "@/lib/auth/token-store";
import { products } from "@/data/fixtures";
import { CHECKOUT_PRICING } from "@/constants/checkout";

const api = createMockClient();
async function loginDemo() {
  tokenStore.save(await api.login({ email: "demo@suaci.com", password: "pw123456" }));
}

describe("mock client", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("소셜(개발 대역): 처음엔 가입 표 → 동의하면 토큰, 같은 이름은 다음부터 바로 로그인", async () => {
    const consents = { terms: true, privacy: true, age: true, marketing: false };
    const first = await api.socialSignIn("kakao", { code: "mock:kakao:mina", redirectUri: "/" });
    expect(first).toMatchObject({ status: "needs_consent", signupToken: "mock-signup-kakao:mina" });
    if (first.status !== "needs_consent") return;
    const tokens = await api.socialComplete({ signupToken: first.signupToken, consents });
    expect(tokens.accessToken).toBe("mock.access.user_demo");
    const again = await api.socialSignIn("kakao", { code: "mock:kakao:mina", redirectUri: "/" });
    expect(again).toEqual({ status: "signed_in", tokens });
  });

  it("보호 메서드는 미인증 시 401", async () => {
    await expect(api.listOrders()).rejects.toMatchObject({ code: "AUTH_REQUIRED", status: 401 });
  });

  it("바로 구매: createOrder가 items 를 카탈로그 가격으로 채운다(수량 2 → 소계 = 단가 × 2)", async () => {
    await loginDemo();
    const p = products[0];
    const v = p.variants[0];
    const addr = await api.createAddress({
      recipient: "r",
      phone: "01000000000",
      zipcode: "06000",
      addr1: "서울",
    });
    const order = await api.createOrder({
      addressId: addr.addressId,
      idempotencyKey: "direct-1",
      items: [{ productId: p.productId, variantId: v.variantId, quantity: 2 }],
    });
    expect(order.items).toHaveLength(1);
    expect(order.items[0].lineSubtotal).toBe(order.items[0].unitPrice * 2);
  });

  it("체크아웃: createOrder가 주문 생성, 멱등", async () => {
    await loginDemo();
    const p = products[0];
    const items = [{ productId: p.productId, variantId: p.variants[0].variantId, quantity: 1 }];
    const addr = await api.createAddress({
      recipient: "수아치",
      phone: "01000000000",
      zipcode: "06000",
      addr1: "서울",
      isDefault: true,
    });
    const idem = "idem-1";
    const o1 = await api.createOrder({ addressId: addr.addressId, idempotencyKey: idem, items });
    expect(o1.status).toBe("pending");
    expect(o1.paymentStatus).toBe("pending");
    const o2 = await api.createOrder({ addressId: addr.addressId, idempotencyKey: idem, items });
    expect(o2.orderId).toBe(o1.orderId); // 멱등
  });

  it("confirmPayment: 금액검증 + 상태전이", async () => {
    await loginDemo();
    const p = products[0];
    const items = [{ productId: p.productId, variantId: p.variants[0].variantId, quantity: 1 }];
    const addr = await api.createAddress({
      recipient: "r",
      phone: "01000000000",
      zipcode: "06000",
      addr1: "서울",
    });
    const order = await api.createOrder({ addressId: addr.addressId, idempotencyKey: "i2", items });
    await expect(
      api.confirmPayment(order.orderId, { paymentKey: "k", amount: order.totals.grandTotal + 1 }),
    ).rejects.toMatchObject({ code: "PAYMENT_AMOUNT_MISMATCH" });
    const paid = await api.confirmPayment(order.orderId, {
      paymentKey: "k",
      amount: order.totals.grandTotal,
    });
    expect(paid.paymentStatus).toBe("paid");
    expect(paid.status).toBe("open");
  });

  it("cancelOrder는 pending만, claim은 paid·미이행 + over-refund 가드", async () => {
    await loginDemo();
    const p = products[0];
    const items = [{ productId: p.productId, variantId: p.variants[0].variantId, quantity: 1 }];
    const addr = await api.createAddress({
      recipient: "r",
      phone: "01000000000",
      zipcode: "06000",
      addr1: "서울",
    });
    const order = await api.createOrder({ addressId: addr.addressId, idempotencyKey: "i3", items });
    await api.confirmPayment(order.orderId, { paymentKey: "k", amount: order.totals.grandTotal });
    await expect(api.cancelOrder(order.orderId)).rejects.toMatchObject({
      code: "ORDER_NOT_CANCELLABLE",
    });
    const claim = await api.createClaim(order.orderId, {
      idempotencyKey: "c1",
      reasonCode: "단순변심",
    });
    expect(claim.refundAmount).toBe(order.totals.grandTotal); // 전체환불 = 상품+배송
    await expect(
      api.createClaim(order.orderId, { idempotencyKey: "c2", reasonCode: "단순변심" }),
    ).rejects.toMatchObject({ code: "OVER_REFUND" });
  });

  it("라인 부분환불: 남은 수량을 넘는 두 번째 클레임 → INVALID_CLAIM_QUANTITY", async () => {
    await loginDemo();
    // take-01(38000) qty2 → itemsSubtotal 76000
    const p = products[0];
    const v = p.variants[0];
    const items = [{ productId: p.productId, variantId: v.variantId, quantity: 2 }];
    const addr = await api.createAddress({
      recipient: "r",
      phone: "01000000000",
      zipcode: "06000",
      addr1: "서울",
    });
    const order = await api.createOrder({
      addressId: addr.addressId,
      idempotencyKey: "lr1",
      items,
    });
    await api.confirmPayment(order.orderId, { paymentKey: "k", amount: order.totals.grandTotal });
    const lineId = order.items[0].lineId;

    // 1) 1개 라인 환불 (38000) → 상품소계 미만이므로 partially_refunded
    const c1 = await api.createClaim(order.orderId, {
      idempotencyKey: "lc1",
      reasonCode: "단순변심",
      lines: [{ lineId, quantity: 1 }],
    });
    expect(c1.refundAmount).toBe(CHECKOUT_PRICING.price);
    expect((await api.getOrder(order.orderId)).paymentStatus).toBe("partially_refunded");

    // 2) 남은 1개를 넘는 2개 → INVALID_CLAIM_QUANTITY(서버와 같은 코드)
    await expect(
      api.createClaim(order.orderId, {
        idempotencyKey: "lc2",
        reasonCode: "단순변심",
        lines: [{ lineId, quantity: 2 }],
      }),
    ).rejects.toMatchObject({ code: "INVALID_CLAIM_QUANTITY" });
  });
});
