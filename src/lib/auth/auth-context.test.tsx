import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { tokenStore } from "./token-store";

const { getMe } = vi.hoisted(() => ({ getMe: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { getMe, login: vi.fn(), logout: vi.fn() } }));

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
