import { describe, expect, it } from "vitest";

import data from "./tea.data.json";
import { readTeaTuning, TEA } from "./teaTuning";

// 고친 값 하나만 바꿔 넣은 사본
function edited(change: (copy: Record<string, unknown>) => void): unknown {
  const copy = structuredClone(data) as Record<string, unknown>;
  change(copy);
  return copy;
}

describe("티타임 행성 값 파일(tea.data.json)", () => {
  it("지금 파일 → 그대로 읽힌다(기획서 13장의 가안)", () => {
    expect(readTeaTuning(data)).toEqual(TEA);
    expect(TEA.planet.radius).toBe(30);
    expect(TEA.round).toEqual({ cap: 240, lastCall: 220 });
    expect(TEA.sneak.every).toEqual([8, 14]);
    expect(TEA.warm.bands).toEqual([40, 20, 8]);
  });

  it("수가 글로 들어가면 → 그 칸 이름을 알리며 멈춘다", () => {
    const bad = edited((c) => {
      (c.flee as Record<string, unknown>).speed = "5m";
    });
    expect(() => readTeaTuning(bad)).toThrow("flee.speed: 수여야 한다");
  });

  it("위 접시가 아래보다 넓으면 → 멈춘다", () => {
    const bad = edited((c) => {
      (c.stand as Record<string, unknown>).plates = [
        [8, 20],
        [17, 24],
        [25, 14],
      ];
    });
    expect(() => readTeaTuning(bad)).toThrow("stand.plates[1]: 아래 접시보다 좁아야 한다");
  });

  it("버섯이 두 층을 건너뛰면 → 멈춘다", () => {
    const bad = edited((c) => {
      const movers = c.movers as { mushrooms: { to: number[] }[] };
      movers.mushrooms[0].to = [2, 9, 140];
    });
    expect(() => readTeaTuning(bad)).toThrow("버섯은 바로 위 층에 내려 준다");
  });

  it("마지막 20초가 판 상한보다 늦으면 → 멈춘다", () => {
    const bad = edited((c) => {
      (c.round as Record<string, unknown>).lastCall = 260;
    });
    expect(() => readTeaTuning(bad)).toThrow("round.lastCall");
  });
});
