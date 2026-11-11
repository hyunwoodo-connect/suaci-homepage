import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@/lib/api";
import ko from "@/messages/ko.json";
import type { Order, RefundPreview } from "@/types";

const { previewRefund, createClaim } = vi.hoisted(() => ({
  previewRefund: vi.fn(),
  createClaim: vi.fn(),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { previewRefund, createClaim },
}));

import CancelRequestForm from "./CancelRequestForm";

/** 28,000원짜리 2개 + 배송비 3,000원을 결제하고 아직 안 보낸 주문 */
const ORDER: Order = {
  orderId: "o1",
  orderNo: "20261106-ABC123",
  status: "open",
  paymentStatus: "paid",
  fulfillmentStatus: "unfulfilled",
  totals: {
    itemsSubtotal: 56000,
    discountTotal: 0,
    shippingFee: 3000,
    taxTotal: 0,
    grandTotal: 59000,
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
      quantity: 2,
      lineSubtotal: 56000,
    },
  ],
  createdAt: 0,
  createdDtm: "",
};

/** 전체 취소의 서버 답 — 상품 금액 + 처음 낸 배송비 */
const FULL: RefundPreview = {
  itemsAmount: 56000,
  refundedShipping: 3000,
  returnShippingFee: 0,
  priorCompensation: 0,
  refundAmount: 59000,
};

function renderForm() {
  render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <CancelRequestForm
        order={ORDER}
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
const submitButton = () => screen.getByRole("button", { name: "취소 요청하기" });

describe("CancelRequestForm — 환불 금액은 서버 미리 보기", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("폼을 열면 사유를 고르기 전에도 남은 수량 전부로 묻는다", async () => {
    previewRefund.mockResolvedValue(FULL);
    renderForm();
    await tick();
    expect(previewRefund).toHaveBeenCalledTimes(1);
    expect(previewRefund).toHaveBeenCalledWith("o1", { type: "cancel", reasonCode: "기타" });
    expect(quoteBox().textContent).toContain("환불 예정 금액₩59,000");
  });

  it("받는 동안 → 금액 자리는 '불러오는 중…', 버튼은 잠김. 받으면 그 금액을 보이고 풀린다", async () => {
    let answer: (preview: RefundPreview) => void = () => undefined;
    previewRefund.mockImplementation(() => new Promise<RefundPreview>((r) => (answer = r)));
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "단순 변심" }));
    await tick(300);
    expect(previewRefund).toHaveBeenLastCalledWith("o1", {
      type: "cancel",
      reasonCode: "단순변심",
    });
    expect(within(quoteBox()).getByRole("status", { name: "불러오는 중…" })).toBeTruthy();
    expect(quoteBox().textContent).not.toContain("₩");
    expect(submitButton()).toHaveProperty("disabled", true);

    await act(async () => answer(FULL));
    expect(quoteBox().textContent).toContain("상품 금액₩56,000");
    expect(quoteBox().textContent).toContain("환불 예정 금액₩59,000");
    expect(quoteBox().textContent).not.toContain("먼저 드린 보상");
    expect(submitButton()).toHaveProperty("disabled", false);
  });

  it("먼저 드린 보상이 있으면 → 합계 앞에 '먼저 드린 보상 −₩n' 한 줄, 확인 단계도 서버가 준 금액", async () => {
    previewRefund.mockResolvedValue({ ...FULL, priorCompensation: 10000, refundAmount: 49000 });
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "단순 변심" }));
    await tick(300);
    expect(quoteBox().textContent).toContain(
      "처음 낸 배송비 환불+₩3,000먼저 드린 보상−₩10,000환불 예정 금액₩49,000",
    );
    fireEvent.click(submitButton());
    expect(screen.getByText("취소하면 ₩49,000을 환불해 드려요. 취소할까요?")).toBeTruthy();
  });

  it("일부 취소인데 고른 수량이 없으면 → 묻지 않고 금액 자리는 줄표, 버튼 잠김", async () => {
    previewRefund.mockResolvedValue(FULL);
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "단순 변심" }));
    await tick(1000);
    previewRefund.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "일부 취소" }));
    await tick(1000);
    expect(previewRefund).not.toHaveBeenCalled();
    expect(quoteBox().textContent).toContain("환불 예정 금액—");
    expect(submitButton()).toHaveProperty("disabled", true);
  });

  it("수량을 연달아 바꾸면 → 마지막 수량으로 한 번만 다시 묻는다", async () => {
    previewRefund.mockResolvedValue(FULL);
    renderForm();
    await tick(1000);
    fireEvent.click(screen.getByRole("button", { name: "일부 취소" }));
    previewRefund.mockClear();
    const plus = screen.getByRole("button", { name: "수량 늘리기" });
    fireEvent.click(plus);
    fireEvent.click(plus);
    await tick(300);
    expect(previewRefund).toHaveBeenCalledTimes(1);
    expect(previewRefund).toHaveBeenCalledWith("o1", {
      type: "cancel",
      reasonCode: "기타",
      lines: [{ lineId: "l1", quantity: 2 }],
    });
  });

  it("못 받으면 → 금액 대신 한 줄과 '다시 시도', 버튼 잠김. 다시 시도하면 다시 물어 금액을 보인다", async () => {
    previewRefund.mockRejectedValue(new TypeError("Failed to fetch"));
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "단순 변심" }));
    await tick(300);
    expect(within(quoteBox()).getByRole("alert").textContent).toBe(
      "환불 금액을 불러오지 못했어요.",
    );
    expect(submitButton()).toHaveProperty("disabled", true);

    previewRefund.mockResolvedValue(FULL);
    fireEvent.click(within(quoteBox()).getByRole("button", { name: "다시 시도" }));
    await tick(300);
    expect(quoteBox().textContent).toContain("환불 예정 금액₩59,000");
    expect(submitButton()).toHaveProperty("disabled", false);
  });

  it("보상으로 이미 다 돌려드렸으면(409 NOTHING_TO_REFUND) → 그 이유 한 줄, 다시 시도 없음, 버튼 잠김", async () => {
    previewRefund.mockRejectedValue(new ApiClientError("NOTHING_TO_REFUND", "x", 409));
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "단순 변심" }));
    await tick(300);
    expect(within(quoteBox()).getByRole("alert").textContent).toBe(
      "보상으로 이미 남은 금액을 다 돌려드렸어요.",
    );
    expect(within(quoteBox()).queryByRole("button", { name: "다시 시도" })).toBeNull();
    expect(submitButton()).toHaveProperty("disabled", true);
  });

  it("신청이 막히면 → 주문을 다시 읽은 뒤 금액도 다시 묻는다", async () => {
    previewRefund.mockResolvedValue(FULL);
    createClaim.mockRejectedValue(new ApiClientError("REFUND_IN_PROGRESS", "x", 409));
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "단순 변심" }));
    await tick(300);
    previewRefund.mockClear();
    fireEvent.click(submitButton());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "네, 취소할게요" }));
    });
    await tick(300);
    expect(previewRefund).toHaveBeenCalledTimes(1);
    expect(previewRefund).toHaveBeenCalledWith("o1", { type: "cancel", reasonCode: "단순변심" });
  });
});
