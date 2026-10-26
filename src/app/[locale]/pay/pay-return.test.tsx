import { act, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { ApiClientError } from "@/lib/api/errors";
import { savePendingOrder, readPendingOrder } from "@/lib/payment/pending";

const { confirmPayment, replace, searchParams } = vi.hoisted(() => ({
  confirmPayment: vi.fn(),
  replace: vi.fn(),
  searchParams: { value: new URLSearchParams() },
}));
vi.mock("@/lib/api", () => ({
  api: { confirmPayment, getCart: vi.fn().mockResolvedValue({ items: [] }) },
}));
vi.mock("@/lib/cart/cart-context", () => ({
  useCart: () => ({ refresh: vi.fn().mockResolvedValue(undefined) }),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => searchParams.value }));

import CompletePage from "./complete/page";
import FailPage from "./fail/page";

function renderComplete() {
  return render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <CompletePage />
    </NextIntlClientProvider>,
  );
}

const pendingBase = {
  orderId: "o1",
  orderNo: "20261026-A",
  amount: 31000,
  idempotencyKey: "ik",
  qty: 1,
};

describe("/pay/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("happy: 쿼리 amount 그대로 confirm 1회 → pending 지움 → 주문 상세로", async () => {
    savePendingOrder(pendingBase);
    searchParams.value = new URLSearchParams({
      o: "o1",
      first: "1",
      paymentKey: "mock_BRANDPAY_k1",
      orderId: "20261026-A",
      amount: "31000",
    });
    confirmPayment.mockResolvedValue({ orderId: "o1", paymentStatus: "paid" });
    await act(async () => {
      renderComplete();
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/orders/o1?welcome=1&first=1"));
    expect(confirmPayment).toHaveBeenCalledTimes(1);
    expect(confirmPayment).toHaveBeenCalledWith("o1", {
      paymentKey: "mock_BRANDPAY_k1",
      amount: 31000,
    });
    expect(readPendingOrder()).toBeNull();
  });

  it("쿼리가 깨졌으면(amount 소수) 승인 없이 '잘못 들어온 주소예요.'", async () => {
    searchParams.value = new URLSearchParams({
      o: "o1",
      paymentKey: "k",
      orderId: "n",
      amount: "1.5",
    });
    await act(async () => {
      renderComplete();
    });
    expect(confirmPayment).not.toHaveBeenCalled();
    expect(screen.getByText("잘못 들어온 주소예요.")).toBeTruthy();
  });

  it("PAYMENT_DECLINED → 카드사 문구 + 주문서로 돌아가기, 성공 이동 없음", async () => {
    searchParams.value = new URLSearchParams({
      o: "o1",
      paymentKey: "k12345678",
      orderId: "n",
      amount: "31000",
    });
    confirmPayment.mockRejectedValue(new ApiClientError("PAYMENT_DECLINED", "거절", 400));
    await act(async () => {
      renderComplete();
    });
    expect(await screen.findByText("카드사에서 안 됐대요. 다른 걸로 해 볼까요?")).toBeTruthy();
    expect(screen.getByText("주문서로 돌아가기")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("그 외 실패 → '잠깐 막혔어요' + 다시 시도(재호출 멱등: 두 번째 paid → 이동)", async () => {
    searchParams.value = new URLSearchParams({
      o: "o1",
      paymentKey: "k12345678",
      orderId: "n",
      amount: "31000",
    });
    confirmPayment
      .mockRejectedValueOnce(new ApiClientError("INTERNAL_ERROR", "오류", 500))
      .mockResolvedValueOnce({ orderId: "o1", paymentStatus: "paid" });
    await act(async () => {
      renderComplete();
    });
    expect(await screen.findByText("잠깐 막혔어요. 한 번만 다시 눌러 주세요.")).toBeTruthy();
    await act(async () => {
      screen.getByRole("button", { name: "다시 시도" }).click();
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/orders/o1?welcome=1"));
    expect(confirmPayment).toHaveBeenCalledTimes(2);
  });
});

describe("/pay/fail", () => {
  it("멈췄다는 문구 + 이어서 하기, pending 은 지우지 않는다", async () => {
    savePendingOrder(pendingBase);
    searchParams.value = new URLSearchParams({ o: "o1" });
    await act(async () => {
      render(
        <NextIntlClientProvider locale="ko" messages={ko}>
          <FailPage />
        </NextIntlClientProvider>,
      );
    });
    expect(screen.getByText("결제를 멈췄어요. 적은 건 그대로 있어요.")).toBeTruthy();
    expect(screen.getByText("이어서 하기")).toBeTruthy();
    expect(readPendingOrder()).toMatchObject(pendingBase);
  });
});
