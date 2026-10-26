import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { createMockAdapter } from "@/lib/payment/providers";
import { readPendingOrder, savePendingOrder } from "@/lib/payment/pending";

const { getCheckoutDefaults, createOrder, authState, cartState, navigate, selectMock, push } =
  vi.hoisted(() => ({
    getCheckoutDefaults: vi.fn(),
    createOrder: vi.fn(),
    authState: {
      value: { status: "authenticated", user: { userId: "u1" } } as Record<string, unknown>,
    },
    cartState: { value: { items: [] as unknown[] } },
    navigate: vi.fn(),
    selectMock: { value: true },
    push: vi.fn(),
  }));
vi.mock("@/lib/api", () => ({
  api: { getCheckoutDefaults, createOrder },
}));
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => authState.value,
}));
vi.mock("@/lib/cart/cart-context", () => ({
  useCart: () => ({
    cart: cartState.value,
    clear: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/payment/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payment/providers")>();
  return {
    ...actual,
    selectPaymentAdapters: () =>
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
    sessionStorage.clear();
    localStorage.clear();
    authState.value = { status: "authenticated", user: { userId: "u1" } };
    cartState.value = { items: [] };
    selectMock.value = true;
  });

  it("수량 2 → 버튼이 ₩56,000 · 사기 (배송비 포함: 5만 넘어 무료)", () => {
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: "수량 늘리기" }));
    expect(screen.getByRole("button", { name: "₩56,000 · 사기" })).toBeTruthy();
    expect(screen.getByText("배송비 포함이에요.")).toBeTruthy();
  });

  it("미로그인 사기 → LoginSheet(누군지만 알려 주세요.)", async () => {
    authState.value = { status: "anonymous", user: null };
    renderBar();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "₩31,000 · 사기" }));
    });
    expect(screen.getByText("누군지만 알려 주세요.")).toBeTruthy();
    expect(getCheckoutDefaults).not.toHaveBeenCalled();
  });

  it("로그인 + 기본 배송지 없음 → /checkout?qty&first=1", async () => {
    getCheckoutDefaults.mockResolvedValue({ address: null, lastPaymentMethod: null });
    renderBar();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "₩31,000 · 사기" }));
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/checkout?qty=1&first=1"));
  });
});

describe("재구매 시트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    authState.value = { status: "authenticated", user: { userId: "u1" } };
    selectMock.value = true;
    getCheckoutDefaults.mockResolvedValue({ address: ADDRESS, lastPaymentMethod: "브랜드페이" });
  });

  async function openSheet() {
    renderBar();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "₩31,000 · 사기" }));
    });
    await screen.findByText("지난번처럼 보낼게요.");
  }

  it("세 줄: 주소 · 지난 수단(가칭 브랜드페이) · 배송 메모 기본 '문 앞'", async () => {
    await openSheet();
    expect(screen.getByText(/서울 중구 세종대로 110/)).toBeTruthy();
    expect(screen.getByText("suaci 바로결제")).toBeTruthy();
    expect(screen.getByText("문 앞")).toBeTruthy();
  });

  it("결제하기 → createOrder(메타데이터) → pending 저장 → 목업 결제창 이동", async () => {
    createOrder.mockResolvedValue({
      orderId: "o1",
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
      metadata: { deliveryMemo: "문 앞", channel: "web", screen: "rebuy-sheet" },
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
      memo: "문 앞",
    });
    createOrder.mockResolvedValue({ orderId: "o2", orderNo: "B", totals: { grandTotal: 31000 } });
    await openSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "₩31,000 결제하기" }));
    });
    await waitFor(() => expect(createOrder).toHaveBeenCalled());
    expect((createOrder.mock.calls[0]?.[0] as { idempotencyKey: string }).idempotencyKey).toBe(
      "ik-prev",
    );
  });

  it("pending 의 주소가 다르면 키를 재사용하지 않는다 — 옛 주소로 배송되면 안 된다", async () => {
    savePendingOrder({
      orderId: "prev",
      orderNo: "N",
      amount: 31000,
      idempotencyKey: "ik-prev",
      qty: 1,
      addressId: "OTHER",
      memo: "문 앞",
    });
    createOrder.mockResolvedValue({ orderId: "o2", orderNo: "B", totals: { grandTotal: 31000 } });
    await openSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "₩31,000 결제하기" }));
    });
    await waitFor(() => expect(createOrder).toHaveBeenCalled());
    expect((createOrder.mock.calls[0]?.[0] as { idempotencyKey: string }).idempotencyKey).not.toBe(
      "ik-prev",
    );
  });

  it("어댑터 없음 → '아직 결제를 준비 중이에요.' + 버튼 비활성", async () => {
    selectMock.value = false;
    await openSheet();
    expect(screen.getByText("아직 결제를 준비 중이에요.")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "₩31,000 결제하기" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});

describe("ResumeStrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    authState.value = { status: "authenticated", user: { userId: "u1" } };
    cartState.value = { items: [] };
  });

  it("pending 있으면 '아까 하던 주문, 이어서 할까요?' — 이어서는 그 수량으로 시트를 연다", async () => {
    savePendingOrder({
      orderId: "o1",
      orderNo: "N",
      amount: 56000,
      idempotencyKey: "ik",
      qty: 2,
      addressId: "a1",
      memo: "문 앞",
    });
    getCheckoutDefaults.mockResolvedValue({ address: ADDRESS, lastPaymentMethod: null });
    await act(async () => {
      renderBar();
    });
    expect(screen.getByText("아까 하던 주문, 이어서 할까요?")).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "이어서" }));
    });
    expect(await screen.findByRole("button", { name: "₩56,000 결제하기" })).toBeTruthy();
  });

  it("pending 없고 카트에 있으면 '담아 둔 게 있어요.'", () => {
    cartState.value = { items: [{ lineId: "l1" }] };
    renderBar();
    expect(screen.getByText("담아 둔 게 있어요.")).toBeTruthy();
  });
});
