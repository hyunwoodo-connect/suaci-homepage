import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHttpClient } from "./http";
import { createMockClient } from "./mock";
import { tokenStore } from "@/lib/auth/token-store";

function mockFetchOnce(status: number, body: unknown) {
  const f = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  });
  vi.stubGlobal("fetch", f);
  return f;
}

describe("소셜·체크아웃 http", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("socialSignIn: POST /auth/social/{provider} 에 code·redirectUri", async () => {
    const f = mockFetchOnce(200, { data: { status: "needs_consent", signupToken: "t1" } });
    const out = await createHttpClient("https://api.test").socialSignIn("kakao", {
      code: "c1",
      redirectUri: "https://x/cb",
    });
    expect(out).toEqual({ status: "needs_consent", signupToken: "t1" });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.test/auth/social/kakao");
    expect(JSON.parse(init.body)).toEqual({ code: "c1", redirectUri: "https://x/cb" });
  });

  it("socialComplete: POST /auth/social/complete → 토큰", async () => {
    const f = mockFetchOnce(200, {
      data: { idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 },
    });
    const out = await createHttpClient("https://api.test").socialComplete({
      signupToken: "t1",
      consents: { terms: true, privacy: true, marketing: false, age: true },
    });
    expect(out.accessToken).toBe("a");
    expect(f.mock.calls[0][0]).toBe("https://api.test/auth/social/complete");
  });

  it("getCheckoutDefaults: GET /checkout/defaults (인증 헤더)", async () => {
    tokenStore.save({ idToken: "id-tok", accessToken: "tok", refreshToken: "r", expiresIn: 60 });
    const f = mockFetchOnce(200, { data: { address: null, lastPaymentMethod: "브랜드페이" } });
    const out = await createHttpClient("https://api.test").getCheckoutDefaults();
    expect(out).toEqual({ address: null, lastPaymentMethod: "브랜드페이" });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.test/checkout/defaults");
    // API Gateway Cognito authorizer 는 idToken 만 받는다 — accessToken 이면 실서버 401
    expect(init.headers.Authorization).toBe("Bearer id-tok");
    tokenStore.clear();
  });
});

describe("소셜·체크아웃 mock", () => {
  it("처음 이름은 needs_consent, complete 후 같은 이름은 signed_in", async () => {
    const api = createMockClient();
    const first = await api.socialSignIn("kakao", { code: "mock:kakao:mina", redirectUri: "r" });
    expect(first.status).toBe("needs_consent");
    if (first.status !== "needs_consent") throw new Error("unreachable");
    const tokens = await api.socialComplete({
      signupToken: first.signupToken,
      consents: { terms: true, privacy: true, marketing: false, age: true },
    });
    expect(tokens.accessToken).toBeTruthy();
    tokenStore.save(tokens);
    const again = await api.socialSignIn("kakao", { code: "mock:kakao:mina", redirectUri: "r" });
    expect(again.status).toBe("signed_in");
    tokenStore.clear();
  });

  it("getCheckoutDefaults: 기본 주소·마지막 결제수단(없으면 null)", async () => {
    const api = createMockClient();
    tokenStore.save({ idToken: "i", accessToken: "a", refreshToken: "r", expiresIn: 60 });
    const out = await api.getCheckoutDefaults();
    expect(out).toHaveProperty("address");
    expect(out).toHaveProperty("lastPaymentMethod");
    tokenStore.clear();
  });
});
