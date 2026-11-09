import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PRODUCT } from "@/constants/product";
import ko from "@/messages/ko.json";
import { ApiClientError } from "@/lib/api";
import { createMockAdapter } from "@/lib/payment/providers";
import { readPendingOrder, savePendingOrder } from "@/lib/payment/pending";
import { resetSalesStatusCache } from "@/lib/sales/sales-lock";
import type { SalesStatus } from "@/types";

const {
  getCheckoutDefaults,
  createOrder,
  getSalesStatus,
  authState,
  navigate,
  selectMock,
  push,
  replace,
  searchState,
} = vi.hoisted(() => ({
  getCheckoutDefaults: vi.fn(),
  createOrder: vi.fn(),
  getSalesStatus: vi.fn((): Promise<SalesStatus> => Promise.resolve({ open: true })),
  authState: {
    value: { status: "authenticated", user: { userId: "u1" } } as Record<string, unknown>,
  },
  navigate: vi.fn(),
  selectMock: { value: true },
  push: vi.fn(),
  replace: vi.fn(),
  searchState: { value: "" },
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { getCheckoutDefaults, createOrder, getSalesStatus },
}));
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => authState.value,
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push, replace }),
  Link: ({
    href,
    children,
  }: {
    href: string | { pathname: string; query?: Record<string, string> };
    children: React.ReactNode;
  }) => (
    <a
      href={
        typeof href === "string"
          ? href
          : `${href.pathname}?${new URLSearchParams(href.query).toString()}`
      }
    >
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(searchState.value),
}));
vi.mock("@/lib/payment/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payment/providers")>();
  return {
    ...actual,
    canTakePayment: () => selectMock.value,
    browserPaymentAdapters: () =>
      selectMock.value
        ? [actual.createMockAdapter({ origin: "https://x", navigate, newKey: () => "k1234567" })]
        : [],
  };
});

import BuyBar from "@/components/home/BuyBar";

void createMockAdapter;

const ADDRESS = {
  addressId: "a1",
  recipient: "미나",
  phone: "01012345678",
  zipcode: "04524",
  addr1: "서울 중구 세종대로 110",
  addr2: "10층",
  isDefault: true,
};

function renderBar() {
  return render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <BuyBar />
    </NextIntlClientProvider>,
  );
}

