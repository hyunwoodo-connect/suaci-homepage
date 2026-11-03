import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { AuthProvider } from "@/lib/auth/auth-context";
import { tokenStore } from "@/lib/auth/token-store";

const { getMe, listOrders } = vi.hoisted(() => ({ getMe: vi.fn(), listOrders: vi.fn() }));
vi.mock("@/lib/api", () => ({
  api: { getMe, listOrders, logout: vi.fn() },
  ApiClientError: class extends Error {},
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
    expect(screen.getByText("아직 주문이 없어요.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "take-01 보러 가기" })).toBeTruthy();
  });
});
