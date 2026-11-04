import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LoopVideo from "./LoopVideo";

let observed: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;

function stubEnv({ reducedMotion }: { reducedMotion: boolean }) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({ matches: reducedMotion, addEventListener: vi.fn() }),
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
        observed = cb;
      }
      observe() {}
      disconnect() {}
    },
  );
}

function renderVideo() {
  const { container } = render(
    <LoopVideo webm="/v.webm" mp4="/v.mp4" label="물결" className="x" />,
  );
  return container.querySelector("video") as HTMLVideoElement;
}

describe("LoopVideo", () => {
  beforeEach(() => {
    observed = null;
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

  it("움직임 줄이기를 켰으면 돌리지 않는다", () => {
    stubEnv({ reducedMotion: true });
    const video = renderVideo();
    expect(observed).toBeNull();
    expect(video.play).not.toHaveBeenCalled();
  });
});
