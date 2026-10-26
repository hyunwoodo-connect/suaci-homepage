import { describe, it, expect, vi, beforeEach } from "vitest";
import { createWaitlistApi, selectWaitlistApi } from "./waitlist";
import { createMockWaitlistApi } from "./mock/waitlist";

function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  });
}

describe("waitlistApi (http)", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("join: POST /waitlist에 두 동의를 true로 싣는다", async () => {
    const fetchMock = mockFetchOnce(201, { data: { joined: true } });
    vi.stubGlobal("fetch", fetchMock);
    await createWaitlistApi("https://api.test").join({
      email: "a@b.co",
      locale: "ko",
      source: "teaser",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/waitlist");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      email: "a@b.co",
      locale: "ko",
      source: "teaser",
      privacyConsent: true,
      marketingConsent: true,
    });
  });

  it("join: 실패는 코드가 실린 오류로 던진다(화면이 문구를 고른다)", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(429, { error: "RATE_LIMITED", message: "x" }));
    await expect(
      createWaitlistApi("https://api.test").join({ email: "a@b.co" }),
    ).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
    });
  });
});

describe("selectWaitlistApi", () => {
  it("운영 + 주소 없음 → 남긴 척하지 않고 실패한다", async () => {
    await expect(
      selectWaitlistApi(undefined, "production").join({ email: "a@b.co" }),
    ).rejects.toMatchObject({
      code: "UNAVAILABLE",
    });
  });
  it("개발 + 주소 없음 → mock(이상한 이메일은 INVALID_EMAIL)", async () => {
    const api = selectWaitlistApi(undefined, "development");
    await expect(api.join({ email: "a@b.co" })).resolves.toBeUndefined();
    await expect(createMockWaitlistApi().join({ email: "nope" })).rejects.toMatchObject({
      code: "INVALID_EMAIL",
    });
  });
});
