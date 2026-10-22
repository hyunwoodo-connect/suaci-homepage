import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { EventDetail } from "@/types";

import BoothFlow from "./BoothFlow";

const FRAMES = [0, 1, 2, 3].map(() => document.createElement("canvas"));
const STRIP_BLOB = new Blob(["strip"], { type: "image/jpeg" });
const PHOTOS_BLOB = new Blob(["photos"], { type: "image/jpeg" });

vi.mock("./BoothScreen", () => ({
  default: ({ onDone }: { onDone: (frames: HTMLCanvasElement[]) => void }) => (
    <button type="button" onClick={() => onDone(FRAMES)}>
      다 찍었어요. 인화하기
    </button>
  ),
}));

const ALBUM_FRAMES = [0, 1, 2, 3].map(() => document.createElement("canvas"));
const albumProps = vi.hoisted(() => ({ initialFrames: [] as (HTMLCanvasElement[] | undefined)[] }));
vi.mock("../album/AlbumScreen", () => ({
  default: ({
    onDone,
    initialFrames,
  }: {
    onDone: (frames: HTMLCanvasElement[]) => void;
    initialFrames?: HTMLCanvasElement[];
  }) => {
    albumProps.initialFrames.push(initialFrames);
    return (
      <button type="button" onClick={() => onDone(ALBUM_FRAMES)}>
        앨범 인화하기
      </button>
    );
  },
}));

const strip = vi.hoisted(() => ({
  composeStrip: vi.fn(),
  composePhotos: vi.fn(),
  saveLast: vi.fn(),
}));
vi.mock("../strip/compose", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../strip/compose")>()),
  composeStrip: strip.composeStrip,
  composePhotos: strip.composePhotos,
}));
vi.mock("../strip/storage", () => ({ saveLast: strip.saveLast }));

const stage = vi.hoisted(() => ({ shipped: { wall: false, entry: false } }));
vi.mock("../stage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../stage")>();
  return {
    ...actual,
    isStageOn: (...[event, name]: Parameters<typeof actual.isStageOn>) =>
      actual.isStageOn(event, name, stage.shipped),
    canPostToWall: (event: Parameters<typeof actual.canPostToWall>[0]) =>
      actual.canPostToWall(event, stage.shipped),
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function event(phase: EventDetail["phase"] = "live", switches = {}, eventId = "no01") {
  return {
    eventId,
    slug: "take-four",
    activityId: "take-four",
    phase,
    switches,
  } as unknown as EventDetail;
}

async function shoot() {
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /인화하기/ })));
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  // 움직임 줄이기 — 현상이 바로 끝난다
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true })),
  );
  strip.composeStrip.mockReset().mockResolvedValue(STRIP_BLOB);
  strip.composePhotos.mockReset().mockResolvedValue(PHOTOS_BLOB);
  strip.saveLast.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("BoothFlow", () => {
  it("다 찍음 → 찍은 네 장을 이벤트 상태 캡션으로 합성하고 폰에 남긴다", async () => {
    render(<BoothFlow event={event("live")} />);
    await shoot();
    const [frames, caption] = strip.composeStrip.mock.calls[0];
    expect(frames).toBe(FRAMES);
    expect(caption).toMatchObject({ serial: null, eventLabel: "No.01" });
    expect(strip.composePhotos).toHaveBeenCalledWith(FRAMES);
    expect(strip.saveLast).toHaveBeenCalledWith(STRIP_BLOB, PHOTOS_BLOB, caption);
  });

  it("마감된 이벤트 → 캡션에 No.01 없음", async () => {
    render(<BoothFlow event={event("ended")} />);
    await shoot();
    expect(strip.composeStrip.mock.calls[0][1]).toMatchObject({ eventLabel: null });
  });

  it("이벤트 내용이 없는 이벤트 → 진행 중이어도 캡션에 회차 없음", async () => {
    render(<BoothFlow event={event("live", {}, "unknown")} />);
    await shoot();
    expect(strip.composeStrip.mock.calls[0][1]).toMatchObject({ eventLabel: null });
  });

  it("현상 → 받기 → 완성, 다시 찍기 → 촬영 준비로", async () => {
    render(<BoothFlow event={event("live")} />);
    await shoot();
    expect(screen.getByText("here.")).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "받기" })));
    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 찍기" }));
    expect(screen.getByRole("button", { name: /인화하기/ })).toBeInTheDocument();
  });

  it("합성 실패 → oops., 다시 인화하기 → 다시 합성", async () => {
    strip.composeStrip.mockRejectedValueOnce(new Error("toBlob null"));
    render(<BoothFlow event={event("live")} />);
    await shoot();
    expect(screen.getByText("oops.")).toBeInTheDocument();
    expect(strip.saveLast).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "다시 인화하기" })));
    expect(strip.composeStrip).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "받기" })).toBeInTheDocument();
  });

  it("2단계가 나왔고 switches.wall → 완성 화면에 벽에 붙이기", async () => {
    stage.shipped = { wall: true, entry: false };
    try {
      render(<BoothFlow event={event("live", { wall: true })} />);
      await shoot();
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "받기" })));
      expect(screen.getByRole("button", { name: "벽에 붙이기" })).toBeInTheDocument();
    } finally {
      stage.shipped = { wall: false, entry: false };
    }
  });

  it("switches.wall이 켜져도 2단계 전(STAGE.wall false) → 벽에 붙이기 없음", async () => {
    render(<BoothFlow event={event("live", { wall: true })} />);
    await shoot();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "받기" })));
    expect(screen.queryByRole("button", { name: "벽에 붙이기" })).toBeNull();
  });

  it("응모도 켜짐(wall·entry 둘 다) → 벽에 붙이기 없음(그 자리는 응모)", async () => {
    stage.shipped = { wall: true, entry: true };
    try {
      render(<BoothFlow event={event("live", { wall: true, entry: true })} />);
      await shoot();
      await act(async () => fireEvent.click(screen.getByRole("button", { name: "받기" })));
      expect(screen.queryByRole("button", { name: "벽에 붙이기" })).toBeNull();
    } finally {
      stage.shipped = { wall: false, entry: false };
    }
  });

  it("앨범 → 고른 네 장을 같은 현상·완성으로, 다시 고르기 → 고른 네 장을 든 앨범", async () => {
    albumProps.initialFrames = [];
    render(<BoothFlow event={event("live")} source="album" />);
    expect(albumProps.initialFrames.at(-1)).toBeUndefined();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "앨범 인화하기" })));
    expect(strip.composeStrip.mock.calls[0][0]).toBe(ALBUM_FRAMES);
    expect(strip.composePhotos).toHaveBeenCalledWith(ALBUM_FRAMES);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "받기" })));
    fireEvent.click(screen.getByRole("button", { name: "다시 고르기" }));
    expect(screen.getByRole("button", { name: "앨범 인화하기" })).toBeInTheDocument();
    expect(albumProps.initialFrames.at(-1)).toBe(ALBUM_FRAMES);
  });
});
