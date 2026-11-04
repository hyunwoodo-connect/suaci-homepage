import { act, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { AuthProvider } from "@/lib/auth/auth-context";
import { tokenStore } from "@/lib/auth/token-store";

const { getMe, getOrder, listClaims } = vi.hoisted(() => ({
  getMe: vi.fn(),
  getOrder: vi.fn(),
  listClaims: vi.fn(),
}));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { getMe, getOrder, listClaims, logout: vi.fn() } };
});
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/orders/o1",
  Link: ({
    href,
    children,
  }: {
    href: string | { pathname: string };
    children: React.ReactNode;
  }) => <a href={typeof href === "string" ? href : href.pathname}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));

import OrderDetailPage from "./page";

async function renderPage() {
  await act(async () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <AuthProvider>
          <OrderDetailPage params={Promise.resolve({ orderId: "o1" })} />
        </AuthProvider>
      </NextIntlClientProvider>,
    );
  });
}

describe("주문 상세", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listClaims.mockResolvedValue([]);
    getMe.mockResolvedValue({ userId: "u1", name: "지우", email: "" });
  });

  it("로그인 안 했으면 '불러오는 중'에 멈추지 않고 로그인 버튼", async () => {
    await renderPage();
    expect(await screen.findByText("로그인하면 주문 내역을 볼 수 있어요.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "로그인 / 가입" }).getAttribute("href")).toBe("/login");
    expect(screen.queryByText("불러오는 중…")).toBeNull();
  });

  it("주문을 못 불러오면 이유와 주문 내역으로 돌아갈 길", async () => {
    tokenStore.save({ idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 });
    getOrder.mockRejectedValue(new Error("boom"));
    await renderPage();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/이 주문을 불러오지 못했어요/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "주문 내역으로" }).getAttribute("href")).toBe(
      "/orders",
    );
  });
});