describe("사기 바", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSalesStatusCache();
    sessionStorage.clear();
    localStorage.clear();
    authState.value = { status: "authenticated", user: { userId: "u1" } };
    selectMock.value = true;
    searchState.value = "";
  });

  it("판매 전(출시 전 구매 차단) → 버튼이 '1월 5일 판매 시작'으로 막히고 출시 알림 길이 보인다", async () => {
    getSalesStatus.mockResolvedValueOnce({
      open: false,
      opensAt: Date.parse("2027-01-05T00:00:00+09:00"),
    });
    await act(async () => {
      renderBar();
    });
    const locked = await screen.findByRole("button", { name: "1월 5일 판매 시작" });
    expect((locked as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /구매하기/ })).toBeNull();
    expect(screen.getByText("1월 5일부터 판매해요.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /출시 알림 신청/ })).toBeTruthy();
  });

  it("판매 전에 로그인에서 ?buy=1 로 돌아와 시트가 열려도 → 결제 버튼이 '1월 5일 판매 시작'으로 막힌다", async () => {
    searchState.value = "buy=1&qty=3";
    getSalesStatus.mockResolvedValueOnce({
      open: false,
      opensAt: Date.parse("2027-01-05T00:00:00+09:00"),
    });
    getCheckoutDefaults.mockResolvedValue({ address: ADDRESS, lastPaymentMethod: null });
    await act(async () => {
      renderBar();
    });
    await screen.findByText("주문 정보를 확인해 주세요");
    const pay = screen
      .getAllByRole("button", { name: "1월 5일 판매 시작" })
      .find((b) => b.closest("[role=dialog]")) as HTMLButtonElement;
    expect(pay.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /결제하기/ })).toBeNull();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("판매 중이면 → 지금처럼 구매하기", async () => {
    await act(async () => {
      renderBar();
    });
    expect(screen.getByRole("button", { name: "₩28,000 · 구매하기" })).toBeTruthy();
  });

  it("로그인에서 ?buy=1&qty=3 으로 돌아오면 → 고른 수량 3 그대로 시트를 연다", async () => {
    searchState.value = "buy=1&qty=3";
    getCheckoutDefaults.mockResolvedValue({ address: ADDRESS, lastPaymentMethod: null });
    await act(async () => {
      renderBar();
    });
    expect(await screen.findByRole("button", { name: "₩84,000 결제하기" })).toBeTruthy();
  });

  it("미로그인 구매하기 → 로그인 시트가 돌아올 주소에 수량을 싣는다", async () => {
    authState.value = { status: "anonymous", user: null };
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: "수량 더하기" }));
    fireEvent.click(screen.getByRole("button", { name: "₩56,000 · 구매하기" }));
    const email = await screen.findByRole("link", { name: "이메일로 로그인" });
    expect(decodeURIComponent(email.getAttribute("href") ?? "")).toContain("/?buy=1&qty=2");
  });

  it("버튼은 상품가(배송비 빼고) — 결제를 받을 땐 바 위 알약이 없다(배송비는 제품 섹션 가격 아래)", () => {
    renderBar();
    expect(screen.getByRole("button", { name: "₩28,000 · 구매하기" })).toBeTruthy();
    expect(screen.queryByText("배송비 ₩3,000 (₩50,000 이상 구매 시 무료)")).toBeNull();
  });

  it("수량 2 → 버튼이 ₩56,000 · 구매하기 (상품가 × 수량)", () => {
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: "수량 더하기" }));
    expect(screen.getByRole("button", { name: "₩56,000 · 구매하기" })).toBeTruthy();
  });

  it("미로그인 사기 → LoginSheet(로그인이 필요해요)", async () => {
    authState.value = { status: "anonymous", user: null };
    renderBar();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "₩28,000 · 구매하기" }));
    });
    expect(screen.getByText("로그인이 필요해요")).toBeTruthy();
    expect(getCheckoutDefaults).not.toHaveBeenCalled();
  });

  it("로그인 + 기본 배송지 없음 → /checkout?qty", async () => {
    getCheckoutDefaults.mockResolvedValue({ address: null, lastPaymentMethod: null });
    renderBar();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "₩28,000 · 구매하기" }));
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/checkout?qty=1"));
  });

  it("기본값(배송지·지난 수단)을 못 읽어도 → 구매는 막지 않고 주문서로", async () => {
    getCheckoutDefaults.mockRejectedValueOnce(new Error("network"));
    renderBar();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "₩28,000 · 구매하기" }));
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/checkout?qty=1"));
    expect(screen.queryByText("주문 정보를 확인해 주세요")).toBeNull();
  });

  it("결제를 받기 전 → 사기 버튼은 그대로, 위 안내는 '출시 준비 중' + 출시 알림 링크", async () => {
    selectMock.value = false;
    getCheckoutDefaults.mockResolvedValue({ address: null, lastPaymentMethod: null });
    renderBar();
    // 안내 줄 전체가 출시 알림 링크(누르는 자리를 넓게)
    expect(
      screen.getByRole("link", { name: "판매 준비 중이에요. 출시 알림 신청" }).getAttribute("href"),
    ).toBe("/notify");
    expect(screen.getByText("배송비 ₩3,000 (₩50,000 이상 구매 시 무료)")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "₩28,000 · 구매하기" }));
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/checkout?qty=1"));
  });
});

