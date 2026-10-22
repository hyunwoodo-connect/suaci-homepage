import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { useCamera } from "./useCamera";

function fakeStream() {
  const track = Object.assign(new EventTarget(), { stop: vi.fn() });
  return { track, stream: { getTracks: () => [track] } as unknown as MediaStream };
}

/** 크기를 아는(재생 중인) 비디오를 훅에 붙인다 */
function attachVideo(videoRef: { current: HTMLVideoElement | null }, width = 1280, height = 960) {
  const video = document.createElement("video");
  Object.defineProperty(video, "videoWidth", { configurable: true, value: width });
  Object.defineProperty(video, "videoHeight", { configurable: true, value: height });
  videoRef.current = video;
  return video;
}

function stubGetUserMedia(impl: () => Promise<MediaStream>) {
  const getUserMedia = vi.fn(impl);
  vi.stubGlobal("navigator", { ...navigator, mediaDevices: { getUserMedia } });
  return getUserMedia;
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  setVisibility("visible");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useCamera", () => {
  it("처음 → idle, getUserMedia를 부르지 않는다(탭 뒤에만)", () => {
    const getUserMedia = stubGetUserMedia(() => Promise.resolve(fakeStream().stream));
    const { result } = renderHook(() => useCamera());
    expect(result.current.status).toBe("idle");
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("허용 → on, 전면 카메라로 비디오에 붙는다", async () => {
    const { stream } = fakeStream();
    const getUserMedia = stubGetUserMedia(() => Promise.resolve(stream));
    const { result } = renderHook(() => useCamera());
    const video = attachVideo(result.current.videoRef);

    let isOn = false;
    await act(async () => {
      isOn = await result.current.start();
    });

    expect(isOn).toBe(true);
    expect(result.current.status).toBe("on");
    expect(video.srcObject).toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({ video: expect.objectContaining({ facingMode: "user" }) }),
    );
  });

  it.each([
    ["NotAllowedError", "denied"],
    ["SecurityError", "denied"],
    ["NotFoundError", "unavailable"],
    ["OverconstrainedError", "unavailable"],
  ])("%s → %s", async (name, expected) => {
    stubGetUserMedia(() => Promise.reject(new DOMException("no", name)));
    const { result } = renderHook(() => useCamera());
    let isOn = true;
    await act(async () => {
      isOn = await result.current.start();
    });
    expect(isOn).toBe(false);
    expect(result.current.status).toBe(expected);
  });

  it("mediaDevices 없음(인앱·http) → unavailable", async () => {
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: undefined });
    const { result } = renderHook(() => useCamera());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("unavailable");
  });

  it("stop → 트랙을 끄고 idle", async () => {
    const { stream, track } = fakeStream();
    stubGetUserMedia(() => Promise.resolve(stream));
    const { result } = renderHook(() => useCamera());
    attachVideo(result.current.videoRef);
    await act(async () => {
      await result.current.start();
    });
    act(() => result.current.stop());
    expect(track.stop).toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("탭 숨김 → 트랙을 끈다", async () => {
    const { stream, track } = fakeStream();
    stubGetUserMedia(() => Promise.resolve(stream));
    const { result } = renderHook(() => useCamera());
    attachVideo(result.current.videoRef);
    await act(async () => {
      await result.current.start();
    });
    act(() => setVisibility("hidden"));
    expect(track.stop).toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("언마운트 → 트랙을 끈다", async () => {
    const { stream, track } = fakeStream();
    stubGetUserMedia(() => Promise.resolve(stream));
    const { result, unmount } = renderHook(() => useCamera());
    attachVideo(result.current.videoRef);
    await act(async () => {
      await result.current.start();
    });
    unmount();
    expect(track.stop).toHaveBeenCalled();
  });

  it("허용 → 재생 전에 muted 속성을 켠다(iOS 인라인 재생)", async () => {
    stubGetUserMedia(() => Promise.resolve(fakeStream().stream));
    const { result } = renderHook(() => useCamera());
    const video = attachVideo(result.current.videoRef);
    let mutedAtPlay: boolean | undefined;
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementation(async () => {
      mutedAtPlay = video.muted;
    });
    await act(async () => {
      await result.current.start();
    });
    expect(mutedAtPlay).toBe(true);
  });

  it("트랙이 스스로 끝남(ended) → idle", async () => {
    const { stream, track } = fakeStream();
    stubGetUserMedia(() => Promise.resolve(stream));
    const { result } = renderHook(() => useCamera());
    attachVideo(result.current.videoRef);
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      track.dispatchEvent(new Event("ended"));
    });
    expect(result.current.status).toBe("idle");
    expect(track.stop).toHaveBeenCalled();
  });

  it("영상 크기가 3초 안에 안 정해짐 → false, unavailable, 트랙을 끈다", async () => {
    vi.useFakeTimers();
    const { stream, track } = fakeStream();
    stubGetUserMedia(() => Promise.resolve(stream));
    const { result } = renderHook(() => useCamera());
    attachVideo(result.current.videoRef, 0, 0);
    let pending: Promise<boolean> = Promise.resolve(true);
    act(() => {
      pending = result.current.start();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(await pending).toBe(false);
    expect(result.current.status).toBe("unavailable");
    expect(track.stop).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("크기는 늦게 와도 loadedmetadata 안이면 → on", async () => {
    stubGetUserMedia(() => Promise.resolve(fakeStream().stream));
    const { result } = renderHook(() => useCamera());
    const video = attachVideo(result.current.videoRef, 0, 0);
    let pending: Promise<boolean> = Promise.resolve(false);
    act(() => {
      pending = result.current.start();
    });
    await act(async () => {
      await Promise.resolve();
      Object.defineProperty(video, "videoWidth", { value: 640 });
      video.dispatchEvent(new Event("loadedmetadata"));
    });
    expect(await pending).toBe(true);
    expect(result.current.status).toBe("on");
  });

  it("재생이 막힘(play 거절) → false, unavailable", async () => {
    const { stream, track } = fakeStream();
    stubGetUserMedia(() => Promise.resolve(stream));
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(
      new DOMException("x", "NotAllowedError"),
    );
    const { result } = renderHook(() => useCamera());
    attachVideo(result.current.videoRef);
    let isOn = true;
    await act(async () => {
      isOn = await result.current.start();
    });
    expect(isOn).toBe(false);
    expect(result.current.status).toBe("unavailable");
    expect(track.stop).toHaveBeenCalled();
  });

  it("권한을 묻는 중 언마운트 → 늦게 온 스트림도 끈다", async () => {
    const { stream, track } = fakeStream();
    let resolve: (s: MediaStream) => void = () => {};
    stubGetUserMedia(() => new Promise((r) => (resolve = r)));
    const { result, unmount } = renderHook(() => useCamera());
    let pending: Promise<boolean> = Promise.resolve(true);
    act(() => {
      pending = result.current.start();
    });
    unmount();
    resolve(stream);
    expect(await pending).toBe(false);
    expect(track.stop).toHaveBeenCalled();
  });
});
