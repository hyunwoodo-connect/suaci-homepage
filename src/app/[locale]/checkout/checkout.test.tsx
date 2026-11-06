import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";

const { listAddresses, createAddress, createOrder, navigate, push, searchParams, payReady } =
  vi.hoisted(() => ({
    listAddresses: vi.fn(),
    createAddress: vi.fn(),
    createOrder: vi.fn(),
    navigate: vi.fn(),
    push: vi.fn(),
    searchParams: { value: new URLSearchParams("qty=1") },
    payReady: { value: true },
  }));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    api: { listAddresses, createAddress, createOrder },
  };
});
vi.mock("@/lib/auth/auth-context", () => ({
  useAuth: () => ({ status: "authenticated", user: { userId: "u1" } }),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/checkout",
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams.value,
}));
vi.mock("@/lib/payment/providers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/payment/providers")>();
  return {
    ...actual,
    selectPaymentAdapters: () =>
      payReady.value
        ? [actual.createMockAdapter({ origin: "https://x", navigate, newKey: () => "k1234567" })]
        : [],
  };
});

// Daum 레이어 스텁
vi.stubGlobal("daum", {
  Postcode: class {
    oncomplete: (d: { zonecode: string; roadAddress: string }) => void;
    constructor(opts: { oncomplete: (d: { zonecode: string; roadAddress: string }) => void }) {
      this.oncomplete = opts.oncomplete;
    }
    embed() {}
  },
});

import { savePendingOrder } from "@/lib/payment/pending";

import CheckoutPage from "./page";

const ADDRESS = {
  addressId: "a1",
  recipient: "미나",
  phone: "010-1234-5678",
  zipcode: "04524",
  addr1: "서울 중구 세종대로 110",
  addr2: "10층",
  isDefault: true,
};

function renderPage() {
  return render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <CheckoutPage />
    </NextIntlClientProvider>,
  );
}

describe("주문서(첫 구매)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    searchParams.value = new URLSearchParams("qty=1");
    payReady.value = true;
  });

  it("결제를 받기 전(어댑터 없음) → 주문서는 보이고, '결제 준비 중' 비활성 + 출시 알림, 주문은 만들지 않는다", async () => {
    payReady.value = false;
    listAddresses.mockResolvedValue([ADDRESS]);
    await act(async () => {
      renderPage();
    });
    expect(await screen.findByText(/서울 중구 세종대로 110/)).toBeTruthy();
    // 맨 위 한 줄 + 결제수단은 흐리게 보이고 왜 안 되는지 붙는다(카드 심사자·손님이 헷갈리지 않게)
    expect(
      screen.getByText(
        "판매 시작 전이라 아직 결제할 수 없어요. 배송지는 미리 저장해 둘 수 있어요.",
      ),
    ).toBeTruthy();
    for (const m of ["신용·체크카드", "카카오페이", "네이버페이", "토스페이"]) {
      expect((screen.getByRole("button", { name: m }) as HTMLButtonElement).disabled).toBe(true);
    }
    expect(screen.queryByRole("radio")).toBeNull();
    // 같은 안내를 한 화면에 두 번 쓰지 않는다(위 한 줄만)
    expect(screen.queryByText("출시 전이라 아직 결제할 수 없어요.")).toBeNull();
    expect(screen.getByText("₩31,000")).toBeTruthy();
    const cta = screen.getByRole("button", { name: "결제 준비 중" }) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    expect(screen.getByRole("link", { name: "출시 알림 신청" })).toHaveAttribute("href", "/notify");
    await act(async () => {
      fireEvent.click(cta);
    });
    expect(createOrder).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("주소 없음 → '배송지 입력' + 주소 폼", async () => {
    listAddresses.mockResolvedValue([]);
    await act(async () => {
      renderPage();
    });
    expect(await screen.findByText("배송지 입력")).toBeTruthy();
    expect(screen.getByText("도로명, 지번, 건물명으로 검색하세요.")).toBeTruthy();
  });

  it("주소 있으면 카드 + 결제하기 → createOrder(screen checkout) → 목업 결제창", async () => {
    listAddresses.mockResolvedValue([ADDRESS]);
    createOrder.mockResolvedValue({
      orderId: "o1",
      orderNo: "20261026-A",
      totals: { grandTotal: 31000 },
    });
    await act(async () => {
      renderPage();
    });
    expect(await screen.findByText(/서울 중구 세종대로 110/)).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "₩31,000 결제하기" }));
    });
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
    expect(createOrder.mock.calls[0]?.[0]).toMatchObject({
      addressId: "a1",
      items: [expect.objectContaining({ quantity: 1 })],
      metadata: { deliveryMemo: "문 앞에 놓아 주세요", channel: "web", screen: "checkout" },
    });
    expect((navigate.mock.calls[0] as string[])[0]).toBe(
      "https://x/pay/complete?o=o1&paymentKey=mock_CARD_k1234567&orderId=20261026-A&amount=31000",
    );
  });
});

describe("주문서 — 반품 제한 고지(전자상거래법 제17조제6항)", () => {
  it("결제 버튼 위에 개봉·사용 후 단순 변심 반품 불가 + 배송·교환·환불 안내 링크", async () => {
    vi.clearAllMocks();
    searchParams.value = new URLSearchParams("qty=1");
    listAddresses.mockResolvedValue([ADDRESS]);
    await act(async () => {
      renderPage();
    });
    expect(
      await screen.findByText(/개봉하거나 사용한 화장품은 단순 변심으로 반품할 수 없어요\./),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "배송·교환·환불 안내" })).toHaveAttribute(
      "href",
      "/legal/refund",
    );
  });
});

describe("주문서 — 이어가기 수량", () => {
  it("qty 쿼리가 없으면 pending.qty 로 — '적은 건 그대로'", async () => {
    sessionStorage.clear();
    vi.clearAllMocks();
    searchParams.value = new URLSearchParams();
    savePendingOrder({
      orderId: "o1",
      orderNo: "N",
      amount: 56000,
      idempotencyKey: "ik",
      qty: 2,
      addressId: "a1",
      memo: "문 앞에 놓아 주세요",
    });
    listAddresses.mockResolvedValue([ADDRESS]);
    await act(async () => {
      renderPage();
    });
    expect(await screen.findByRole("button", { name: "₩56,000 결제하기" })).toBeTruthy();
  });
});
