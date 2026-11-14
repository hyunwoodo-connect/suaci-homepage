import { describe, it, expect, vi, beforeEach } from "vitest";
import { createEventsApi, selectEventsApi } from "./events";
import { createMockEventsApi } from "./mock/events";
import type { EventDetail } from "@/types";

function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  });
}

const DETAIL = { slug: "take-four", phase: "live", copy: { live: "hi" } } as EventDetail;

describe("eventsApi (http)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("list: /events 응답의 data를 돌려준다", async () => {
    const fetchMock = mockFetchOnce(200, { data: [{ slug: "take-four" }] });
    vi.stubGlobal("fetch", fetchMock);
    const list = await createEventsApi("https://api.test").list();
    expect(list).toEqual([{ slug: "take-four" }]);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/events");
  });

  it("get: 200 → data", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(200, { data: DETAIL }));
    expect(await createEventsApi("https://api.test").get("take-four")).toEqual(DETAIL);
  });

  it("get: 404 → null", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(404, { error: "EVENT_NOT_FOUND" }));
    expect(await createEventsApi("https://api.test").get("nope")).toBeNull();
  });

  it("get: 404 말고 실패하면 던진다", async () => {
    vi.stubGlobal("fetch", mockFetchOnce(500, { error: "BOOM" }));
    await expect(createEventsApi("https://api.test").get("x")).rejects.toMatchObject({
      status: 500,
    });
  });

  it("get: preview가 쿼리로 붙는다", async () => {
    const fetchMock = mockFetchOnce(200, { data: DETAIL });
    vi.stubGlobal("fetch", fetchMock);
    await createEventsApi("https://api.test").get("take-four", "tok en");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/events/take-four?preview=tok+en");
  });

  it("get: slug는 경로에 맞게 인코딩한다", async () => {
    const fetchMock = mockFetchOnce(404, { error: "EVENT_NOT_FOUND" });
    vi.stubGlobal("fetch", fetchMock);
    await createEventsApi("https://api.test").get("../a");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/events/..%2Fa");
  });
});

describe("eventsApi (mock)", () => {
  it("list: take-four·teum 둘, 모두 live", async () => {
    const list = await createMockEventsApi().list();
    expect(list.map((e) => e.slug)).toEqual(["take-four", "teum"]);
    expect(list.every((e) => e.phase === "live")).toBe(true);
  });

  it("get: take-four·teum 은 상세, 모르는 slug는 null", async () => {
    const api = createMockEventsApi();
    expect(await api.get("take-four")).toMatchObject({ slug: "take-four", locales: ["ko"] });
    expect(await api.get("teum")).toMatchObject({ slug: "teum", activityId: "teum" });
    expect(await api.get("nope")).toBeNull();
  });
});

describe("selectEventsApi", () => {
  it("운영 + 주소 없음 → list는 [], get은 null (가짜 이벤트 금지)", async () => {
    const api = selectEventsApi(undefined, "production");
    expect(await api.list()).toEqual([]);
    expect(await api.get("take-four")).toBeNull();
  });

  it("개발 + 주소 없음 → mock", async () => {
    const api = selectEventsApi(undefined, "development");
    expect(await api.list()).toHaveLength(2);
  });

  it("주소가 있으면 운영에서도 http", async () => {
    const fetchMock = mockFetchOnce(200, { data: [] });
    vi.stubGlobal("fetch", fetchMock);
    await selectEventsApi("https://api.test", "production").list();
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/events");
  });
});
