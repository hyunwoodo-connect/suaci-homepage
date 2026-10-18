import { describe, it, expect, beforeEach } from "vitest";
import { createMockClient } from "./index";
import { tokenStore } from "@/lib/auth/token-store";
import { products } from "@/data/fixtures";

const api = createMockClient();
async function loginDemo() {
  tokenStore.save(await api.login({ email: "demo@suaci.com", password: "pw123456" }));
}

describe("mock client", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("보호 메서드는 미인증 시 401", async () => {
    await expect(api.getCart()).rejects.toMatchObject({ code: "AUTH_REQUIRED", status: 401 });
  });

  it("담기→카트 반영, 총액계산", async () => {
    await loginDemo();
    const p = products[0];
    const v = p.variants[0];
    const cart = await api.addToCart({
      productId: p.productId,
      variantId: v.variantId,
      quantity: 2,
    });
    expect(cart.items).toHaveLength(1);
    expect(cart.totals.itemCount).toBe(2);
    expect(cart.items[0].lineSubtotal).toBe(cart.items[0].unitPrice * 2);
  });

  it("체크아웃: createOrder가 카트 비우고 주문 생성, 멱등", async () => {
    await loginDemo();
    const p = products[0];
    await api.addToCart({
      productId: p.productId,
      variantId: p.variants[0].variantId,
      quantity: 1,
    });
    const addr = await api.createAddress({
      recipient: "수아치",
      phone: "01000000000",
      zipcode: "06000",
      addr1: "서울",
      isDefault: true,
    });
    const idem = "idem-1";
    const o1 = await api.createOrder({ addressId: addr.addressId, idempotencyKey: idem });
    expect(o1.status).toBe("pending");
    expect(o1.paymentStatus).toBe("pending");
    expect((await api.getCart()).items).toHaveLength(0);
    const o2 = await api.createOrder({ addressId: addr.addressId, idempotencyKey: idem });
    expect(o2.orderId).toBe(o1.orderId); // 멱등
  });

  it("confirmPayment: 금액검증 + 상태전이", async () => {
    await loginDemo();
    const p = products[0];
    await api.addToCart({
      productId: p.productId,
      variantId: p.variants[0].variantId,
      quantity: 1,
    });
    const addr = await api.createAddress({
      recipient: "r",
      phone: "01000000000",
      zipcode: "06000",
      addr1: "서울",
    });
    const order = await api.createOrder({ addressId: addr.addressId, idempotencyKey: "i2" });
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
    await api.addToCart({
      productId: p.productId,
      variantId: p.variants[0].variantId,
      quantity: 1,
    });
    const addr = await api.createAddress({
      recipient: "r",
      phone: "01000000000",
      zipcode: "06000",
      addr1: "서울",
    });
    const order = await api.createOrder({ addressId: addr.addressId, idempotencyKey: "i3" });
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

  it("라인 부분환불: 상품소계 넘어가면 두번째 클레임 OVER_REFUND", async () => {
    await loginDemo();
    // brume no.1(38000) qty2 → itemsSubtotal 76000
    const p = products[0];
    const v = p.variants[0];
    await api.addToCart({ productId: p.productId, variantId: v.variantId, quantity: 2 });
    const addr = await api.createAddress({
      recipient: "r",
      phone: "01000000000",
      zipcode: "06000",
      addr1: "서울",
    });
    const order = await api.createOrder({ addressId: addr.addressId, idempotencyKey: "lr1" });
    await api.confirmPayment(order.orderId, { paymentKey: "k", amount: order.totals.grandTotal });
    const lineId = order.items[0].lineId;

    // 1) 1개 라인 환불 (38000) → 상품소계 미만이므로 partially_refunded
    const c1 = await api.createClaim(order.orderId, {
      idempotencyKey: "lc1",
      reasonCode: "단순변심",
      lines: [{ lineId, quantity: 1 }],
    });
    expect(c1.refundAmount).toBe(38000);
    expect((await api.getOrder(order.orderId)).paymentStatus).toBe("partially_refunded");

    // 2) 2개 라인 환불 시도 (76000) → 누적 114000 > 상품소계 76000 → OVER_REFUND
    await expect(
      api.createClaim(order.orderId, {
        idempotencyKey: "lc2",
        reasonCode: "단순변심",
        lines: [{ lineId, quantity: 2 }],
      }),
    ).rejects.toMatchObject({ code: "OVER_REFUND" });
  });
});
