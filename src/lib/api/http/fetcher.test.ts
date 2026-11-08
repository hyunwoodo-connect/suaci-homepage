import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFetcher } from "./fetcher";
import { createHttpClient } from "./index";
import { tokenStore } from "@/lib/auth/token-store";

function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  });
}

describe("http client", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("envelope 언랩: {data} → data", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { data: { sent: true } }));
    const api = createHttpClient("https://api.test");
    const r = await api.forgotPassword("a@b.c");
    expect(r.sent).toBe(true);
  });

  it("에러 매핑: {error,message,field} → ApiClientError", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchOnce(400, {
        error: "PAYMENT_AMOUNT_MISMATCH",
        message: "금액불일치",
        field: "amount",
      }),
    );
    const api = createHttpClient("https://api.test");
    await expect(api.confirmPayment("o1", { paymentKey: "k", amount: 1 })).rejects.toMatchObject({
      code: "PAYMENT_AMOUNT_MISMATCH",
      status: 400,
      field: "amount",
    });
  });

  it("인증헤더 주입 + 401시 refresh 1회 후 재요청", async () => {
    tokenStore.save({ idToken: "i", accessToken: "old", refreshToken: "r", expiresIn: 1 });
    const fetchMock = vi
      .fn()
      // 1) 최초 보호요청 401
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "UNAUTHORIZED", message: "만료" }),
      })
      // 2) refresh 성공
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: { idToken: "i2", accessToken: "new", refreshToken: "r2", expiresIn: 3600 },
          }),
      })
      // 3) 재요청 성공
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: {
              userId: "u",
              email: "e",
              name: "n",
              status: "active",
              createdAt: 1,
              createdDtm: "x",
            },
          }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const api = createHttpClient("https://api.test");
    const me = await api.getMe();
    expect(me.userId).toBe("u");
    expect(tokenStore.getAccessToken()).toBe("new"); // refresh 저장됨
    // 재요청에 새 토큰 사용됐는지
    const lastCall = fetchMock.mock.calls[2];
    // 재시도도 idToken 으로(authorizer 가 받는 토큰)
    expect((lastCall[1].headers as Record<string, string>).Authorization).toBe("Bearer i2");
  });

  it("최초 401 → refresh도 401 → getMe 실패 + 토큰 클리어", async () => {
    tokenStore.save({ idToken: "i", accessToken: "old", refreshToken: "r", expiresIn: 1 });
    const fetchMock = vi
      .fn()
      // 1) 최초 보호요청 401
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "AUTH_REQUIRED", message: "만료" }),
      })
      // 2) refresh 성공 (새 토큰 발급)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            data: { idToken: "i2", accessToken: "new", refreshToken: "r2", expiresIn: 3600 },
          }),
      })
      // 3) 재요청도 401
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "AUTH_REQUIRED", message: "여전히 만료" }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const api = createHttpClient("https://api.test");
    await expect(api.getMe()).rejects.toMatchObject({ code: "AUTH_REQUIRED", status: 401 });
    expect(tokenStore.getAccessToken()).toBeNull();
    // 재시도는 정확히 1회 — fetch 총 3회 (요청 → refresh → 재요청)
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("최초 401 → refresh 실패 → 다시 보내지 않고 토큰 클리어 + 처음 에러", async () => {
    tokenStore.save({ idToken: "i", accessToken: "old", refreshToken: "r", expiresIn: 1 });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "AUTH_REQUIRED", message: "처음" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ error: "INVALID_REFRESH_TOKEN", message: "refresh" }),
      });
    vi.stubGlobal("fetch", fetchMock);
    const api = createHttpClient("https://api.test");
    await expect(api.getMe()).rejects.toMatchObject({ code: "AUTH_REQUIRED", message: "처음" });
    expect(tokenStore.getAccessToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("401 이 아닌 실패 → refresh 없이 그대로, 토큰 유지", async () => {
    tokenStore.save({ idToken: "i", accessToken: "old", refreshToken: "r", expiresIn: 1 });
    const fetchMock = mockFetchOnce(500, { error: "SERVER_ERROR", message: "x" });
    vi.stubGlobal("fetch", fetchMock);
    const api = createHttpClient("https://api.test");
    await expect(api.getMe()).rejects.toMatchObject({ code: "SERVER_ERROR", status: 500 });
    expect(tokenStore.getAccessToken()).toBe("old");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("createFetcher", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("headers → 기본 Content-Type에 더해 보낸다", async () => {
    const fetchMock = mockFetchOnce(200, { data: 1 });
    vi.stubGlobal("fetch", fetchMock);
    await createFetcher("https://api.test").request("/x", {
      method: "POST",
      headers: { "X-Device-Token": "tok" },
    });
    expect(fetchMock.mock.calls[0][1].headers).toEqual({
      "Content-Type": "application/json",
      "X-Device-Token": "tok",
    });
  });

  it("PUT → 그 메서드로 보낸다", async () => {
    const fetchMock = mockFetchOnce(200, { data: { ribbons: 1 } });
    vi.stubGlobal("fetch", fetchMock);
    await createFetcher("https://api.test").request("/x", { method: "PUT" });
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
  });

  it("본문에 error 가 없는 401(API Gateway 인증 거절) → AUTH_REQUIRED", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(401, { message: "Unauthorized" }));
    await expect(
      createFetcher("https://api.test").request("/orders", { auth: true }),
    ).rejects.toMatchObject({ code: "AUTH_REQUIRED", status: 401 });
  });

  it("본문에 error 가 없는 그 밖의 실패 → 4xx 는 REQUEST_ERROR, 5xx 는 SERVER_ERROR", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(403, { message: "Forbidden" }));
    await expect(createFetcher("https://api.test").request("/x")).rejects.toMatchObject({
      code: "REQUEST_ERROR",
      status: 403,
    });
    vi.stubGlobal("fetch", mockFetchOnce(502, { message: "Bad Gateway" }));
    await expect(createFetcher("https://api.test").request("/x")).rejects.toMatchObject({
      code: "SERVER_ERROR",
      status: 502,
    });
  });
});
