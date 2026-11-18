import { describe, expect, it } from "vitest";

import manifest from "../../assets/manifest.v10.json";
import { FIND } from "./findTuning";
import { halfWidthFromBoxes, stageZones } from "./stageZones";

const halfWidthOf = halfWidthFromBoxes((key) => {
  const box = (manifest.assets as Record<string, { box?: number[] }>)[key]?.box;
  if (!box) throw new Error(`manifest 에 ${key} 의 크기 상자가 없다`);
  return box;
});

describe("stageZones", () => {
  const zones = stageZones(halfWidthOf);

  it("후보 물건마다 자리가 하나 → 물건 수와 같다", () => {
    const props = zones.filter((z) => ["prop", "tower", "perch"].includes(z.kind));
    expect(props).toHaveLength(FIND.props.length);
  });

  it("탑은 맨 밑 물건의 너비로 서고 쌓은 만큼 높다 → 낱개보다 넓고 높다", () => {
    const tower = zones.find((z) => z.id === "tower-cups")!,
      solo = zones.find((z) => z.id === "cup-w")!;
    expect(tower.kind).toBe("tower");
    expect(tower.r).toBeGreaterThan(solo.r);
    expect(tower.hi).toBeGreaterThan(solo.hi * 2);
  });

  it("통통 구름 위 물건은 떠 있는 자리 → 바닥이 땅보다 높다", () => {
    const perch = zones.find((z) => z.id === "pad-n")!;
    expect(perch.kind).toBe("perch");
    expect(perch.lo).toBeGreaterThan(0);
  });

  it("버섯·출발 줄(출발 자리와 상자 넷)이 들어 있다", () => {
    const count = (kind: string) => zones.filter((z) => z.kind === kind).length;
    expect(count("mushroom")).toBe(FIND.mushrooms.length);
    expect(count("start")).toBe(5);
  });

  it("너비로 맞춘 물건의 반지름 → 크기의 절반 + 둘레", () => {
    const cup = zones.find((z) => z.id === "cup-w")!;
    expect(cup.r).toBeCloseTo(4 / 2 + 0.5, 5);
  });
});

describe("halfWidthFromBoxes", () => {
  it("키로 맞춘 모델은 상자의 너비:키 비율로 반너비를 셈한다", () => {
    const of = halfWidthFromBoxes(() => [-1, 0, -2, 1, 8, 2]);
    expect(of("any", 4, "h")).toBeCloseTo(1, 5);
    expect(of("any", 4, "w")).toBe(2);
  });
});
