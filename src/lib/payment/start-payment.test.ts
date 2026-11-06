import { beforeEach, describe, expect, it, vi } from "vitest";

import { PRODUCT } from "@/constants/product";
import { ApiClientError } from "@/lib/api";
import { readSavedMemo } from "@/lib/checkout/memo";

import { readPendingOrder } from "./pending";
import type { PaymentAdapter } from "./providers";

const { createOrder } = vi.hoisted(() => ({ createOrder: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { createOrder },
}));

import { startPayment } from "./start-payment";

function fakeAdapter(): PaymentAdapter & { request: ReturnType<typeof vi.fn> } {
  return { id: "fake", methods: ["CARD"], request: vi.fn().mockResolvedValue(undefined) };
}

const INPUT = {
  method: "CARD" as const,
  qty: 2,
  addressId: "a1",
  memo: "경비실에 맡겨 주세요",
  screen: "rebuy-sheet" as const,
  customerKey: "u1",
};

describe("startPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("주문(바로 구매 한 줄 + 메모·화면) → 보류 주문 저장 → 결제창(주문번호·금액·복귀 주소)", async () => {
    createOrder.mockResolvedValue({
      orderId: "o1",
      orderNo: "20261107-A",
      paymentStatus: "pending",
      totals: { grandTotal: 56000 },
    });
    const adapter = fakeAdapter();
    await startPayment({ ...INPUT, adapter });

    expect(createOrder).toHaveBeenCalledWith({
      addressId: "a1",
      idempotencyKey: expect.any(String),
      items: [{ productId: PRODUCT.productId, variantId: PRODUCT.variantId, quantity: 2 }],
      metadata: { deliveryMemo: "경비실에 맡겨 주세요", channel: "web", screen: "rebuy-sheet" },
    });
    expect(readPendingOrder()).toMatchObject({
      orderId: "o1",
      amount: 56000,
      qty: 2,
      addressId: "a1",
      memo: "경비실에 맡겨 주세요",
    });
    expect(adapter.request).toHaveBeenCalledWith("CARD", {
      orderId: "o1",
      orderNo: "20261107-A",
      orderName: `${PRODUCT.name} 2`,
      amount: 56000,
      customerKey: "u1",
      successPath: "/pay/complete?o=o1",
      failPath: "/pay/fail?o=o1",
    });
    expect(readSavedMemo()?.memo).toBe("경비실에 맡겨 주세요");
  });

  it("주문을 못 만들면 → 그대로 던지고 결제창·보류 주문은 없다", async () => {
    createOrder.mockRejectedValueOnce(new ApiClientError("OUT_OF_STOCK", "", 409));
    const adapter = fakeAdapter();
    await expect(startPayment({ ...INPUT, adapter })).rejects.toMatchObject({
      code: "OUT_OF_STOCK",
    });
    expect(adapter.request).not.toHaveBeenCalled();
    expect(readPendingOrder()).toBeNull();
  });
});
