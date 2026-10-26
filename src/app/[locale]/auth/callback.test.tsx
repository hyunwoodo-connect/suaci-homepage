import { act, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";
import { createLoginState } from "@/lib/auth/social";
import { AuthProvider } from "@/lib/auth/auth-context";
import { tokenStore } from "@/lib/auth/token-store";

const { socialSignIn, getMe, replace, searchParams, routeParams } = vi.hoisted(() => ({
  socialSignIn: vi.fn(),
  getMe: vi.fn(),
  replace: vi.fn(),
  searchParams: { value: new URLSearchParams() },
  routeParams: { value: { provider: "kakao" } as Record<string, string> },
}));
vi.mock("@/lib/api", () => ({
  api: { socialSignIn, getMe, logout: vi.fn() },
  ApiClientError: class extends Error {},
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/auth/kakao/callback",
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParams.value,
  useParams: () => routeParams.value,
  notFound: () => {
    throw new Error("notFound");
  },
}));

import CallbackPage from "./[provider]/callback/page";

function renderPage() {
  return render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <AuthProvider>
        <CallbackPage />
      </AuthProvider>
    </NextIntlClientProvider>,
  );
}

describe("소셜 콜백", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    routeParams.value = { provider: "kakao" };
  });

  it("signed_in → 토큰 입양 + next 로 replace + lastProvider 기록", async () => {
    const nonce = createLoginState("/?buy=1");
    searchParams.value = new URLSearchParams({ code: "mock:kakao:mina", state: nonce });
    socialSignIn.mockResolvedValue({
      status: "signed_in",
      tokens: { idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 },
    });
    getMe.mockResolvedValue({ userId: "u1", name: "미나" });
    await act(async () => {
      renderPage();
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/?buy=1"));
    expect(tokenStore.getAccessToken()).toBe("a");
    expect(localStorage.getItem("suaci.auth.lastProvider")).toBe("kakao");
    tokenStore.clear();
  });

  it("needs_consent → 가입 표를 담고 /auth/consent 로", async () => {
    const nonce = createLoginState("/");
    searchParams.value = new URLSearchParams({ code: "mock:kakao:mina", state: nonce });
    socialSignIn.mockResolvedValue({ status: "needs_consent", signupToken: "t1", name: "mina" });
    await act(async () => {
      renderPage();
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/auth/consent"));
    const stash = JSON.parse(sessionStorage.getItem("suaci.auth.signup") ?? "{}") as {
      signupToken: string;
      provider: string;
      next: string;
    };
    expect(stash).toMatchObject({ signupToken: "t1", provider: "kakao", next: "/" });
  });

  it("state 불일치 → 교환을 부르지 않고 '꼬였어요' 안내", async () => {
    createLoginState("/");
    searchParams.value = new URLSearchParams({ code: "mock:kakao:mina", state: "forged" });
    await act(async () => {
      renderPage();
    });
    expect(socialSignIn).not.toHaveBeenCalled();
    expect(screen.getByText("로그인이 꼬였어요. 처음부터 다시 해 주세요.")).toBeTruthy();
  });

  it("next 가 //evil.com 이면 / 로 — 오픈 리다이렉트 차단", async () => {
    const nonce = createLoginState("//evil.com");
    searchParams.value = new URLSearchParams({ code: "mock:kakao:mina", state: nonce });
    socialSignIn.mockResolvedValue({
      status: "signed_in",
      tokens: { idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 },
    });
    getMe.mockResolvedValue({ userId: "u1" });
    await act(async () => {
      renderPage();
    });
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    tokenStore.clear();
  });

  it("access_denied(kakao) → '괜찮아요. 네이버로 해도 돼요.'", async () => {
    searchParams.value = new URLSearchParams({ error: "access_denied", state: "x" });
    await act(async () => {
      renderPage();
    });
    expect(socialSignIn).not.toHaveBeenCalled();
    expect(screen.getByText("괜찮아요. 네이버로 해도 돼요.")).toBeTruthy();
  });
});
