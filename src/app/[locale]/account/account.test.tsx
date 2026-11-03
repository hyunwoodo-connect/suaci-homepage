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

  it("판매 전 → 주문 내역은 잠긴 화면으로 가는 링크가 아니라 안내 + 출시 알림", async () => {
    tokenStore.save({ idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 });
    getMe.mockResolvedValue(USER);
    await renderPage();
    expect(screen.getByText("출시하면 여기서 볼 수 있어요.")).toBeTruthy();
    expect(document.querySelector('a[href="/orders"]')).toBeNull();
    expect(screen.getByRole("link", { name: "출시 알림 받기" }).getAttribute("href")).toBe(
      "/notify",
    );
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
