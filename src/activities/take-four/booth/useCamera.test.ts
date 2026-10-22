import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

import { centerCrop43, useCamera } from "./useCamera";

function fakeStream() {
  const track = { stop: vi.fn() };
  return { track, stream: { getTracks: () => [track] } as unknown as MediaStream };
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
    const video = document.createElement("video");
    result.current.videoRef.current = video;

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
    await act(async () => {
      await result.current.start();
    });
    unmount();
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

describe("centerCrop43", () => {
  it("가로 16:9 → 양옆을 자른다", () => {
    expect(centerCrop43(1280, 720)).toEqual({ x: 160, y: 0, width: 960, height: 720 });
  });

  it("세로 3:4 → 위아래를 자른다", () => {
    expect(centerCrop43(720, 960)).toEqual({ x: 0, y: 210, width: 720, height: 540 });
  });

  it("이미 4:3 → 그대로", () => {
    expect(centerCrop43(640, 480)).toEqual({ x: 0, y: 0, width: 640, height: 480 });
  });
});
