import { describe, expect, it } from "vitest";

import { emptySave } from "../progress/save";
import { visitLandmark } from "./visits";

describe("visitLandmark", () => {
  it("처음 → 1, 그다음은 몇 번째인지, 지역마다 따로 센다", () => {
    const save = emptySave();
    expect(visitLandmark(save, 2, 10)).toBe(1);
    expect(visitLandmark(save, 2, 11)).toBe(2);
    expect(visitLandmark(save, 0, 11)).toBe(1);
    expect(save.lm).toEqual({ 0: { n: 1, day: 11 }, 2: { n: 2, day: 11 } });
  });
});
