import { describe, it, expect, beforeEach } from "vitest";
import { createMockClient } from "./index";
import { tokenStore } from "@/lib/auth/token-store";
import { products } from "@/data/fixtures";
import { CHECKOUT_PRICING } from "@/constants/checkout";
import type { Order } from "@/types";
import { store } from "./store";

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

  describe("받은 뒤(교환·철회)·결제 뒤(배송지 변경)", () => {
    const DAY = 24 * 60 * 60 * 1000;

    /** 결제한 주문 하나(수량 2)를 만들고 배송 상태를 바꿔 둔다(관리 툴이 하는 일) */
    async function paidOrder(over: Partial<Order> = {}): Promise<Order> {
      await loginDemo();
      const p = products[0];
      const addr = await api.createAddress({
        recipient: "r",
        phone: "01000000000",
        zipcode: "06000",
        addr1: "서울",
      });
      const order = await api.createOrder({
        addressId: addr.addressId,
        idempotencyKey: crypto.randomUUID(),
        items: [{ productId: p.productId, variantId: p.variants[0].variantId, quantity: 2 }],
      });
      await api.confirmPayment(order.orderId, {
        paymentKey: "k",
        amount: order.totals.grandTotal,
      });
      store.writeOrders(
        store.readOrders().map((o) => (o.orderId === order.orderId ? { ...o, ...over } : o)),
      );
      return api.getOrder(order.orderId);
    }
    const delivered = (daysAgo = 2): Partial<Order> => ({
      fulfillmentStatus: "delivered",
      deliveredAt: Date.now() - daysAgo * DAY,
    });

    it("교환 신청 → 신청됨·금액 0·남은 수량 전부, 같은 키는 같은 신청", async () => {
      const order = await paidOrder(delivered());
      const r = { idempotencyKey: "ex1", reasonCode: "상품하자" as const };
      const claim = await api.createExchange(order.orderId, r);
      expect(claim).toMatchObject({
        type: "exchange",
        status: "requested",
        refundAmount: 0,
        lines: [{ lineId: order.items[0].lineId, quantity: 2 }],
      });
      expect((await api.createExchange(order.orderId, r)).claimId).toBe(claim.claimId);
    });

    it("진행 중 교환이 있으면 → 교환·반품 모두 RETURN_ALREADY_REQUESTED", async () => {
      const order = await paidOrder(delivered());
      await api.createExchange(order.orderId, { idempotencyKey: "ex2", reasonCode: "오배송" });
      await expect(
        api.createExchange(order.orderId, { idempotencyKey: "ex3", reasonCode: "오배송" }),
      ).rejects.toMatchObject({ code: "RETURN_ALREADY_REQUESTED" });
      await expect(
        api.createReturn(order.orderId, {
          idempotencyKey: "rt1",
          reasonCode: "오배송",
          unopenedConfirmed: false,
        }),
      ).rejects.toMatchObject({ code: "RETURN_ALREADY_REQUESTED" });
    });

    it("교환 거절: 단순 변심 → INVALID_FIELD, 발송 전 → EXCHANGE_NOT_ALLOWED, 3개월 지남 → EXCHANGE_WINDOW_CLOSED", async () => {
      const shipped = await paidOrder(delivered());
      await expect(
        api.createExchange(shipped.orderId, {
          idempotencyKey: "e1",
          // 손님 화면에서 받지 않는 사유 — 서버가 400 으로 막는다
          reasonCode: "단순변심" as never,
        }),
      ).rejects.toMatchObject({ code: "INVALID_FIELD", field: "reasonCode" });
      const notShipped = await paidOrder();
      await expect(
        api.createExchange(notShipped.orderId, { idempotencyKey: "e2", reasonCode: "상품하자" }),
      ).rejects.toMatchObject({ code: "EXCHANGE_NOT_ALLOWED" });
      const old = await paidOrder(delivered(120));
      await expect(
        api.createExchange(old.orderId, { idempotencyKey: "e3", reasonCode: "상품하자" }),
      ).rejects.toMatchObject({ code: "EXCHANGE_WINDOW_CLOSED" });
    });

    it("철회: 신청 상태 반품 → withdrawn(시각), 다시 신청할 수 있고, 두 번째 철회는 CLAIM_NOT_WITHDRAWABLE", async () => {
      const order = await paidOrder(delivered());
      const ret = await api.createReturn(order.orderId, {
        idempotencyKey: "w1",
        reasonCode: "상품하자",
        unopenedConfirmed: false,
      });
      const withdrawn = await api.withdrawClaim(order.orderId, ret.claimId);
      expect(withdrawn.status).toBe("withdrawn");
      expect(withdrawn.withdrawnAt).toEqual(expect.any(Number));
      await expect(api.withdrawClaim(order.orderId, ret.claimId)).rejects.toMatchObject({
        code: "CLAIM_NOT_WITHDRAWABLE",
      });
      await expect(
        api.createExchange(order.orderId, { idempotencyKey: "w2", reasonCode: "상품하자" }),
      ).resolves.toMatchObject({ status: "requested" });
    });

    it("철회: 취소 클레임 → CLAIM_NOT_WITHDRAWABLE, 없는 신청 → CLAIM_NOT_FOUND", async () => {
      const order = await paidOrder();
      const cancel = await api.createClaim(order.orderId, {
        idempotencyKey: "cc1",
        reasonCode: "단순변심",
        lines: [{ lineId: order.items[0].lineId, quantity: 1 }],
      });
      await expect(api.withdrawClaim(order.orderId, cancel.claimId)).rejects.toMatchObject({
        code: "CLAIM_NOT_WITHDRAWABLE",
      });
      await expect(api.withdrawClaim(order.orderId, "nope")).rejects.toMatchObject({
        code: "CLAIM_NOT_FOUND",
        status: 404,
      });
    });

    it("배송지 변경: 상품 준비 전 → 주문 배송지가 바뀐다, 상품준비중 → ADDRESS_CHANGE_NOT_ALLOWED, 없는 주소 → ADDRESS_NOT_FOUND", async () => {
      const order = await paidOrder();
      const office = await api.createAddress({
        recipient: "회사",
        phone: "01011112222",
        zipcode: "06236",
        addr1: "서울 강남구 테헤란로 152",
        addr2: "12층",
      });
      const changed = await api.changeShippingAddress(order.orderId, {
        addressId: office.addressId,
      });
      expect(changed.shippingAddress).toEqual({
        recipient: "회사",
        phone: "01011112222",
        zipcode: "06236",
        addr1: "서울 강남구 테헤란로 152",
        addr2: "12층",
      });
      await expect(
        api.changeShippingAddress(order.orderId, { addressId: "nope" }),
      ).rejects.toMatchObject({ code: "ADDRESS_NOT_FOUND" });
      const preparing = await paidOrder({ fulfillmentStatus: "preparing" });
      await expect(
        api.changeShippingAddress(preparing.orderId, { addressId: office.addressId }),
      ).rejects.toMatchObject({ code: "ADDRESS_CHANGE_NOT_ALLOWED" });
    });

    it("끝나지 않은 환불(취소 failed)이 있으면 → 새 취소는 REFUND_IN_PROGRESS", async () => {
      const order = await paidOrder({ paymentStatus: "partially_refunded" });
      store.writeClaims([
        {
          claimId: "stuck",
          orderId: order.orderId,
          type: "cancel",
          status: "failed",
          reasonCode: "단순변심",
          lines: [{ lineId: order.items[0].lineId, productId: "p", variantId: "v", quantity: 1 }],
          refundAmount: 28000,
          refundedShipping: 0,
          returnShippingFee: 0,
          createdAt: 0,
          createdDtm: "",
        },
      ]);
      await expect(
        api.createClaim(order.orderId, {
          idempotencyKey: "c-late",
          reasonCode: "단순변심",
          lines: [{ lineId: order.items[0].lineId, quantity: 1 }],
        }),
      ).rejects.toMatchObject({ code: "REFUND_IN_PROGRESS" });
    });
  });
});
