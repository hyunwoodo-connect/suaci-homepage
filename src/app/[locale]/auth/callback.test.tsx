import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => {
    vi.restoreAllMocks();
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
    // 인가 때 쓴 state 를 그대로 서버에 넘긴다(네이버는 토큰 요청에 필요)
    expect(socialSignIn).toHaveBeenCalledWith(
      "kakao",
      expect.objectContaining({ code: "mock:kakao:mina", state: nonce }),
    );
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

  it("state 불일치 → 교환을 부르지 않고 '끊겼어요' 안내 + 로그인 버튼을 다시", async () => {
    createLoginState("/");
    searchParams.value = new URLSearchParams({ code: "mock:kakao:mina", state: "forged" });
    await act(async () => {
      renderPage();
    });
    expect(socialSignIn).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "로그인하지 못했어요" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "카카오 로그인" })).toBeTruthy();
  });

  it("교환이 실패하면 → '끊겼어요' 안내(결제 문구가 아니라 로그인 문구)", async () => {
    const nonce = createLoginState("/");
    searchParams.value = new URLSearchParams({ code: "mock:kakao:mina", state: nonce });
    socialSignIn.mockRejectedValue(new Error("network"));
    await act(async () => {
      renderPage();
    });
    expect(screen.getByRole("heading", { name: "로그인하지 못했어요" })).toBeTruthy();
    expect(screen.queryByText(/결제/)).toBeNull();
  });

  it("access_denied 뒤 다시 누르면 → 원래 가던 곳(next)을 이어 간다", async () => {
    const nonce = createLoginState("/?buy=1");
    searchParams.value = new URLSearchParams({ error: "access_denied", state: nonce });
    await act(async () => {
      renderPage();
    });
    fireEvent.click(screen.getByRole("button", { name: "카카오 로그인" }));
    const saved = JSON.parse(sessionStorage.getItem("suaci.auth.state") ?? "{}") as {
      next?: string;
    };
    expect(saved.next).toBe("/?buy=1");
  });

  it("프로바이더가 다른 오류로 돌려보내면(검수 전 네이버 등) → 그 프로바이더 이름으로 안내, 교환하지 않는다", async () => {
    routeParams.value = { provider: "naver" };
    searchParams.value = new URLSearchParams({ error: "invalid_request", state: "x" });
    await act(async () => {
      renderPage();
    });
    expect(socialSignIn).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "네이버로 로그인하지 못했어요" })).toBeTruthy();
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

  it.each(["kakao", "naver"])(
    "access_denied(%s) → 프로바이더를 권하지 않는 한 문장, 교환을 부르지 않는다",
    async (provider) => {
      routeParams.value = { provider };
      searchParams.value = new URLSearchParams({ error: "access_denied", state: "x" });
      await act(async () => {
        renderPage();
      });
      expect(socialSignIn).not.toHaveBeenCalled();
      expect(screen.getByRole("heading", { name: "로그인을 취소했어요" })).toBeTruthy();
    },
  );

  it("모르는 프로바이더(/auth/google/callback) → notFound, 교환을 부르지 않는다", () => {
    // 렌더 중 던진 notFound 를 React 가 console.error 로 한 번 더 찍는다 — 소리만 끈다
    vi.spyOn(console, "error").mockImplementation(() => {});
    routeParams.value = { provider: "google" };
    searchParams.value = new URLSearchParams({ code: "c", state: "x" });
    expect(() => renderPage()).toThrow("notFound");
    expect(socialSignIn).not.toHaveBeenCalled();
  });
});
