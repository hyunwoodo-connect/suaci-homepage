import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

import type { EventDetail } from "@/types";

import type { StripView } from "./api";
import { isHidden, isMine, rememberHidden, rememberMine } from "./deviceMarks";
import WallScreen from "./WallScreen";

const api = vi.hoisted(() => ({
  wallApi: { list: vi.fn(), get: vi.fn(), remove: vi.fn(), ribbon: vi.fn() },
}));
vi.mock("./api", () => api);
function openedAt(search: string) {
  window.history.replaceState(null, "", `/events/take-four/wall${search}`);
}

/** 화면이 지켜보는 끝 표시를 테스트가 직접 보이게 만든다 */
let reveal: () => void = () => {};
class FakeObserver {
  constructor(private cb: IntersectionObserverCallback) {}
  observe() {
    reveal = () =>
      this.cb(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      );
  }
  disconnect() {}
  unobserve() {}
}

const START = Date.parse("2026-11-30T15:00:00Z");
const EVENT = {
  eventId: "no01",
  slug: "take-four",
  activityId: "take-four",
  phase: "live",
  startAt: START,
  startDtm: "",
  endAt: Date.parse("2027-01-10T14:59:59Z"),
  endDtm: "",
  card: { title: "take four", summary: "", order: 1 },
  copy: {},
  switches: { wall: true },
  locales: ["ko"],
} as EventDetail;

function strip(id: string, extra: Partial<StripView> = {}): StripView {
  return {
    stripId: id,
    serial: Number(id.replace(/\D/g, "")) || 1,
    eventId: "no01",
    ribbons: 2,
    thumbUrl: `https://cdn/${id}/thumb.jpg`,
    photoUrl: `https://cdn/${id}/original.jpg`,
    postedAt: Date.parse("2026-12-04T00:00:00Z"),
    postedDtm: "",
    ...extra,
  };
}

async function open() {
  await act(async () => {
    render(<WallScreen event={EVENT} now={START} />);
  });
}

