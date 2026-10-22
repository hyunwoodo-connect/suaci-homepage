import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { eventsApi } from "@/lib/api";
import type { EventDetail } from "@/types";

import EventSubPage from "./page";

vi.mock("@/lib/api", () => ({ eventsApi: { get: vi.fn(), list: vi.fn() } }));
const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (cookieJar.has(n) ? { value: cookieJar.get(n) } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

function detail(activityId: string): EventDetail {
  return {
    eventId: "no01",
    slug: "take-four",
    activityId,
    phase: "live",
    startAt: 0,
    startDtm: "",
    endAt: 0,
    endDtm: "",
    card: { title: "take four", summary: "", order: 1 },
    copy: {},
    switches: {},
    locales: ["ko"],
  };
}

function open(rest: string[], preview?: string) {
  return EventSubPage({
    params: Promise.resolve({ slug: "take-four", rest }),
    searchParams: Promise.resolve({ preview }),
  });
}

describe("EventSubPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    cookieJar.clear();
  });

  it("booth → 놀이 모듈이 그린 화면", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(detail("take-four"));
    expect(renderToStaticMarkup(await open(["booth"]))).toContain("준비 중이에요");
  });

  it("모르는 하위 경로 → notFound", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(detail("take-four"));
    await expect(open(["nope"])).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("놀이가 없는 activityId → notFound", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(detail("a1"));
    await expect(open(["booth"])).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("이벤트가 없으면 → notFound", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(null);
    await expect(open(["booth"])).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("미리보기 토큰은 입구와 같은 검사·쿠키 대체를 거친다", async () => {
    cookieJar.set("suaci_evt_take-four", "cookie-token-1234567");
    vi.mocked(eventsApi.get).mockImplementation(async (_s, p) =>
      p === "cookie-token-1234567" ? detail("take-four") : null,
    );
    await open(["info"], "bad");
    expect(eventsApi.get).toHaveBeenNthCalledWith(1, "take-four", undefined);
    expect(eventsApi.get).toHaveBeenNthCalledWith(2, "take-four", "cookie-token-1234567");
  });
});
