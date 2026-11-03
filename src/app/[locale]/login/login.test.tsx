import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { AuthProvider } from "@/lib/auth/auth-context";
import { tokenStore } from "@/lib/auth/token-store";

const { getMe, replace, searchParams } = vi.hoisted(() => ({
  getMe: vi.fn(),
  replace: vi.fn(),
  searchParams: { value: new URLSearchParams() },
}));
vi.mock("@/lib/api", () => ({
  api: { login: vi.fn(), getMe, logout: vi.fn() },
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
  usePathname: () => "/login",
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === "string" ? href : "#"}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams.value,
}));

import LoginPage from "./page";

async function renderPage() {
  await act(async () => {
    render(
      <NextIntlClientProvider locale="ko" messages={ko}>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </NextIntlClientProvider>,
    );
  });
}

describe("로그인 페이지", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    tokenStore.clear();
    searchParams.value = new URLSearchParams();
  });

  it("소셜 둘 + 가입·로그인 둘 다에 맞는 안내, google/apple/line 은 없다", async () => {
    await renderPage();
    expect(screen.getByRole("button", { name: "카카오 로그인" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "네이버 로그인" })).toBeTruthy();
    expect(screen.getByText("처음이어도, 다시 왔어도 같은 버튼이에요.")).toBeTruthy();
    expect(screen.queryByText(/google|apple|line/)).toBeNull();
  });

  it("이메일 폼은 접혀 있고 '이메일로 로그인'을 누르면 보인다", async () => {
    await renderPage();
    expect(screen.queryByLabelText("이메일")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "이메일로 로그인" }));
    expect(screen.getByLabelText("이메일")).toBeTruthy();
    expect(screen.getByLabelText("비밀번호")).toBeTruthy();
  });

  it("지난번에 카카오로 들어왔으면 → 그 버튼을 알려 준다(다른 버튼이면 계정이 하나 더 생긴다)", async () => {
    localStorage.setItem("suaci.auth.lastProvider", "kakao");
    await renderPage();
    await waitFor(() => expect(screen.getByText("지난번엔 카카오로 들어왔어요.")).toBeTruthy());
  });

  it("비밀번호를 바꾸고 오면(?reset=1) → 안내 + 이메일 폼이 열려 있다", async () => {
    searchParams.value = new URLSearchParams({ reset: "1" });
    await renderPage();
    expect(screen.getByText("비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.")).toBeTruthy();
    expect(screen.getByLabelText("이메일")).toBeTruthy();
  });

  it("이미 로그인했어도 next 가 다른 사이트로 새는 값(/\\evil.com)이면 → 내 계정으로", async () => {
    tokenStore.save({ idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 });
    getMe.mockResolvedValue({ userId: "u1", name: "미나" });
    searchParams.value = new URLSearchParams({ next: "/\\evil.com" });
    await renderPage();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/account"));
    expect(replace).not.toHaveBeenCalledWith("/\\evil.com");
    tokenStore.clear();
  });

  it("이미 로그인한 회원 → 로그인 화면 대신 next 로", async () => {
    tokenStore.save({ idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 });
    getMe.mockResolvedValue({ userId: "u1", name: "미나" });
    searchParams.value = new URLSearchParams({ next: "/account/addresses" });
    await renderPage();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/account/addresses"));
    tokenStore.clear();
  });
});
