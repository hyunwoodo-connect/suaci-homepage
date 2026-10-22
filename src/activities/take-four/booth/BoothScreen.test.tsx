import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { CameraStatus } from "./useCamera";
import BoothScreen from "./BoothScreen";
import { COUNT_MS, FLASH_MS, PROMPTS } from "./machine";

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
  return [...PROMPTS, "take suaci."].find((text) => screen.queryByText(text));
}

/** 단계 바에서 링이 둘린 칸(없으면 -1) */
function activeStep() {
  const cell = document.querySelector("[data-active]");
  return cell?.parentElement ? Array.from(cell.parentElement.children).indexOf(cell) : -1;
}

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom엔 canvas가 없다(마지막 장 미리보기)
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
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
  it("찰칵 → 지시 문구 네 개가 순서대로, 단계 바 링이 따라간다", async () => {
    render(<BoothScreen slug="take-four" onDone={vi.fn()} />);
    expect(activeStep()).toBe(-1);
    await pressShutter();

    for (let i = 0; i < 4; i += 1) {
      expect(prompt()).toBe(PROMPTS[i]);
      expect(activeStep()).toBe(i);
      elapse(SHOT_MS);
    }
    expect(prompt()).toBe("take suaci.");
    expect(activeStep()).toBe(-1);
  });

  it("3·2·1이 800ms마다 바뀐다", async () => {
    render(<BoothScreen slug="take-four" onDone={vi.fn()} />);
    await pressShutter();
    expect(screen.getByText("3", { selector: "[aria-live]" })).toBeInTheDocument();
    elapse(COUNT_MS);
    expect(screen.getByText("2", { selector: "[aria-live]" })).toBeInTheDocument();
    elapse(COUNT_MS);
    expect(screen.getByText("1", { selector: "[aria-live]" })).toBeInTheDocument();
  });

  it("다 찍음 → 카메라를 끄고 `다 찍었어요. 인화하기`가 네 장을 넘긴다", async () => {
    const onDone = vi.fn();
    render(<BoothScreen slug="take-four" onDone={onDone} />);
    await pressShutter();
    elapse(SHOT_MS * 4);

    expect(camera.capture).toHaveBeenCalledTimes(4);
    expect(camera.stop).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "다 찍었어요. 인화하기" }));
    expect(onDone).toHaveBeenCalledWith([
      expect.any(HTMLCanvasElement),
      expect.any(HTMLCanvasElement),
      expect.any(HTMLCanvasElement),
      expect.any(HTMLCanvasElement),
    ]);
  });

  it("다 찍은 뒤엔 더 찍지 않는다", async () => {
    render(<BoothScreen slug="take-four" onDone={vi.fn()} />);
    await pressShutter();
    elapse(SHOT_MS * 6);
    expect(camera.capture).toHaveBeenCalledTimes(4);
    expect(prompt()).toBe("take suaci.");
  });

  it("4번째 찰칵 뒤 카메라를 끄는 건 처음으로 되돌리지 않는다", async () => {
    render(<BoothScreen slug="take-four" onDone={vi.fn()} />);
    await pressShutter();
    elapse(SHOT_MS * 4);
    expect(camera.stop).toHaveBeenCalled();
    expect(camera.status).toBe("idle");
    expect(screen.getByRole("button", { name: "다 찍었어요. 인화하기" })).toBeInTheDocument();
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
    render(<BoothScreen slug="take-four" onDone={vi.fn()} />);
    await pressShutter();
    elapse(SHOT_MS + COUNT_MS);
    expect(prompt()).toBe(PROMPTS[1]);

    act(() => setVisibility("hidden"));
    expect(prompt()).toBe(PROMPTS[0]);
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
    "%s → `카메라가 막혀 있어요.` + `다른 방법 보기`가 no-camera로",
    (status) => {
      camera.status = status;
      render(<BoothScreen slug="take-four" onDone={vi.fn()} />);
      expect(screen.getByText("카메라가 막혀 있어요.")).toBeInTheDocument();
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
});
