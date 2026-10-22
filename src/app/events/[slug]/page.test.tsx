import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import EventPage from "./page";
import { eventsApi } from "@/lib/api";
import type { EventDetail, EventPhase } from "@/types";

vi.mock("@/lib/api", () => ({ eventsApi: { get: vi.fn(), list: vi.fn() } }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

function detail(phase: EventPhase): EventDetail {
  return {
    eventId: "e1",
    slug: "take-four",
    activityId: "a1",
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

  it("preview 토큰을 get에 넘긴다", async () => {
    vi.mocked(eventsApi.get).mockResolvedValue(detail("live"));
    await EventPage({
      params: Promise.resolve({ slug: "take-four" }),
      searchParams: Promise.resolve({ preview: "tok" }),
    });
    expect(eventsApi.get).toHaveBeenCalledWith("take-four", "tok");
  });
});
