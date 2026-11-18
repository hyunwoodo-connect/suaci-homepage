import { afterEach, describe, expect, it, vi } from "vitest";

import type { Hud } from "../hud";
import { Input } from "./input";

const RULE = { ms: 200, movePx: 10 };

describe("Input", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("짧고 조금 움직인 누름 → 톡 좌표를 넘긴다", () => {
    const { canvas, taps, input } = setup();
    press(canvas, [0, 0, 0], [3, 0, 50], [3, 0, 120]);
    expect(taps).toEqual([[3, 0]]);
    input.dispose();
  });

  it("tap.ms 보다 오래 누름 → 톡이 아니다", () => {
    const { canvas, taps, input } = setup();
    press(canvas, [0, 0, 0], [0, 0, 100], [0, 0, 260]);
    expect(taps).toEqual([]);
    input.dispose();
  });

  it("tap.movePx 넘게 움직임 → 톡이 아니다", () => {
    const { canvas, taps, input } = setup();
    press(canvas, [0, 0, 0], [14, 0, 60], [14, 0, 120]);
    expect(taps).toEqual([]);
    input.dispose();
  });

  it("끌기가 막 시작됐어도(DRAG_PX 넘게) tap.movePx 안 → 톡 좌표를 넘긴다", () => {
    const { canvas, taps, input } = setup();
    press(canvas, [0, 0, 0], [9, 0, 60], [9, 0, 120]);
    expect(taps).toEqual([[9, 0]]);
    input.dispose();
  });
});

/* ─── 내부 ─────────────────────────── */

function setup() {
  const canvas = document.createElement("canvas"),
    taps: number[][] = [];
  const input = new Input(canvas, hudStub(), RULE, (x, y) => taps.push([x, y]));
  return { canvas, taps, input };
}

function hudStub(): Hud {
  const stick = document.createElement("div"),
    knob = document.createElement("div");
  return { stick, knob, hideHint: () => {} } as unknown as Hud;
}

// [x, y, ms] 로 누르고(첫 칸), 움직이고(가운데), 뗀다(끝 칸)
function press(canvas: HTMLCanvasElement, ...steps: [number, number, number][]) {
  const clock = vi.spyOn(performance, "now");
  steps.forEach(([x, y, ms], i) => {
    const isFirst = i === 0,
      isLast = i === steps.length - 1;
    const type = isFirst ? "pointerdown" : isLast ? "pointerup" : "pointermove";
    clock.mockReturnValue(ms);
    canvas.dispatchEvent(pointer(type, x, y));
  });
}

function pointer(type: string, x: number, y: number): Event {
  const e = new MouseEvent(type, { clientX: x, clientY: y });
  Object.defineProperty(e, "pointerId", { value: 1 });
  return e;
}
