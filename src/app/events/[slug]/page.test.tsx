import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EventPage from "./page";
import { eventsApi } from "@/lib/api";
import type { EventDetail, EventPhase } from "@/types";

vi.mock("@/lib/api", () => ({ eventsApi: { get: vi.fn(), list: vi.fn() } }));
const cookieJar = new Map<string, string>();
const headerJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (cookieJar.has(n) ? { value: cookieJar.get(n) } : undefined),
  }),
  headers: async () => ({ get: (n: string) => headerJar.get(n) ?? null }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const MAC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

function detail(phase: EventPhase, activityId = "a1"): EventDetail {
  return {
    eventId: "e1",
    slug: "take-four",
    activityId,
    phase,
    startAt: Date.parse("2027-01-26T00:00:00+09:00"),
    startDtm: "",
    endAt: 0,
    endDtm: "",
    card: { title: "take four", summary: "s", order: 1 },
    copy: { upcoming: "곧 열어요", live: "지금 찍어요", ended: "끝났어요" },
    switches: {},
    locales: ["ko"],
  };
}

async function render(phase: EventPhase) {
  vi.mocked(eventsApi.get).mockResolvedValue(detail(phase));
  const ui = await EventPage({
    params: Promise.resolve({ slug: "take-four" }),
    searchParams: Promise.resolve({}),
  });
  return renderToStaticMarkup(ui);
}

describe("EventPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    cookieJar.clear();
    headerJar.clear();
  });

  it("놀이가 등록된 activityId(take-four) + 폰 UA → 놀이 입구(커튼 열기)", async () => {
    headerJar.set("user-agent", IPHONE_UA);
    vi.mocked(eventsApi.get).mockResolvedValue(detail("live", "take-four"));
    const ui = await EventPage({
      params: Promise.resolve({ slug: "take-four" }),
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(ui);
    expect(html).toContain("커튼 열기");
    expect(html).not.toContain("곧 이 자리에서");
  });

  it("놀이가 등록된 activityId + PC UA → PC 안내", async () => {
    headerJar.set("user-agent", MAC_UA);
    vi.mocked(eventsApi.get).mockResolvedValue(detail("live", "take-four"));
    const ui = await EventPage({
      params: Promise.resolve({ slug: "take-four" }),
      searchParams: Promise.resolve({}),
    });
    expect(renderToStaticMarkup(ui)).toContain("폰에서만 열려요.");
  });

  it("upcoming → 여는 날짜(M월 D일)와 copy.upcoming", async () => {
    const html = await render("upcoming");
    expect(html).toContain("1월 26일");
    expect(html).toContain("곧 열어요");
  });

  it("live → 제목, copy.live, 부스 자리 문구", async () => {
    const html = await render("live");
    expect(html).toContain("take four");
    expect(html).toContain("지금 찍어요");
    expect(html).toContain("곧 이 자리에서 찍을 수 있어요");
  });

  it("ended → copy.ended", async () => {
    const html = await render("ended");
    expect(html).toContain("끝났어요");
    expect(html).not.toContain("곧 이 자리에서");
  });

  it("get이 null이면 notFound", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(null);
    await expect(
      EventPage({ params: Promise.resolve({ slug: "x" }), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("모양이 맞는 preview 토큰을 get에 넘긴다", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(detail("live"));
    await EventPage({
      params: Promise.resolve({ slug: "take-four" }),
      searchParams: Promise.resolve({ preview: "query-token-1234567" }),
    });
    expect(eventsApi.get).toHaveBeenCalledWith("take-four", "query-token-1234567");
  });

  it("모양이 틀린 쿼리·쿠키 토큰은 API에 넘기지 않는다(미들웨어와 같은 검사)", async () => {
    cookieJar.set("suaci_evt_take-four", "bad token!");
    vi.mocked(eventsApi.get).mockResolvedValue(null);
    await expect(
      EventPage({
        params: Promise.resolve({ slug: "take-four" }),
        searchParams: Promise.resolve({ preview: "tok" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(eventsApi.get).toHaveBeenCalledTimes(1);
    expect(eventsApi.get).toHaveBeenCalledWith("take-four", undefined);
  });

  it("쿼리 없이 쿠키만 있으면 쿠키 토큰으로 이벤트를 연다", async () => {
    cookieJar.set("suaci_evt_take-four", "cookie-token-1234567");
    vi.mocked(eventsApi.get).mockImplementation(async (_s, p) =>
      p === "cookie-token-1234567" ? detail("live") : null,
    );
    const ui = await EventPage({
      params: Promise.resolve({ slug: "take-four" }),
      searchParams: Promise.resolve({}),
    });
    expect(renderToStaticMarkup(ui)).toContain("지금 찍어요");
  });
});
