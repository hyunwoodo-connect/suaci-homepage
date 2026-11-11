import { beforeEach, describe, expect, it, vi } from "vitest";

import { tokenStore } from "@/lib/auth/token-store";

import { createHttpClient } from "./http";

const TOKENS = { idToken: "id-tok", accessToken: "tok", refreshToken: "r", expiresIn: 60 };

function mockFetchOnce(status: number, body: unknown) {
  const f = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  });
  vi.stubGlobal("fetch", f);
  return f;
}

describe("회원 탈퇴 http", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    tokenStore.save(TOKENS);
  });

  it("withdrawAccount: POST /me/withdrawal 에 leaveWaitlist(인증 헤더) → withdrawn", async () => {
    const f = mockFetchOnce(200, { data: { withdrawn: true } });
    const out = await createHttpClient("https://api.test").withdrawAccount({ leaveWaitlist: true });
    expect(out).toEqual({ withdrawn: true });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.test/me/withdrawal");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ leaveWaitlist: true });
    expect(init.headers.Authorization).toBe("Bearer id-tok");
  });

  it("끝나지 않은 주문이 있으면(409) → ACCOUNT_WITHDRAWAL_BLOCKED 로 던진다", async () => {
    mockFetchOnce(409, { error: "ACCOUNT_WITHDRAWAL_BLOCKED", message: "blocked" });
    await expect(
      createHttpClient("https://api.test").withdrawAccount({ leaveWaitlist: false }),
    ).rejects.toMatchObject({ code: "ACCOUNT_WITHDRAWAL_BLOCKED", status: 409 });
  });
});
