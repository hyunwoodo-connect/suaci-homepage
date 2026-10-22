import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { stripCaption } from "../strip/compose";
import PrintScreen, { PRINT_STEP_MS } from "./PrintScreen";

const FRAMES = [0, 1, 2, 3].map(() => document.createElement("canvas"));
const TAKEN = new Date("2026-10-22T05:00:00Z");

function stubReducedMotion(isReduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: isReduced && query.includes("reduce") })),
  );
}

function openCells() {
  return document.querySelectorAll('[data-cell-cover="open"]').length;
}

function renderPrint(props: Partial<Parameters<typeof PrintScreen>[0]> = {}) {
  const handlers = { onReceive: vi.fn(), onRetry: vi.fn(), onRetake: vi.fn() };
  const view = render(
    <PrintScreen
      frames={FRAMES}
      caption={stripCaption("live", TAKEN)}
      status="ready"
      {...handlers}
      {...props}
    />,
  );
  return { ...handlers, view };
}

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom엔 canvas가 없다
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  stubReducedMotion(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PrintScreen", () => {
  it("처음 → printing…·4초, 칸은 다 덮여 있다", () => {
    renderPrint();
    expect(screen.getByText("printing…")).toBeInTheDocument();
    expect(screen.getByText("4초")).toBeInTheDocument();
    expect(openCells()).toBe(0);
    expect(screen.queryByRole("button", { name: "받기" })).toBeNull();
  });

  it("0.9초마다 → 칸이 한 장씩 드러난다", () => {
    renderPrint();
    act(() => vi.advanceTimersByTime(PRINT_STEP_MS));
    expect(openCells()).toBe(1);
    expect(screen.getByText("3초")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(PRINT_STEP_MS));
    expect(openCells()).toBe(2);
  });

  it("네 칸 다 드러나고 합성 끝 → here.·받기, 누르면 onReceive", () => {
    const { onReceive } = renderPrint();
    for (let i = 0; i < 4; i += 1) act(() => vi.advanceTimersByTime(PRINT_STEP_MS));
    expect(openCells()).toBe(4);
    expect(screen.getByText("here.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "받기" }));
    expect(onReceive).toHaveBeenCalledTimes(1);
  });

  it("칸은 다 드러났지만 합성 중 → 받기는 아직", () => {
    renderPrint({ status: "composing" });
    for (let i = 0; i < 4; i += 1) act(() => vi.advanceTimersByTime(PRINT_STEP_MS));
    expect(screen.queryByRole("button", { name: "받기" })).toBeNull();
    expect(screen.getByText("printing…")).toBeInTheDocument();
  });

  it("움직임 줄이기 → 칸을 처음부터 다 보여 주고 바로 받기", () => {
    stubReducedMotion(true);
    renderPrint();
    expect(openCells()).toBe(4);
    expect(screen.getByRole("button", { name: "받기" })).toBeInTheDocument();
  });

  it("합성 실패 → oops.·다시 인화하기·다시 찍기", () => {
    const { onRetry, onRetake } = renderPrint({ status: "failed" });
    expect(screen.getByText("oops.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 인화하기" }));
    fireEvent.click(screen.getByRole("button", { name: "다시 찍기" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetake).toHaveBeenCalledTimes(1);
  });

  it("이벤트 끝남 → 띠 아래 No.01 없음", () => {
    renderPrint({ caption: stripCaption("ended", TAKEN) });
    expect(screen.queryByText("No.01")).toBeNull();
    expect(screen.getByText("no.----")).toBeInTheDocument();
  });
});
