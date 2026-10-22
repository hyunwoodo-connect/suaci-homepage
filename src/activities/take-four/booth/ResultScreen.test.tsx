import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { stripCaption } from "../strip/compose";
import ResultScreen from "./ResultScreen";

const share = vi.hoisted(() => ({
  shareOrDownload: vi.fn(),
  shareStoryOrDownload: vi.fn(),
  downloadBlob: vi.fn(),
}));
vi.mock("../strip/share", () => share);
const story = vi.hoisted(() => ({ composeStory: vi.fn() }));
vi.mock("../story/composeStory", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../story/composeStory")>()),
  composeStory: story.composeStory,
}));
const STORY_BLOB = new Blob(["story"], { type: "image/jpeg" });

const STRIP_BLOB = new Blob(["strip"], { type: "image/jpeg" });
const TAKEN = new Date("2026-10-22T05:00:00Z");

async function renderResult(props: Partial<Parameters<typeof ResultScreen>[0]> = {}) {
  await act(async () => {
    render(
      <ResultScreen
        strip={STRIP_BLOB}
        photos={new Blob(["photos"], { type: "image/jpeg" })}
        caption={stripCaption("live", TAKEN, "No.01")}
        canEnter={false}
        storyLink="takesuaci.com/events/take-four"
        onRetake={vi.fn()}
        {...props}
      />,
    );
  });
  // 사진 기둥은 FileReader로 읽혀 한 틱 뒤에 그려진다
  await screen.findByRole("img", { name: /네컷/ });
}

beforeEach(() => {
  share.shareOrDownload.mockReset().mockResolvedValue("shared");
  share.shareStoryOrDownload.mockReset().mockResolvedValue("shared");
  story.composeStory.mockReset().mockResolvedValue(STORY_BLOB);
  share.downloadBlob.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ResultScreen", () => {
  it("진행 중 → 띠(사진 기둥)·캡션·도장, 공유·저장·다시 찍기", async () => {
    await renderResult();
    expect(screen.getByRole("img", { name: /네컷: 무표정/ }).getAttribute("src")).toMatch(
      /^data:image\/jpeg;base64,/,
    );
    expect(screen.getAllByText("no.----").length).toBeGreaterThan(0);
    expect(screen.getByText("No.01 · 10.22")).toBeInTheDocument();
    expect(document.querySelector("[data-stamp]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "공유하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다시 찍기" })).toBeInTheDocument();
  });

  it("이벤트 끝남 → 도장·No.01 없이 날짜만", async () => {
    await renderResult({ caption: stripCaption("ended", TAKEN, "No.01") });
    expect(screen.getByText("10.22")).toBeInTheDocument();
    expect(screen.queryByText(/No\.01/)).toBeNull();
    expect(document.querySelector("[data-stamp]")).toBeNull();
  });

  it("switches.entry 꺼짐 → 응모하기 없음", async () => {
    await renderResult({ canEnter: false });
    expect(screen.queryByRole("button", { name: "응모하기" })).toBeNull();
  });

  it("switches.entry 켜짐 → 응모하기", async () => {
    await renderResult({ canEnter: true });
    expect(screen.getByRole("button", { name: "응모하기" })).toBeInTheDocument();
  });

  it("공유하기 → 띠로 만든 스토리와 띠를 한국 날짜 이름으로", async () => {
    await renderResult();
    expect(story.composeStory).toHaveBeenCalledWith(STRIP_BLOB, "takesuaci.com/events/take-four");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "공유하기" })));
    expect(share.shareStoryOrDownload).toHaveBeenCalledWith(
      { blob: STORY_BLOB, filename: "take-four-1022-story.jpg" },
      { blob: STRIP_BLOB, filename: "take-four-1022.jpg" },
    );
  });

  it("스토리를 못 만듦(글꼴) → 공유하기는 띠만", async () => {
    story.composeStory.mockRejectedValue(new Error("글꼴"));
    await renderResult();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "공유하기" })));
    expect(share.shareOrDownload).toHaveBeenCalledWith(STRIP_BLOB, "take-four-1022.jpg");
    expect(share.shareStoryOrDownload).not.toHaveBeenCalled();
  });

  it("스토리 만드는 중 → 공유하기 비활성", async () => {
    story.composeStory.mockReturnValue(new Promise(() => {}));
    await renderResult();
    expect(screen.getByRole("button", { name: "공유하기" })).toBeDisabled();
  });

  it("앨범에서 옴(retakeLabel) → 다시 고르기", async () => {
    await renderResult({ retakeLabel: "다시 고르기" });
    expect(screen.getByRole("button", { name: "다시 고르기" })).toBeInTheDocument();
  });

  it.each([
    ["취소", () => Promise.resolve("cancelled")],
    ["실패", () => Promise.reject(new Error("막힘"))],
  ])("공유 %s → 완성 화면이 그대로", async (_, outcome) => {
    share.shareStoryOrDownload.mockImplementation(outcome);
    await renderResult();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "공유하기" })));
    expect(screen.getByRole("img", { name: /네컷/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
  });

  it("공유 시트가 떠 있는 동안 → 공유하기 비활성, 연타해도 한 번만", async () => {
    let finish: (value: string) => void = () => {};
    share.shareStoryOrDownload.mockImplementation(
      () => new Promise((resolve) => (finish = resolve)),
    );
    await renderResult();
    const button = screen.getByRole("button", { name: "공유하기" });
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(share.shareStoryOrDownload).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    await act(async () => finish("shared"));
    expect(button).toBeEnabled();
  });

  it("저장(안드로이드) → 띠를 내려받는다", async () => {
    await renderResult();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(share.downloadBlob).toHaveBeenCalledWith(STRIP_BLOB, "take-four-1022.jpg");
  });

  it("저장(아이폰) → 새 탭 대신 공유 시트로 띠만 보낸다", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
    );
    await renderResult();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "저장" }));
    });
    expect(share.shareOrDownload).toHaveBeenCalledWith(STRIP_BLOB, "take-four-1022.jpg");
    expect(share.downloadBlob).not.toHaveBeenCalled();
  });

  it("다시 찍기 → onRetake", async () => {
    const onRetake = vi.fn();
    await renderResult({ onRetake });
    fireEvent.click(screen.getByRole("button", { name: "다시 찍기" }));
    expect(onRetake).toHaveBeenCalledTimes(1);
  });

  it("입구 카드로 열림(retakeHref) → 다시 찍기는 부스 링크", async () => {
    await renderResult({ onRetake: undefined, retakeHref: "/events/take-four/booth" });
    expect(screen.getByRole("link", { name: "다시 찍기" })).toHaveAttribute(
      "href",
      "/events/take-four/booth",
    );
  });
});
