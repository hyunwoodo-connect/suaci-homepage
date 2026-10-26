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
