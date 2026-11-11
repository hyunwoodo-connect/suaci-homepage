import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api";
import ko from "@/messages/ko.json";
import type { Order, RefundPreview } from "@/types";

const { previewRefund, createReturn } = vi.hoisted(() => ({
  previewRefund: vi.fn(),
  createReturn: vi.fn(),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { previewRefund, createReturn },
}));

import ReturnRequestForm from "./ReturnRequestForm";

const DAY = 24 * 60 * 60 * 1000;

/** 28,000원짜리 1개 + 배송비 3,000원을 결제하고 이틀 전에 받은 주문 */
function deliveredOrder(shippingFee = 3000): Order {
  return {
    orderId: "o1",
    orderNo: "20261106-ABC123",
    state: "delivered",
    status: "open",
    paymentStatus: "paid",
    fulfillmentStatus: "delivered",
    deliveredAt: Date.now() - 2 * DAY,
    totals: {
      itemsSubtotal: 28000,
      discountTotal: 0,
      shippingFee,
      taxTotal: 0,
      grandTotal: 28000 + shippingFee,
    },
    shippingAddress: {
      recipient: "지우",
      phone: "010-1234-5678",
      zipcode: "13529",
      addr1: "판교역로 166",
    },
    items: [
      {
        lineId: "l1",
        productId: "p1",
        variantId: "v1",
        sku: "S",
        productName: "take-01",
        optionName: "100 ml",
        unitPrice: 28000,
        compareAtPrice: 28000,
        quantity: 1,
        lineSubtotal: 28000,
      },
    ],
    createdAt: 0,
    createdDtm: "",
  };
}

/** 단순 변심 반품의 서버 답 — 상품 금액에서 반품 배송비를 뺀다 */
const CHANGE_OF_MIND: RefundPreview = {
  itemsAmount: 28000,
  refundedShipping: 0,
  returnShippingFee: 3000,
  priorCompensation: 0,
  refundAmount: 25000,
};

/** 회사 탓 반품의 서버 답 — 처음 낸 배송비까지 */
const COMPANY_FAULT: RefundPreview = {
  itemsAmount: 28000,
  refundedShipping: 3000,
  returnShippingFee: 0,
  priorCompensation: 0,
  refundAmount: 31000,
};

function renderForm(order: Order = deliveredOrder()) {
  render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <ReturnRequestForm
        order={order}
        claims={[]}
        idempotencyKey="k1"
        onClose={vi.fn()}
        onDone={vi.fn()}
        onFailed={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
}

/** 시간을 흘려 기다리던 미리 보기 요청을 보내고, 온 답을 화면에 반영한다 */
async function tick(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const quoteBox = () => screen.getByRole("region", { name: "예상 환불 금액" });
const submitButton = () => screen.getByRole("button", { name: "반품 신청하기" });

describe("ReturnRequestForm — 환불 금액은 서버 미리 보기", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("사유를 고르기 전 → 묻지 않고 금액 칸도 없다", async () => {
    renderForm();
    await tick(1000);
    expect(previewRefund).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "예상 환불 금액" })).toBeNull();
    expect(submitButton()).toHaveProperty("disabled", true);
  });

  it("사유를 고르면 그 사유로 묻고 → 받는 동안 '불러오는 중…'·버튼 잠김, 받으면 반품 배송비를 뺀 금액을 보이고 풀린다", async () => {
    let answer: (preview: RefundPreview) => void = () => undefined;
    previewRefund.mockImplementation(() => new Promise<RefundPreview>((r) => (answer = r)));
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "단순 변심" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "밀봉을 뜯지 않았고 사용하지 않았어요" }));
    await tick();
    expect(previewRefund).toHaveBeenCalledWith("o1", { type: "return", reasonCode: "단순변심" });
    expect(within(quoteBox()).getByRole("status", { name: "불러오는 중…" })).toBeTruthy();
    expect(submitButton()).toHaveProperty("disabled", true);

    await act(async () => answer(CHANGE_OF_MIND));
    expect(quoteBox().textContent).toContain("반품 배송비 (고객 부담)−₩3,000");
    expect(quoteBox().textContent).toContain("환불 예정 금액₩25,000");
    expect(submitButton()).toHaveProperty("disabled", false);
  });

  it("사유를 바꾸면 → 새 사유로 다시 묻고 그 금액을 보인다", async () => {
    previewRefund.mockResolvedValueOnce(CHANGE_OF_MIND).mockResolvedValueOnce(COMPANY_FAULT);
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "단순 변심" }));
    await tick(1000);
    fireEvent.click(screen.getByRole("button", { name: "오배송" }));
    await tick();
    expect(previewRefund).toHaveBeenCalledTimes(2);
    expect(previewRefund).toHaveBeenLastCalledWith("o1", { type: "return", reasonCode: "오배송" });
    expect(quoteBox().textContent).toContain("처음 낸 배송비 환불+₩3,000");
    expect(quoteBox().textContent).toContain("환불 예정 금액₩31,000");
  });

  it("먼저 드린 보상이 있으면 → 합계 앞에 '먼저 드린 보상 −₩n' 한 줄", async () => {
    previewRefund.mockResolvedValue({
      ...COMPANY_FAULT,
      priorCompensation: 5000,
      refundAmount: 26000,
    });
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "상품 불량(파손·누액 포함)" }));
    await tick();
    expect(quoteBox().textContent).toContain(
      "처음 낸 배송비 환불+₩3,000먼저 드린 보상−₩5,000환불 예정 금액₩26,000",
    );
  });

  it("무료 배송 주문 → 반품 배송비 줄 이름이 '처음 배송비 포함'", async () => {
    previewRefund.mockResolvedValue({
      ...CHANGE_OF_MIND,
      returnShippingFee: 6000,
      refundAmount: 22000,
    });
    renderForm(deliveredOrder(0));
    fireEvent.click(screen.getByRole("button", { name: "단순 변심" }));
    await tick();
    expect(quoteBox().textContent).toContain(
      "반품 배송비 (무료 배송 주문이라 처음 배송비 포함)−₩6,000",
    );
  });

  it("반품 배송비를 빼면 남는 금액이 없으면(400 NOTHING_TO_REFUND) → 그 이유 한 줄, 다시 시도 없음, 버튼 잠김", async () => {
    previewRefund.mockRejectedValue(new ApiClientError("NOTHING_TO_REFUND", "x", 400));
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "단순 변심" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "밀봉을 뜯지 않았고 사용하지 않았어요" }));
    await tick();
    expect(within(quoteBox()).getByRole("alert").textContent).toBe(
      "반품 배송비를 빼면 돌려드릴 금액이 없어요.",
    );
    expect(within(quoteBox()).queryByRole("button", { name: "다시 시도" })).toBeNull();
    expect(submitButton()).toHaveProperty("disabled", true);
  });

  it("못 받으면 → 한 줄과 '다시 시도', 버튼 잠김. 다시 시도하면 다시 묻는다", async () => {
    previewRefund.mockRejectedValueOnce(new ApiClientError("SERVER_ERROR", "x", 500));
    previewRefund.mockResolvedValueOnce(COMPANY_FAULT);
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "오배송" }));
    await tick();
    expect(within(quoteBox()).getByRole("alert").textContent).toBe(
      "환불 금액을 불러오지 못했어요.",
    );
    expect(submitButton()).toHaveProperty("disabled", true);

    fireEvent.click(within(quoteBox()).getByRole("button", { name: "다시 시도" }));
    await tick(300);
    expect(previewRefund).toHaveBeenCalledTimes(2);
    expect(submitButton()).toHaveProperty("disabled", false);
  });
});
