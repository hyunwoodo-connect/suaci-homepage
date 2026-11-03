import { act, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { AuthProvider } from "@/lib/auth/auth-context";
import { tokenStore } from "@/lib/auth/token-store";

const { getMe, listAddresses } = vi.hoisted(() => ({
  getMe: vi.fn(),
  listAddresses: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  api: { getMe, listAddresses, logout: vi.fn() },
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/account",
  Link: ({
    href,
    children,
  }: {
    href: string | { pathname: string };
    children: React.ReactNode;
  }) => <a href={typeof href === "string" ? href : href.pathname}>{children}</a>,
}));

import AccountPage from "./page";

const USER = {
  userId: "u1",
  email: "",
  name: "지우",
  status: "active",
  createdAt: Date.UTC(2026, 10, 2, 16, 0), // KST 11/03 01:00
  createdDtm: "2026-11-03T01:00:00+09:00",
};

async function renderPage() {
  await act(async () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <AuthProvider>
          <AccountPage />
        </AuthProvider>
      </NextIntlClientProvider>,
    );
  });
}

describe("내 계정", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenStore.clear();
    listAddresses.mockResolvedValue([]);
  });

  it("로그인 → 인사·가입일(KST), 내부 상태값(ACTIVE)은 안 보인다", async () => {
    tokenStore.save({ idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 });
    getMe.mockResolvedValue(USER);
    await renderPage();
    expect(screen.getByText("지우님, 반가워요.")).toBeTruthy();
    expect(screen.getByText("2026.11.03")).toBeTruthy();
    expect(screen.queryByText(/active/i)).toBeNull();
  });

  it("이메일이 비어 있으면(카카오가 안 줌) → 이메일 줄을 그리지 않는다", async () => {
    tokenStore.save({ idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 });
    getMe.mockResolvedValue(USER);
    await renderPage();
    // 푸터 사업자 정보에도 '이메일'이 있어 계정 정보 목록 안에서만 본다
    const info = screen.getByText("가입일").closest("dl")!;
    expect(within(info as HTMLElement).queryByText("이메일")).toBeNull();
  });

  it("주문 내역 → /orders 링크(주문 화면은 출시 전에도 열려 있다)", async () => {
    tokenStore.save({ idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 });
    getMe.mockResolvedValue(USER);
    await renderPage();
    expect(document.querySelector('a[href="/orders"]')).not.toBeNull();
  });

  it("배송지가 없으면 → 배송지 줄에 '아직 없어요'", async () => {
    tokenStore.save({ idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 });
    getMe.mockResolvedValue(USER);
    await renderPage();
    await waitFor(() => expect(screen.getByText("아직 없어요")).toBeTruthy());
  });

  it("저장된 로그인이 풀렸으면 → '로그인이 풀렸어요' + 로그인 버튼", async () => {
    tokenStore.save({ idToken: "i", accessToken: "old", refreshToken: "r", expiresIn: 60 });
    getMe.mockRejectedValue(new Error("AUTH_REQUIRED"));
    await renderPage();
    await waitFor(() =>
      expect(screen.getByText("로그인이 풀렸어요. 다시 들어와 주세요.")).toBeTruthy(),
    );
    expect(screen.getByRole("link", { name: "로그인 / 가입" })).toBeTruthy();
  });
});
