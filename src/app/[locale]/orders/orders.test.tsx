import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import type { BadgeTone } from "@/components/ui/Badge";
import { ApiClientError } from "@/lib/api";
import { AuthProvider } from "@/lib/auth/auth-context";
import { tokenStore } from "@/lib/auth/token-store";
import type { OrderState, OrderSummary } from "@/types";

const { getMe, listOrders } = vi.hoisted(() => ({ getMe: vi.fn(), listOrders: vi.fn() }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: { getMe, listOrders, logout: vi.fn() },
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/orders",
  Link: ({
    href,
    children,
  }: {
    href: string | { pathname: string };
    children: React.ReactNode;
  }) => <a href={typeof href === "string" ? href : href.pathname}>{children}</a>,
}));

// 뱃지는 색 이름만 드러낸다 — 색마다의 class 가 바뀌어도 '어느 상태가 어느 색인가'는 그대로 본다
vi.mock("@/components/ui/Badge", () => ({
  default: ({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) => (
    <span data-tone={tone}>{children}</span>
  ),
}));

import OrdersPage from "./page";

/** 목록 한 줄 — 서버가 주는 모양 그대로(상태 이름 `state` 포함). 바꿀 칸만 넘긴다 */
function summary(over: Partial<OrderSummary> = {}): OrderSummary {
  return {
    orderId: "o1",
    orderNo: "20261109-AAA111",
    state: "paid",
    status: "open",
    paymentStatus: "paid",
    fulfillmentStatus: "unfulfilled",
    grandTotal: 31000,
    hasOpenClaim: false,
    createdAt: Date.UTC(2026, 10, 9),
    createdDtm: "",
    ...over,
  };
}

async function renderPage() {
  await act(async () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <AuthProvider>
          <OrdersPage />
        </AuthProvider>
      </NextIntlClientProvider>,
    );
  });
}

describe("주문 내역", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenStore.save({ idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 });
    getMe.mockResolvedValue({ userId: "u1", name: "지우", email: "" });
  });

  it("상태는 손님 말로 — 'pending' 같은 값이 그대로 보이지 않는다", async () => {
    listOrders.mockResolvedValue({
      data: [summary({ state: "awaitingPayment", status: "pending", paymentStatus: "pending" })],
    });
    await renderPage();
    expect(screen.getByText(/결제 대기/)).toBeTruthy();
    expect(screen.queryByText(/pending/)).toBeNull();
  });

  // 세 축 값은 그대로 두고 state 만 바꾼다 — 목록은 상태 이름을 서버 값에서만 읽는다
  it.each<[OrderState, string, BadgeTone]>([
    ["awaitingPayment", "결제 대기", "neutral"],
    ["paid", "결제완료", "neutral"],
    ["preparing", "상품준비중", "neutral"],
    ["shipping", "배송중", "neutral"],
    ["delivered", "배송완료", "done"],
    ["returnInProgress", "반품 진행 중", "neutral"],
    ["exchangeInProgress", "교환 진행 중", "neutral"],
    ["refunding", "환불 처리 중", "neutral"],
    ["partiallyRefunded", "부분환불", "neutral"],
    ["refunded", "환불완료", "muted"],
    ["cancelled", "주문취소", "muted"],
  ])("서버가 준 상태 %s → '%s' 뱃지(%s)", async (state, label, tone) => {
    listOrders.mockResolvedValue({ data: [summary({ state })] });
    await renderPage();
    expect(screen.getByText(label).dataset.tone).toBe(tone);
  });

  it("받은 주문에 반품·교환이 진행 중 → '배송완료'가 아니라 반품·교환을 나눠 그 이름", async () => {
    const delivered = { fulfillmentStatus: "delivered", hasOpenClaim: true } as const;
    listOrders.mockResolvedValue({
      data: [
        summary({ ...delivered, orderId: "o1", state: "returnInProgress" }),
        summary({ ...delivered, orderId: "o2", state: "exchangeInProgress" }),
      ],
    });
    await renderPage();
    expect(screen.getByText("반품 진행 중")).toBeTruthy();
    expect(screen.getByText("교환 진행 중")).toBeTruthy();
    expect(screen.queryByText("배송완료")).toBeNull();
  });

  it("한 줄에 무엇을 몇 개 — 여러 줄이면 '외 N건'", async () => {
    const mist = { productName: "mist", productNameKo: "라임바질 미스트" };
    listOrders.mockResolvedValue({
      data: [
        summary({ orderId: "o1", itemSummary: { ...mist, quantity: 1, lineCount: 1 } }),
        summary({
          orderId: "o2",
          orderNo: "20261109-BBB222",
          grandTotal: 90000,
          itemSummary: { ...mist, quantity: 3, lineCount: 2 },
        }),
      ],
    });
    await renderPage();
    expect(screen.getByText("라임바질 미스트 × 1")).toBeTruthy();
    expect(screen.getByText("라임바질 미스트 외 1건 · 3개")).toBeTruthy();
  });

  it("없으면 → 안내 + 제품으로 가는 길", async () => {
    listOrders.mockResolvedValue({ data: [] });
    await renderPage();
    expect(screen.getByText("주문 내역이 없어요.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "상품 보러 가기" })).toBeTruthy();
  });

  it("받는 중에는 → 뼈대만, '주문 내역이 없어요'를 먼저 띄우지 않는다", async () => {
    listOrders.mockReturnValue(new Promise(() => {}));
    await renderPage();
    expect(screen.getByRole("status", { name: "불러오는 중…" })).toBeTruthy();
    expect(screen.queryByText("주문 내역이 없어요.")).toBeNull();
  });

  it("못 불러오면 → '다시 시도'로 다시 받는다", async () => {
    listOrders.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce({ data: [] });
    await renderPage();
    expect(screen.getByRole("alert").textContent).toBe("주문 내역을 불러오지 못했어요.");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    });
    expect(listOrders).toHaveBeenCalledTimes(2);
    expect(screen.getByText("주문 내역이 없어요.")).toBeTruthy();
  });

  it("받다가 로그인이 풀리면(AUTH_REQUIRED) → '다시 시도'가 아니라 '로그인이 풀렸어요' + 로그인 버튼", async () => {
    listOrders.mockRejectedValueOnce(new ApiClientError("AUTH_REQUIRED", "Unauthorized", 401));
    getMe.mockResolvedValueOnce({ userId: "u1", name: "지우", email: "" });
    getMe.mockRejectedValueOnce(new ApiClientError("AUTH_REQUIRED", "Unauthorized", 401));
    await renderPage();
    expect(screen.getByText("로그인이 풀렸어요. 다시 들어와 주세요.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "다시 시도" })).toBeNull();
    expect(screen.getByRole("link", { name: "로그인" }).getAttribute("href")).toBe("/login");
  });

  it("로그인 안 했으면 → '로그인이 필요해요.' + 로그인 버튼", async () => {
    tokenStore.clear();
    await renderPage();
    expect(screen.getByText("로그인이 필요해요.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "로그인" }).getAttribute("href")).toBe("/login");
  });
});
