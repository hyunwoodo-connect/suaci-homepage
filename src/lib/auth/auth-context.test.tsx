import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { tokenStore } from "./token-store";

const { getMe, login, logout, withdrawAccount } = vi.hoisted(() => ({
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  withdrawAccount: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ api: { getMe, login, logout, withdrawAccount } }));

const TOKENS = { idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 };

/** 로그인해 있는 상태로 시작 */
async function renderSignedIn() {
  tokenStore.save(TOKENS);
  getMe.mockResolvedValue({ userId: "u1", name: "미나" });
  const view = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(view.result.current.status).toBe("authenticated"));
  return view;
}

import { AuthProvider, useAuth } from "./auth-context";

describe("adoptTokens", () => {
  it("소셜 로그인 토큰을 저장하고 내 정보를 받아 authenticated 로", async () => {
    getMe.mockResolvedValue({ userId: "u1", name: "미나" });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.status).toBe("anonymous"));
    await act(() =>
      result.current.adoptTokens({
        idToken: "i",
        accessToken: "a",
        refreshToken: "r",
        expiresIn: 60,
      }),
    );
    expect(tokenStore.getAccessToken()).toBe("a");
    expect(result.current.status).toBe("authenticated");
    expect(result.current.user).toMatchObject({ userId: "u1" });
    tokenStore.clear();
  });
});

describe("sessionEnded", () => {
  it("저장된 토큰이 안 맞으면(만료) → anonymous + sessionEnded, 토큰은 지운다", async () => {
    tokenStore.save({ idToken: "i", accessToken: "old", refreshToken: "r", expiresIn: 60 });
    getMe.mockRejectedValueOnce(new Error("AUTH_REQUIRED"));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.status).toBe("anonymous"));
    expect(result.current.sessionEnded).toBe(true);
    expect(tokenStore.getAccessToken()).toBeNull();
  });

  it("처음부터 토큰이 없으면 → anonymous 이지만 sessionEnded 는 false", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.status).toBe("anonymous"));
    expect(result.current.sessionEnded).toBe(false);
  });

  it("다시 로그인하면 → sessionEnded 가 풀린다", async () => {
    tokenStore.save({ idToken: "i", accessToken: "old", refreshToken: "r", expiresIn: 60 });
    getMe.mockRejectedValueOnce(new Error("AUTH_REQUIRED"));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.sessionEnded).toBe(true));
    getMe.mockResolvedValue({ userId: "u1" });
    await act(() =>
      result.current.adoptTokens({
        idToken: "i",
        accessToken: "a",
        refreshToken: "r",
        expiresIn: 60,
      }),
    );
    expect(result.current.sessionEnded).toBe(false);
    tokenStore.clear();
  });
});

describe("login", () => {
  it("이메일 로그인 → 토큰 저장 + 내 정보 + authenticated", async () => {
    login.mockResolvedValueOnce(TOKENS);
    getMe.mockResolvedValue({ userId: "u1" });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.status).toBe("anonymous"));
    await act(() => result.current.login("a@b.co", "pw"));
    expect(login).toHaveBeenCalledWith({ email: "a@b.co", password: "pw" });
    expect(tokenStore.getAccessToken()).toBe("a");
    expect(result.current.status).toBe("authenticated");
    tokenStore.clear();
  });

  it("비밀번호가 틀리면 → 던지고 anonymous 그대로, 토큰 없음", async () => {
    login.mockRejectedValueOnce(new Error("INVALID_CREDENTIALS"));
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.status).toBe("anonymous"));
    await expect(act(() => result.current.login("a@b.co", "x"))).rejects.toThrow();
    expect(result.current.status).toBe("anonymous");
    expect(tokenStore.getAccessToken()).toBeNull();
  });
});

describe("recheckSession", () => {
  it("토큰이 지워졌으면(다른 탭 로그아웃·만료) → anonymous + sessionEnded", async () => {
    const { result } = await renderSignedIn();
    tokenStore.clear();
    await act(() => result.current.recheckSession());
    expect(result.current.status).toBe("anonymous");
    expect(result.current.sessionEnded).toBe(true);
  });

  it("토큰이 있어도 내 정보를 못 받으면 → 세션 끝, 토큰도 지운다", async () => {
    const { result } = await renderSignedIn();
    getMe.mockRejectedValueOnce(new Error("AUTH_REQUIRED"));
    await act(() => result.current.recheckSession());
    expect(result.current.status).toBe("anonymous");
    expect(result.current.sessionEnded).toBe(true);
    expect(tokenStore.getAccessToken()).toBeNull();
  });

  it("세션이 살아 있으면 → authenticated 그대로", async () => {
    const { result } = await renderSignedIn();
    await act(() => result.current.recheckSession());
    expect(result.current.status).toBe("authenticated");
    expect(result.current.sessionEnded).toBe(false);
    tokenStore.clear();
  });
});

describe("logout", () => {
  it("서버 로그아웃이 실패해도 → 토큰 지우고 anonymous, '풀렸어요' 안내는 없다", async () => {
    const { result } = await renderSignedIn();
    logout.mockRejectedValueOnce(new Error("network"));
    await act(() => result.current.logout());
    expect(tokenStore.getAccessToken()).toBeNull();
    expect(result.current.status).toBe("anonymous");
    expect(result.current.sessionEnded).toBe(false);
  });
});

describe("withdraw", () => {
  it("탈퇴가 되면 → 토큰 지우고 anonymous, 서버 로그아웃은 부르지 않고 '풀렸어요' 안내도 없다", async () => {
    const { result } = await renderSignedIn();
    logout.mockClear();
    withdrawAccount.mockResolvedValueOnce({ withdrawn: true });
    await act(() => result.current.withdraw(true));
    expect(withdrawAccount).toHaveBeenCalledWith({ leaveWaitlist: true });
    expect(tokenStore.getAccessToken()).toBeNull();
    expect(result.current.status).toBe("anonymous");
    expect(result.current.user).toBeNull();
    expect(result.current.sessionEnded).toBe(false);
    expect(logout).not.toHaveBeenCalled();
  });

  it("막히거나 실패하면 → 던지고 로그인은 그대로", async () => {
    const { result } = await renderSignedIn();
    withdrawAccount.mockRejectedValueOnce(new Error("ACCOUNT_WITHDRAWAL_BLOCKED"));
    await expect(act(() => result.current.withdraw(false))).rejects.toThrow();
    expect(tokenStore.getAccessToken()).toBe("a");
    expect(result.current.status).toBe("authenticated");
    tokenStore.clear();
  });
});
