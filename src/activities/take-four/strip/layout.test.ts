import { describe, it, expect } from "vitest";

import { STRIP, stripLayout } from "./layout";
import type { Rect } from "./layout";

function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function inside(inner: Rect, outer: Rect) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

const PAPER = { x: 0, y: 0, width: STRIP.width, height: STRIP.height };

describe("stripLayout", () => {
  const layout = stripLayout();
  const stroke = layout.border.stroke;
  // 테두리 선 안쪽
  const innerPaper = {
    x: stroke,
    y: stroke,
    width: STRIP.width - stroke * 2,
    height: STRIP.height - stroke * 2,
  };

  it("띠 크기 → 900×2970", () => {
    expect(STRIP).toEqual({ width: 900, height: 2970 });
  });

  it("칸 → 4개, 모두 가로 4:3", () => {
    expect(layout.frames).toHaveLength(4);
    for (const frame of layout.frames) expect(frame.width / frame.height).toBe(4 / 3);
  });

  it("칸 → 위에서 아래로, 서로 안 겹치고 간격이 같다", () => {
    const gaps = layout.frames.slice(1).map((f, i) => {
      const prev = layout.frames[i];
      expect(overlaps(prev, f)).toBe(false);
      return f.y - (prev.y + prev.height);
    });
    expect(new Set(gaps).size).toBe(1);
    expect(gaps[0]).toBeGreaterThan(0);
  });

  it("사진 기둥 → 시안 띠 사진(144×450)·견본 띠(480×1500)와 같은 비율, 칸을 꼭 감싼다", () => {
    expect(layout.photo.width / layout.photo.height).toBeCloseTo(144 / 450, 10);
    expect(layout.photo.y).toBe(layout.frames[0].y);
    const last = layout.frames[3];
    expect(layout.photo.y + layout.photo.height).toBe(last.y + last.height);
    // 견본 띠처럼 칸 사이 = 칸 폭의 20/480
    expect(layout.frames[1].y - layout.frames[0].y - layout.frames[0].height).toBe(
      (layout.photo.width * 20) / 480,
    );
  });

  it("칸·캡션 → 테두리 선 안쪽, 캡션은 사진 아래", () => {
    for (const frame of layout.frames) expect(inside(frame, innerPaper)).toBe(true);
    expect(inside(layout.caption, innerPaper)).toBe(true);
    expect(layout.caption.y).toBeGreaterThanOrEqual(layout.photo.y + layout.photo.height);
    expect(layout.caption.height).toBeGreaterThan(layout.font.number);
  });

  it("도장 → 오른쪽 위, 띠 안쪽에 통째로", () => {
    const { x, y, r } = layout.stamp;
    expect(inside({ x: x - r, y: y - r, width: r * 2, height: r * 2 }, innerPaper)).toBe(true);
    expect(x).toBeGreaterThan(STRIP.width / 2);
    expect(y).toBeLessThan(layout.frames[1].y);
  });

  it("물결 테두리 → 띠를 꽉 채우되 선이 그림 밖으로 안 나간다", () => {
    const xs = layout.border.points.map((p) => p.x);
    const ys = layout.border.points.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(stroke / 2, 5);
    expect(Math.max(...xs)).toBeCloseTo(STRIP.width - stroke / 2, 5);
    expect(Math.min(...ys)).toBeCloseTo(stroke / 2, 5);
    expect(Math.max(...ys)).toBeCloseTo(STRIP.height - stroke / 2, 5);
    expect(inside(innerPaper, PAPER)).toBe(true);
  });
});
