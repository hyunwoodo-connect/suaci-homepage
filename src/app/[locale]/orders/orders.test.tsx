import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { ApiClientError } from "@/lib/api";
import { AuthProvider } from "@/lib/auth/auth-context";
import { tokenStore } from "@/lib/auth/token-store";

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

import OrdersPage from "./page";

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
      data: [
        {
          orderId: "o1",
          orderNo: "20261103-ABC123",
          status: "pending",
          paymentStatus: "pending",
          grandTotal: 31000,
          createdAt: Date.UTC(2026, 10, 3),
          createdDtm: "",
        },
      ],
    });
    await renderPage();
    expect(screen.getByText(/결제 대기/)).toBeTruthy();
    expect(screen.queryByText(/pending/)).toBeNull();
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
