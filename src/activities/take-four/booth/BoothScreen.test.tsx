import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { CameraStatus } from "./useCamera";
import BoothScreen from "./BoothScreen";
import { PROMPTS, READY_PROMPT } from "../shots";
import { FILM_TONE_CSS } from "../strip/tone";
import { COUNT_MS, FLASH_MS } from "./boothMachine";

const camera = vi.hoisted(() => ({
  status: "idle" as CameraStatus,
  start: vi.fn(),
  stop: vi.fn(),
  capture: vi.fn(),
}));

vi.mock("./useCamera", () => ({
  useCamera: () => ({ ...camera, videoRef: { current: null } }),
}));

const SHOT_MS = COUNT_MS * 3 + FLASH_MS;

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: state });
  document.dispatchEvent(new Event("visibilitychange"));
}

/** 상태가 바뀔 때마다 다음 타이머가 걸리도록 10ms씩 흘린다 */
function elapse(ms: number) {
  for (let t = 0; t < ms; t += 10) act(() => vi.advanceTimersByTime(10));
}

async function pressShutter() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /찍기 시작/ }));
  });
}

/** 지금 보이는 지시 문구 */
function prompt() {
  return [READY_PROMPT, ...PROMPTS].find((text) => screen.queryByText(text));
}

/** 단계 바에서 색이 찬 칸 수 */
function filledSteps() {
  return document.querySelectorAll("[data-filled]").length;
}

beforeEach(() => {
  vi.useFakeTimers();
  camera.status = "idle";
  // 실제 훅처럼 start는 켜고(on) stop은 끈다(idle). 다음 렌더가 읽는다
  camera.start.mockImplementation(async () => {
    camera.status = "on";
    return true;
  });
  camera.stop.mockImplementation(() => {
    camera.status = "idle";
  });
  camera.capture.mockImplementation(() => document.createElement("canvas"));
});

