import { beforeEach, describe, expect, it, vi } from "vitest";

import { tokenStore } from "@/lib/auth/token-store";
import type { Claim, Order } from "@/types";

import { createHttpClient } from "./http";
import { createMockClient } from "./mock";
import { store } from "./mock/store";

const TOKENS = { idToken: "id-tok", accessToken: "tok", refreshToken: "r", expiresIn: 60 };

function mockFetchOnce(status: number, body: unknown) {
  const f = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  });
  vi.stubGlobal("fetch", f);
  return f;
}

describe("회원 탈퇴 http", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    tokenStore.save(TOKENS);
  });

  it("withdrawAccount: POST /me/withdrawal 에 leaveWaitlist(인증 헤더) → withdrawn", async () => {
    const f = mockFetchOnce(200, { data: { withdrawn: true } });
    const out = await createHttpClient("https://api.test").withdrawAccount({ leaveWaitlist: true });
    expect(out).toEqual({ withdrawn: true });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.test/me/withdrawal");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ leaveWaitlist: true });
    expect(init.headers.Authorization).toBe("Bearer id-tok");
  });

  it("끝나지 않은 주문이 있으면(409) → ACCOUNT_WITHDRAWAL_BLOCKED 로 던진다", async () => {
    mockFetchOnce(409, { error: "ACCOUNT_WITHDRAWAL_BLOCKED", message: "blocked" });
    await expect(
      createHttpClient("https://api.test").withdrawAccount({ leaveWaitlist: false }),
    ).rejects.toMatchObject({ code: "ACCOUNT_WITHDRAWAL_BLOCKED", status: 409 });
  });
});

describe("회원 탈퇴 mock", () => {
  const api = createMockClient();

  /** 목업 저장소에 주문 하나를 넣는다 — 상태만 다르게 */
  function seedOrder(over: Partial<Order>): Order {
    const order = {
      orderId: "o1",
      orderNo: "20261111-AAAAAA",
      status: "open",
      paymentStatus: "paid",
      fulfillmentStatus: "delivered",
      items: [],
      createdAt: 0,
      createdDtm: "",
      ...over,
    } as Order;
    store.writeOrders([order]);
    return order;
  }

  function seedClaim(over: Pick<Claim, "type" | "status">): void {
    const claim = {
      claimId: "c1",
      orderId: "o1",
      reasonCode: "상품하자",
      lines: [],
      refundAmount: 0,
      refundedShipping: 0,
      returnShippingFee: 0,
      createdAt: 0,
      createdDtm: "",
      ...over,
    } as Claim;
    store.writeClaims([claim]);
  }

  beforeEach(() => {
    tokenStore.save(TOKENS);
  });

  it("로그인하지 않았으면 → 401", async () => {
    tokenStore.clear();
    await expect(api.withdrawAccount({ leaveWaitlist: false })).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      status: 401,
    });
  });

  it("주문이 없으면 → 탈퇴되고 이 브라우저의 목업 기록(배송지)이 비워진다", async () => {
    await api.createAddress({ recipient: "r", phone: "01000000000", zipcode: "06000", addr1: "a" });
    await expect(api.withdrawAccount({ leaveWaitlist: true })).resolves.toEqual({
      withdrawn: true,
    });
    expect(store.readAddresses()).toEqual([]);
  });

  it.each<[string, Partial<Order>]>([
    [
      "결제 대기",
      { status: "pending", paymentStatus: "pending", fulfillmentStatus: "unfulfilled" },
    ],
    ["결제완료·배송 전", { fulfillmentStatus: "unfulfilled" }],
    ["부분환불·배송중", { paymentStatus: "partially_refunded", fulfillmentStatus: "shipped" }],
    ["자동 환불 중", { status: "cancelled", paymentStatus: "refunding" }],
  ])("%s 주문이 있으면 → ACCOUNT_WITHDRAWAL_BLOCKED, 기록은 그대로", async (_name, over) => {
    seedOrder(over);
    await expect(api.withdrawAccount({ leaveWaitlist: false })).rejects.toMatchObject({
      code: "ACCOUNT_WITHDRAWAL_BLOCKED",
      status: 409,
    });
    expect(store.readOrders()).toHaveLength(1);
  });

  it.each<[string, Pick<Claim, "type" | "status">]>([
    ["끝나지 않은 환불", { type: "cancel", status: "refund_failed" }],
    ["진행 중인 반품", { type: "return", status: "requested" }],
    ["진행 중인 교환", { type: "exchange", status: "shipped" }],
  ])("배송 완료 주문에 %s이 있으면 → ACCOUNT_WITHDRAWAL_BLOCKED", async (_name, claim) => {
    seedOrder({});
    seedClaim(claim);
    await expect(api.withdrawAccount({ leaveWaitlist: false })).rejects.toMatchObject({
      code: "ACCOUNT_WITHDRAWAL_BLOCKED",
    });
  });

  it.each<[string, Partial<Order>]>([
    ["배송 완료", {}],
    ["결제 전 취소", { status: "cancelled", paymentStatus: "pending" }],
    ["전액 환불", { status: "cancelled", paymentStatus: "refunded" }],
  ])("%s 주문만 있으면 → 탈퇴된다", async (_name, over) => {
    seedOrder(over);
    await expect(api.withdrawAccount({ leaveWaitlist: false })).resolves.toEqual({
      withdrawn: true,
    });
    expect(store.readOrders()).toEqual([]);
  });
});
