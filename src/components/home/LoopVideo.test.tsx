import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LoopVideo from "./LoopVideo";

const TOGGLE = { pause: "영상 멈추기", play: "영상 재생" };

type ObserverCallback = (entries: Array<{ isIntersecting: boolean }>) => void;
let observed: ObserverCallback | null = null;
let observers: ObserverCallback[] = [];

function stubEnv({ reducedMotion }: { reducedMotion: boolean }) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: reducedMotion, addEventListener: vi.fn() }),
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: ObserverCallback) {
        observed = cb;
        observers.push(cb);
      }
      observe() {}
      disconnect() {}
    },
  );
}

function renderVideo() {
  const { container } = render(
    <LoopVideo
      webm="/v.webm"
      mp4="/v.mp4"
      label="물결"
      className="x"
      toggleLabels={TOGGLE}
      toggleClassName="y"
    />,
  );
  return container.querySelector("video") as HTMLVideoElement;
}

describe("LoopVideo", () => {
  beforeEach(() => {
    observed = null;
    observers = [];
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("처음엔 받지 않는다 — autoplay 없이 preload none", () => {
    stubEnv({ reducedMotion: false });
    const video = renderVideo();
    expect(video.autoplay).toBe(false);
    expect(video.getAttribute("preload")).toBe("none");
  });

  it("페이지를 다 받은 뒤 화면에 들어오면 돌고, 나가면 멈춘다", () => {
    stubEnv({ reducedMotion: false });
    const video = renderVideo();
    // jsdom 은 이미 load 가 끝난 상태(readyState complete)라 바로 관찰을 건다
    expect(observed).not.toBeNull();
    act(() => observed?.([{ isIntersecting: true }]));
    expect(video.play).toHaveBeenCalledTimes(1);
    act(() => observed?.([{ isIntersecting: false }]));
    expect(video.pause).toHaveBeenCalledTimes(1);
  });

  it("포스터는 화면 근처에 와서야 단다(첫 화면 아래 그림을 미리 받지 않게)", () => {
    stubEnv({ reducedMotion: true });
    const { container } = render(
      <LoopVideo
        webm="/v.webm"
        mp4="/v.mp4"
        poster="/p.webp"
        label="물결"
        className="x"
        toggleLabels={TOGGLE}
        toggleClassName="y"
      />,
    );
    const video = container.querySelector("video") as HTMLVideoElement;
    expect(video.getAttribute("poster")).toBeNull();
    act(() => observers[0]?.([{ isIntersecting: true }]));
    expect(video.getAttribute("poster")).toBe("/p.webp");
  });

  it("움직임 줄이기를 켰으면 돌리지 않는다", () => {
    stubEnv({ reducedMotion: true });
    const video = renderVideo();
    expect(observed).toBeNull();
    expect(video.play).not.toHaveBeenCalled();
  });

  it("멈춤 버튼 — 돌고 있으면 '멈추기', 누르면 멈추고 화면에 다시 들어와도 저절로 돌지 않는다", () => {
    stubEnv({ reducedMotion: false });
    const video = renderVideo();
    act(() => {
      video.dispatchEvent(new Event("play"));
    });
    fireEvent.click(screen.getByRole("button", { name: "영상 멈추기" }));
    expect(video.pause).toHaveBeenCalledTimes(1);
    act(() => {
      video.dispatchEvent(new Event("pause"));
    });
    expect(screen.getByRole("button", { name: "영상 재생" })).toBeTruthy();
    act(() => observed?.([{ isIntersecting: true }]));
    expect(video.play).not.toHaveBeenCalled();
  });

  it("움직임 줄이기여도 '재생'을 누르면 돈다", () => {
    stubEnv({ reducedMotion: true });
    const video = renderVideo();
    fireEvent.click(screen.getByRole("button", { name: "영상 재생" }));
    expect(video.play).toHaveBeenCalledTimes(1);
  });
});
