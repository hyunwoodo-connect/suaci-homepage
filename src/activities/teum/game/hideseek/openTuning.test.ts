import { describe, expect, it } from "vitest";

import data from "./hideseek.data.json";
import { readStageTuning, splitAt, STAGE } from "./openTuning";

describe("조각 03 의 값", () => {
  it("명세의 값 그대로 — 리본·열어 보기·주민·테두리", () => {
    expect(STAGE.ribbon).toMatchObject({ scale: 0.35, swaySeconds: 2.4, swayDegrees: 8 });
    expect(STAGE.open).toMatchObject({
      shakeTimes: 3,
      shakeDegrees: 7,
      holdSeconds: 0.08,
      hitSwell: 0.25,
      missSink: 0.12,
      confetti: 24,
    });
    expect(STAGE.npc).toMatchObject({ greetReach: 12, yieldReach: 6, greetCooldown: 30 });
    expect(STAGE.npc.peekEvery).toEqual([15, 25]);
    expect(STAGE.npc.peekReach).toBe(10);
    expect(STAGE.outlinePx).toBe(2);
  });

  it("결과가 갈리는 때 → 누른 뒤 0.66초(미스트 0.2 + 덜컹 0.33 + 숨죽임 0.08 + 사이 0.05)", () => {
    expect(splitAt(STAGE.open)).toBeCloseTo(0.66, 2);
  });

  it("꽝은 1.8초 안에 끝난다", () => {
    expect(STAGE.open.missEnd).toBeLessThanOrEqual(1.8);
  });

  it("덜컹 시간·부푼 크기가 덜컹 횟수와 다르면 → 어느 칸인지 알리며 멈춘다", () => {
    const broken = { ...data, open: { ...data.open, shakeSeconds: [0.14, 0.11] } };
    expect(() => readStageTuning(broken)).toThrow("open.shakeSeconds");
  });

  it("칸이 빠지면 → 그 칸 이름", () => {
    const { ribbon, ...rest } = data;
    void ribbon;
    expect(() => readStageTuning(rest)).toThrow("ribbon");
  });
});
