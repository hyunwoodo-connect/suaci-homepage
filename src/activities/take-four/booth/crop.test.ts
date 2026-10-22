import { describe, it, expect } from "vitest";

import { centerCrop43, coverGuideRect } from "./crop";

const WINDOW = { width: 240, height: 314 };

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

describe("coverGuideRect", () => {
  it.each([
    [720, 960],
    [1080, 1920],
    [1280, 960],
    [1280, 720],
  ])("%ix%i → 4:3이고, 창 가운데에 있고, 저장 영역을 같은 배율로 옮긴 크기", (vw, vh) => {
    const rect = coverGuideRect(vw, vh, WINDOW.width, WINDOW.height);
    const crop = centerCrop43(vw, vh);
    const scale = Math.max(WINDOW.width / vw, WINDOW.height / vh);
    expect(rect.width / rect.height).toBeCloseTo(4 / 3, 2);
    expect(rect.width).toBeCloseTo(crop.width * scale, 6);
    expect(rect.x + rect.width / 2).toBeCloseTo(WINDOW.width / 2, 6);
    expect(rect.y + rect.height / 2).toBeCloseTo(WINDOW.height / 2, 6);
  });

  it("세로 영상 720×960 → 창 폭을 다 쓰는 240×180", () => {
    const rect = coverGuideRect(720, 960, WINDOW.width, WINDOW.height);
    expect(rect.x).toBeCloseTo(0, 6);
    expect(rect.width).toBeCloseTo(240, 6);
    expect(rect.height).toBeCloseTo(180, 6);
    expect(rect.y).toBeCloseTo(67, 6);
  });

  it("가로 영상 1280×960 → 창보다 넓다(보이는 곳이 다 저장된다)", () => {
    const rect = coverGuideRect(1280, 960, WINDOW.width, WINDOW.height);
    expect(rect.height).toBeCloseTo(314, 6);
    expect(rect.width).toBeGreaterThan(240);
  });
});