afterEach(() => {
  cleanup();
  setVisibility("visible");
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("BoothScreen", () => {
  it("들어오면 → 찰칵 전에 카메라를 켠다", async () => {
    await act(async () => {
      render(<BoothScreen slug="take-four" onDone={vi.fn()} />);
    });
    expect(camera.start).toHaveBeenCalledTimes(1);
  });

  it("셔터 → 들어오세요 문구 다음 지시 문구 네 개가 순서대로, 단계 바가 한 칸씩 찬다", async () => {
    render(<BoothScreen slug="take-four" onDone={vi.fn()} />);
    expect(prompt()).toBe(READY_PROMPT);
    expect(filledSteps()).toBe(0);
    await pressShutter();

    for (let i = 0; i < 4; i += 1) {
      expect(prompt()).toBe(PROMPTS[i]);
      expect(filledSteps()).toBe(i + 1);
      expect(screen.getByText(`${i + 1} / 4`)).toBeInTheDocument();
      if (i < 3) elapse(SHOT_MS);
    }
  });

  it("3·2·1이 800ms마다 바뀐다", async () => {
    render(<BoothScreen slug="take-four" onDone={vi.fn()} />);
    await pressShutter();
    const spoken = () => document.querySelector("[aria-live=assertive] .sr-only")?.textContent;
    expect(spoken()).toBe("3");
    elapse(COUNT_MS);
    expect(spoken()).toBe("2");
    elapse(COUNT_MS);
    expect(spoken()).toBe("1");
    elapse(COUNT_MS);
    expect(spoken()).toBe("찰칵");
  });

  it("넷째 찰칵이 끝나면 → 카메라를 끄고 바로 네 장을 넘긴다(인화하기 버튼 없이)", async () => {
    const onDone = vi.fn();
    render(<BoothScreen slug="take-four" onDone={onDone} />);
    await pressShutter();
    elapse(SHOT_MS * 4 - FLASH_MS - 10);
    expect(onDone).not.toHaveBeenCalled();
    elapse(FLASH_MS + 10);

    expect(camera.capture).toHaveBeenCalledTimes(4);
    expect(camera.stop).toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith([
      expect.any(HTMLCanvasElement),
      expect.any(HTMLCanvasElement),
      expect.any(HTMLCanvasElement),
      expect.any(HTMLCanvasElement),
    ]);
  });

  it("다 찍은 뒤엔(부모가 아직 안 넘겨도) 더 찍지 않고 다시 넘기지도 않는다", async () => {
    const onDone = vi.fn();
    render(<BoothScreen slug="take-four" onDone={onDone} />);
    await pressShutter();
    elapse(SHOT_MS * 6);
    expect(camera.capture).toHaveBeenCalledTimes(4);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("찍는 중 카메라가 끊김 → 처음(ready)으로, 더 찍지 않는다", async () => {
    const { rerender } = render(<BoothScreen slug="take-four" onDone={vi.fn()} />);
    await pressShutter();
    elapse(SHOT_MS + COUNT_MS);
    expect(camera.capture).toHaveBeenCalledTimes(1);

    camera.status = "idle";
    act(() => rerender(<BoothScreen slug="take-four" onDone={vi.fn()} />));
    expect(screen.getByText("0 / 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /찍기 시작/ })).toBeEnabled();
    elapse(SHOT_MS * 2);
    expect(camera.capture).toHaveBeenCalledTimes(1);
  });

  it("카메라가 안 켜짐 → 촬영을 시작하지 않는다", async () => {
    camera.start.mockImplementation(async () => {
      camera.status = "denied";
      return false;
    });
    render(<BoothScreen slug="take-four" onDone={vi.fn()} />);
    await pressShutter();
    elapse(SHOT_MS);
    expect(camera.capture).not.toHaveBeenCalled();
    expect(screen.getByText("0 / 4")).toBeInTheDocument();
  });

  it("찍는 중 탭 숨김 → 처음(ready)으로", async () => {
    const { rerender } = render(<BoothScreen slug="take-four" onDone={vi.fn()} />);
    await pressShutter();
    elapse(SHOT_MS + COUNT_MS);
    expect(prompt()).toBe(PROMPTS[1]);

    // 실제 useCamera는 탭이 숨으면 카메라를 끄고(status idle) 다시 그린다(useCamera.test)
    act(() => {
      setVisibility("hidden");
      camera.status = "idle";
    });
    act(() => rerender(<BoothScreen slug="take-four" onDone={vi.fn()} />));
    expect(prompt()).toBe(READY_PROMPT);
    expect(screen.getByText("0 / 4")).toBeInTheDocument();
    elapse(SHOT_MS);
    expect(camera.capture).toHaveBeenCalledTimes(1);
  });

  it("멈추기 → 처음(ready)으로", async () => {
    render(<BoothScreen slug="take-four" onDone={vi.fn()} />);
    await pressShutter();
    fireEvent.click(screen.getByRole("button", { name: "멈추기" }));
    expect(screen.getByRole("button", { name: /찍기 시작/ })).toBeEnabled();
    elapse(SHOT_MS);
    expect(camera.capture).not.toHaveBeenCalled();
  });

  it.each(["denied", "unavailable"] as const)(
    "%s → 창에 `카메라가 막혀 있어요` + `다른 방법 보기`가 no-camera로",
    (status) => {
      camera.status = status;
      render(<BoothScreen slug="take-four" onDone={vi.fn()} />);
      expect(screen.getByText("카메라가 막혀 있어요")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "다른 방법 보기" })).toHaveAttribute(
        "href",
        "/events/take-four/no-camera",
      );
      expect(screen.queryByRole("button", { name: /찍기 시작/ })).toBeNull();
    },
  );

  it("켜는 중 → 안내 + 셔터 비활성", () => {
    camera.status = "starting";
    render(<BoothScreen slug="take-four" onDone={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("카메라 켜는 중");
    expect(screen.getByRole("button", { name: "카메라 켜는 중" })).toBeDisabled();
  });

  it("카메라 켜짐 + 세로 영상 720×960 → 저장 영역(정사각) 안내선이 창 폭 240×240, 위 37", () => {
    camera.status = "on";
    const { container } = render(<BoothScreen slug="take-four" onDone={vi.fn()} />);
    const video = container.querySelector("video")!;
    Object.defineProperty(video, "videoWidth", { value: 720 });
    Object.defineProperty(video, "videoHeight", { value: 960 });
    fireEvent.loadedMetadata(video);
    const guide = screen.getByTestId("save-guide");
    expect(guide.style.left).toBe("0px");
    expect(guide.style.top).toBe("37px");
    expect(guide.style.width).toBe("240px");
    expect(guide.style.height).toBe("240px");
  });

  it("미리보기 → 거울로 뒤집고 저장 카드와 같은 톤", () => {
    camera.status = "on";
    const { container } = render(<BoothScreen slug="take-four" onDone={vi.fn()} />);
    const video = container.querySelector("video")!;
    expect(video.className).toContain("-scale-x-100");
    expect(video.style.filter).toBe(FILM_TONE_CSS);
  });

  it("카메라 꺼짐 → 안내선 없음", () => {
    // 권한 창을 기다리는 중이라 아직 켜지지 않았다
    camera.start.mockImplementation(() => new Promise(() => {}));
    const { container } = render(<BoothScreen slug="take-four" onDone={vi.fn()} />);
    const video = container.querySelector("video")!;
    Object.defineProperty(video, "videoWidth", { value: 720 });
    Object.defineProperty(video, "videoHeight", { value: 960 });
    fireEvent.loadedMetadata(video);
    expect(screen.queryByTestId("save-guide")).toBeNull();
  });
});