function cards() {
  return screen.queryAllByRole("link", { name: "네컷 크게 보기" });
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  openedAt("");
  api.wallApi.list.mockReset();
  api.wallApi.get.mockReset().mockResolvedValue(null);
  api.wallApi.remove.mockReset().mockResolvedValue(undefined);
  api.wallApi.ribbon.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("WallScreen", () => {
  it("머리·안내 띠(→ 안내 화면)·나도 찍기(→ 부스)", async () => {
    api.wallApi.list.mockResolvedValue({ items: [], cursor: null });
    await open();
    expect(screen.getByRole("heading", { name: "the wall" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /No\.01 · 12\.01 – 01\.10/ })).toHaveAttribute(
      "href",
      "/events/take-four/info",
    );
    expect(screen.getByRole("link", { name: "나도 찍기" })).toHaveAttribute(
      "href",
      "/events/take-four/booth",
    );
  });

  it("처음 불러오는 동안 → 뼈대", async () => {
    api.wallApi.list.mockReturnValue(new Promise(() => {}));
    await open();
    expect(screen.getByRole("status", { name: "불러오는 중" })).toBeInTheDocument();
  });

  it("빈 벽 → 비어 있어요", async () => {
    api.wallApi.list.mockResolvedValue({ items: [], cursor: null });
    await open();
    expect(screen.getByText("아직 벽이 비어 있어요")).toBeInTheDocument();
    expect(screen.getByText("첫 번째로 붙여 주세요.")).toBeInTheDocument();
  });

  it("카드 → 썸네일(카드 그대로, 기울기 없음)·리본 수, 크게 보기 링크", async () => {
    api.wallApi.list.mockResolvedValue({ items: [strip("s347")], cursor: null });
    await open();
    const [card] = cards();
    expect(card).toHaveAttribute("href", "/events/take-four/wall/s347");
    expect(within(card).getByRole("img", { name: "네컷" })).toHaveAttribute(
      "src",
      "https://cdn/s347/thumb.jpg",
    );
    expect(card.parentElement?.className).not.toMatch(/rotate/);
    expect(screen.getByRole("button", { name: "리본 달기" })).toHaveTextContent("2");
  });

  it("끝에 닿으면 다음 페이지, 같은 id는 한 번만", async () => {
    api.wallApi.list
      .mockResolvedValueOnce({ items: [strip("s1"), strip("s2")], cursor: "c1" })
      .mockResolvedValueOnce({ items: [strip("s2"), strip("s3")], cursor: null });
    await open();
    expect(cards()).toHaveLength(2);
    await act(async () => reveal());
    expect(api.wallApi.list).toHaveBeenLastCalledWith("c1");
    expect(cards().map((c) => c.getAttribute("href"))).toEqual([
      "/events/take-four/wall/s1",
      "/events/take-four/wall/s2",
      "/events/take-four/wall/s3",
    ]);
  });

  it("다음 페이지를 받는 중 또 닿아도 한 번만 부른다", async () => {
    api.wallApi.list
      .mockResolvedValueOnce({ items: [strip("s1")], cursor: "c1" })
      .mockReturnValueOnce(new Promise(() => {}));
    await open();
    await act(async () => {
      reveal();
      reveal();
    });
    expect(api.wallApi.list).toHaveBeenCalledTimes(2);
    expect(screen.getByText("더 불러오는 중…")).toBeInTheDocument();
  });

  it("내 거만 잉크 외곽선·떼기, 남의 것은 리본", async () => {
    rememberMine("s1");
    api.wallApi.list.mockResolvedValue({ items: [strip("s1"), strip("s2")], cursor: null });
    await open();
    expect(screen.getAllByRole("button", { name: "떼기" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "리본 달기" })).toHaveLength(1);
    expect(within(cards()[0]).getByRole("img", { name: "내 네컷" }).className).toContain("outline");
    expect(within(cards()[1]).getByRole("img", { name: "네컷" }).className).not.toContain(
      "outline",
    );
  });

  it("떼기 → 시트에서 확인하면 지우고 벽에서 사라진다", async () => {
    rememberMine("s1");
    api.wallApi.list.mockResolvedValue({ items: [strip("s1"), strip("s2")], cursor: null });
    await open();
    fireEvent.click(screen.getByRole("button", { name: "떼기" }));
    const sheet = screen.getByRole("dialog", { name: "내 네컷 떼기" });
    expect(within(sheet).getByText("뗄까요?")).toBeInTheDocument();
    expect(
      within(sheet).getByText("벽에서만 내려요. 응모했다면 응모는 그대로 남고 우리만 봐요."),
    ).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(sheet).getByRole("button", { name: "떼기" }));
    });
    expect(api.wallApi.remove).toHaveBeenCalledWith("s1");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(cards()).toHaveLength(1);
    expect(isMine("s1")).toBe(false);
    expect(isHidden("s1")).toBe(true);
  });

  it("이 폰에서 신고·뗀 네컷 → 캐시된 목록에 남아 있어도 안 보인다", async () => {
    rememberHidden("s1");
    api.wallApi.list.mockResolvedValue({ items: [strip("s1"), strip("s2")], cursor: null });
    await open();
    expect(cards().map((c) => c.getAttribute("href"))).toEqual(["/events/take-four/wall/s2"]);
  });

  it("그냥 둘게요 → 그대로", async () => {
    rememberMine("s1");
    api.wallApi.list.mockResolvedValue({ items: [strip("s1")], cursor: null });
    await open();
    fireEvent.click(screen.getByRole("button", { name: "떼기" }));
    fireEvent.click(screen.getByRole("button", { name: "그냥 둘게요" }));
    expect(api.wallApi.remove).not.toHaveBeenCalled();
    expect(cards()).toHaveLength(1);
  });

  it("떼기 실패 → 시트에 남아 알린다", async () => {
    rememberMine("s1");
    api.wallApi.list.mockResolvedValue({ items: [strip("s1")], cursor: null });
    api.wallApi.remove.mockRejectedValue(new Error("net"));
    await open();
    fireEvent.click(screen.getByRole("button", { name: "떼기" }));
    await act(async () => {
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "떼기" }));
    });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(cards()).toHaveLength(1);
  });

  it("?posted → 그 카드를 맨 위에, 목록에 또 있어도 한 장", async () => {
    openedAt("?posted=s9");
    api.wallApi.get.mockResolvedValue(strip("s9"));
    api.wallApi.list.mockResolvedValue({ items: [strip("s1"), strip("s9")], cursor: null });
    await open();
    expect(api.wallApi.get).toHaveBeenCalledWith("s9");
    expect(cards().map((c) => c.getAttribute("href"))).toEqual([
      "/events/take-four/wall/s9",
      "/events/take-four/wall/s1",
    ]);
  });

  it("?posted인데 가려졌거나 없으면(null) → 보이지 않고 나머지는 그대로", async () => {
    openedAt("?posted=gone");
    api.wallApi.get.mockResolvedValue(null);
    api.wallApi.list.mockResolvedValue({ items: [strip("s1")], cursor: null });
    await open();
    expect(cards()).toHaveLength(1);
  });

  it("?posted 받기가 실패해도 → 목록은 그린다", async () => {
    openedAt("?posted=s9");
    api.wallApi.get.mockRejectedValue(new Error("net"));
    api.wallApi.list.mockResolvedValue({ items: [strip("s1")], cursor: null });
    await open();
    expect(cards()).toHaveLength(1);
  });

  it("목록을 못 받으면 → 알리고 다시 불러오기", async () => {
    api.wallApi.list
      .mockRejectedValueOnce(new Error("net"))
      .mockResolvedValueOnce({ items: [strip("s1")], cursor: null });
    await open();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "다시 불러오기" }));
    });
    expect(cards()).toHaveLength(1);
  });
});
