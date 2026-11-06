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
  api: { confirmPayment },
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/pay/complete",
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => searchParams.value }));
// 결과 화면 머리의 헤더(계정 아이콘)가 로그인 상태를 읽는다
vi.mock("@/lib/auth/auth-context", () => ({ useAuth: () => ({ status: "anonymous" }) }));

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
  qty: 2,
  addressId: "a1",
  memo: "문 앞",
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

  it("쿼리가 깨졌으면(amount 소수) 승인 없이 '잘못된 접근이에요. 홈으로 돌아가 주세요.'", async () => {
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
    expect(screen.getByText("잘못된 접근이에요. 홈으로 돌아가 주세요.")).toBeTruthy();
  });

  it("PAYMENT_DECLINED → 카드사 문구 + 결제수단 변경하기, 성공 이동 없음", async () => {
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
    expect(
      await screen.findByText(
        "결제가 승인되지 않았어요. 카드 한도나 잔액을 확인하거나 다른 결제수단으로 시도해 주세요.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("결제수단 변경하기")).toBeTruthy();
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
    expect(
      await screen.findByText(
        "결제 확인이 늦어지고 있어요. 다시 시도해도 중복 결제되지 않아요. 계속 안 되면 주문 내역을 확인하거나 고객센터로 문의해 주세요.",
      ),
    ).toBeTruthy();
    await act(async () => {
      screen.getByRole("button", { name: "다시 확인하기" }).click();
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/orders/o1?welcome=1"));
    expect(confirmPayment).toHaveBeenCalledTimes(2);
  });
});

describe("/pay/fail", () => {
  it("멈췄다는 문구 + 다시 결제하기, pending 은 지우지 않는다", async () => {
    savePendingOrder(pendingBase);
    searchParams.value = new URLSearchParams({ o: "o1" });
    await act(async () => {
      render(
        <NextIntlClientProvider locale="ko" messages={ko}>
          <FailPage />
        </NextIntlClientProvider>,
      );
    });
    expect(
      screen.getByText("결제에 실패했어요. 다른 결제수단으로 다시 시도해 주세요."),
    ).toBeTruthy();
    const cont = await screen.findByText("다시 결제하기");
    // 수량까지 들고 돌아간다 — 복귀가 1개짜리 새 주문이 되면 안 된다
    expect(cont.closest("a")?.getAttribute("href")).toBe("/checkout?qty=2");
    expect(readPendingOrder()).toMatchObject(pendingBase);
  });
});