describe("재구매 시트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSalesStatusCache();
    sessionStorage.clear();
    localStorage.clear();
    authState.value = { status: "authenticated", user: { userId: "u1" } };
    selectMock.value = true;
    getCheckoutDefaults.mockResolvedValue({ address: ADDRESS, lastPaymentMethod: "브랜드페이" });
  });

  async function openSheet() {
    renderBar();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "₩28,000 · 구매하기" }));
    });
    await screen.findByText("주문 정보를 확인해 주세요");
  }

  it("세 줄: 주소 · 지난 수단(가칭 브랜드페이) · 배송 메모 기본 '문 앞에 놓아 주세요'", async () => {
    await openSheet();
    expect(screen.getByText(/서울 중구 세종대로 110/)).toBeTruthy();
    expect(screen.getByText("suaci 바로결제")).toBeTruthy();
    expect(screen.getByText("문 앞에 놓아 주세요")).toBeTruthy();
  });

  it("반품 제한 고지(개봉·사용 후 단순 변심 불가) + 배송·교환·환불 안내 링크", async () => {
    await openSheet();
    expect(
      screen.getByText(/밀봉을 뜯었거나 사용한 화장품은 단순 변심으로 반품할 수 없어요\./),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "배송·교환·환불 안내" })).toHaveAttribute(
      "href",
      "/legal/refund",
    );
  });

  it("결제하기 → createOrder(메타데이터) → pending 저장 → 목업 결제창 이동", async () => {
    createOrder.mockResolvedValue({
      orderId: "o1",
      paymentStatus: "pending",
      orderNo: "20261026-A",
      totals: { grandTotal: 31000 },
    });
    await openSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "₩31,000 결제하기" }));
    });
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    const orderArgs = createOrder.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(orderArgs).toMatchObject({
      addressId: "a1",
      // 바로 구매 — 장바구니 없이 이 시트의 상품·수량을 주문에 싣는다
      items: [{ productId: PRODUCT.productId, variantId: PRODUCT.variantId, quantity: 1 }],
      metadata: { deliveryMemo: "문 앞에 놓아 주세요", channel: "web", screen: "rebuy-sheet" },
    });
    expect(readPendingOrder()).toMatchObject({ orderId: "o1", amount: 31000, qty: 1 });
    const url = (navigate.mock.calls[0] as string[])[0];
    expect(url).toBe(
      "https://x/pay/complete?o=o1&paymentKey=mock_BRANDPAY_k1234567&orderId=20261026-A&amount=31000",
    );
  });

  it("30분 안 pending(같은 금액) → 같은 멱등키 재사용", async () => {
    savePendingOrder({
      orderId: "prev",
      orderNo: "N",
      amount: 31000,
      idempotencyKey: "ik-prev",
      qty: 1,
      addressId: "a1",
      memo: "문 앞에 놓아 주세요",
    });
    createOrder.mockResolvedValue({
      orderId: "o2",
      orderNo: "B",
      paymentStatus: "pending",
      totals: { grandTotal: 31000 },
    });
    await openSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "₩31,000 결제하기" }));
    });
    await waitFor(() => expect(createOrder).toHaveBeenCalled());
    expect((createOrder.mock.calls[0]?.[0] as { idempotencyKey: string }).idempotencyKey).toBe(
      "ik-prev",
    );
  });

  it("이어 쓴 보류 주문이 이미 결제됐으면 → 결제창 대신 그 주문 상세로", async () => {
    savePendingOrder({
      orderId: "prev",
      orderNo: "N",
      amount: 31000,
      idempotencyKey: "ik-prev",
      qty: 1,
      addressId: "a1",
      memo: "문 앞에 놓아 주세요",
    });
    createOrder.mockResolvedValue({
      orderId: "prev",
      orderNo: "N",
      paymentStatus: "paid",
      totals: { grandTotal: 31000 },
    });
    await openSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "₩31,000 결제하기" }));
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/orders/prev"));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("pending 의 주소가 다르면 키를 재사용하지 않는다 — 옛 주소로 배송되면 안 된다", async () => {
    savePendingOrder({
      orderId: "prev",
      orderNo: "N",
      amount: 31000,
      idempotencyKey: "ik-prev",
      qty: 1,
      addressId: "OTHER",
      memo: "문 앞에 놓아 주세요",
    });
    createOrder.mockResolvedValue({
      orderId: "o2",
      orderNo: "B",
      paymentStatus: "pending",
      totals: { grandTotal: 31000 },
    });
    await openSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "₩31,000 결제하기" }));
    });
    await waitFor(() => expect(createOrder).toHaveBeenCalled());
    expect((createOrder.mock.calls[0]?.[0] as { idempotencyKey: string }).idempotencyKey).not.toBe(
      "ik-prev",
    );
  });

  it("주문을 못 만들면(품절) → 시트에 이유 한 줄, 결제창은 열지 않고 다시 누를 수 있다", async () => {
    createOrder.mockRejectedValueOnce(new ApiClientError("OUT_OF_STOCK", "재고가 부족합니다", 409));
    await openSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "₩31,000 결제하기" }));
    });
    expect(screen.getByRole("status").textContent).toBe("품절된 상품이에요.");
    expect(navigate).not.toHaveBeenCalled();
    expect(
      (screen.getByRole("button", { name: "₩31,000 결제하기" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("주문을 만들다 로그인이 풀리면(AUTH_REQUIRED) → 안내 한 줄 + 세션을 다시 확인한다", async () => {
    const recheckSession = vi.fn();
    authState.value = { status: "authenticated", user: { userId: "u1" }, recheckSession };
    createOrder.mockRejectedValueOnce(new ApiClientError("AUTH_REQUIRED", "Unauthorized", 401));
    await openSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "₩31,000 결제하기" }));
    });
    expect(screen.getByRole("status").textContent).toBe(
      "로그인 시간이 지났어요. 다시 로그인해 주세요.",
    );
    expect(recheckSession).toHaveBeenCalledTimes(1);
  });

  it("어댑터 없음 → '지금은 결제할 수 없어요.' + '결제 준비 중' 버튼 비활성, 눌러도 주문을 만들지 않는다", async () => {
    selectMock.value = false;
    await openSheet();
    expect(screen.getByText("지금은 결제할 수 없어요.")).toBeTruthy();
    const cta = screen.getByRole("button", { name: "결제 준비 중" }) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    await act(async () => {
      fireEvent.click(cta);
    });
    expect(createOrder).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("어댑터 없음 → 결제수단 줄에는 '변경'가 없다(고를 수단이 없다), 주소·메모 줄에는 있다", async () => {
    selectMock.value = false;
    await openSheet();
    expect(screen.getAllByRole("button", { name: "변경" })).toHaveLength(2);
  });
});

describe("이어서 줄(사기 바 위)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSalesStatusCache();
    sessionStorage.clear();
    authState.value = { status: "authenticated", user: { userId: "u1" } };
    selectMock.value = true;
  });

  it("pending 있으면 '결제하지 않은 주문이 있어요.' — 이어서는 그 수량으로 시트를 연다", async () => {
    savePendingOrder({
      orderId: "o1",
      orderNo: "N",
      amount: 56000,
      idempotencyKey: "ik",
      qty: 2,
      addressId: "a1",
      memo: "문 앞에 놓아 주세요",
    });
    getCheckoutDefaults.mockResolvedValue({ address: ADDRESS, lastPaymentMethod: null });
    await act(async () => {
      renderBar();
    });
    expect(screen.getByText("결제하지 않은 주문이 있어요.")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "이어서 결제하기" }));
    });
    expect(await screen.findByRole("button", { name: "₩56,000 결제하기" })).toBeTruthy();
  });

  it("보류 주문이 없으면 이어서 줄이 없다", () => {
    renderBar();
    expect(screen.queryByText("결제하지 않은 주문이 있어요.")).toBeNull();
  });
});
