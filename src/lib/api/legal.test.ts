import { describe, it, expect, vi, beforeEach } from "vitest";
import { createLegalApi, selectLegalApi } from "./legal";
import { createMockLegalApi } from "./mock/legal";
import type { LegalDocument } from "@/types";

function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  });
}

const DOC = {
  slug: "terms",
  current: { version: 2, body: "# 약관" },
  history: [],
} as unknown as LegalDocument;

describe("legalApi (http)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("get: /legal/{slug} 응답의 data", async () => {
    const fetchMock = mockFetchOnce(200, { data: DOC });
    vi.stubGlobal("fetch", fetchMock);
    expect(await createLegalApi("https://api.test").get("terms")).toEqual(DOC);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/legal/terms");
  });

  it("get: 404(시행 중 판 없음) → null, 그 밖의 실패는 던진다", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(404, { error: "LEGAL_NOT_FOUND" }));
    expect(await createLegalApi("https://api.test").get("privacy")).toBeNull();
    vi.stubGlobal("fetch", mockFetchOnce(500, { error: "BOOM" }));
    await expect(createLegalApi("https://api.test").get("privacy")).rejects.toMatchObject({
      status: 500,
    });
  });

  it("getVersion: /legal/{slug}/versions/{n}, 404 → null", async () => {
    const fetchMock = mockFetchOnce(200, { data: { version: 1 } });
    vi.stubGlobal("fetch", fetchMock);
    expect(await createLegalApi("https://api.test").getVersion("refund", 1)).toEqual({
      version: 1,
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/legal/refund/versions/1");
    vi.stubGlobal("fetch", mockFetchOnce(404, { error: "LEGAL_VERSION_NOT_FOUND" }));
    expect(await createLegalApi("https://api.test").getVersion("refund", 9)).toBeNull();
  });
});

describe("legalApi (mock)", () => {
  it("네 문서 모두 1판이 시행 중, 모르는 판은 null", async () => {
    const api = createMockLegalApi();
    const doc = await api.get("business");
    expect(doc?.current).toMatchObject({ slug: "business", version: 1, status: "published" });
    expect(doc?.history).toHaveLength(1);
    expect(await api.getVersion("business", 1)).toMatchObject({ version: 1 });
    expect(await api.getVersion("business", 2)).toBeNull();
  });
});

describe("selectLegalApi", () => {
  it("운영 + 주소 없음 → null만(가짜 약관 금지)", async () => {
    const api = selectLegalApi(undefined, "production");
    expect(await api.get("terms")).toBeNull();
    expect(await api.getVersion("terms", 1)).toBeNull();
  });
  it("개발 + 주소 없음 → mock", async () => {
    expect(await selectLegalApi(undefined, "development").get("terms")).not.toBeNull();
  });
  it("주소가 있으면 운영에서도 http", async () => {
    const fetchMock = mockFetchOnce(200, { data: DOC });
    vi.stubGlobal("fetch", fetchMock);
    await selectLegalApi("https://api.test", "production").get("terms");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/legal/terms");
  });
});
