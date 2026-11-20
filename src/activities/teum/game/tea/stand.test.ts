import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { StandShape } from "./stand";
import { TEA } from "./teaTuning";

const stand = new StandShape(TEA);

// 높이 h 의 윗면에서 축으로부터 dist m 떨어진 방향
function dirAt(dist: number, h: number, bear = 0): THREE.Vector3 {
  return stand.dirAt(dist, bear, h, new THREE.Vector3());
}

describe("StandShape", () => {
  it("접시 셋 → 아래부터 높아지고 각이 좁아진다(어디서 떨어져도 한 단 아래가 받는다)", () => {
    const [p1, p2, p3] = stand.plates;
    expect([p1.h, p2.h, p3.h]).toEqual([8, 17, 25]);
    expect(p1.ang).toBeGreaterThan(p2.ang);
    expect(p2.ang).toBeGreaterThan(p3.ang);
  });

  it("2단 가장자리 바로 밖 → 발밑 바닥은 1단", () => {
    const p2 = stand.plates[1];
    const outside = dirAt(p2.half + 0.5, p2.h);
    expect(stand.floorBelow(outside, p2.h)).toBe(stand.plates[0].h);
  });

  it("2단 위 → 바닥 17, 그 아래 땅에서는 1단 아랫면이 천장", () => {
    const d = dirAt(5, 17);
    expect(stand.floorBelow(d, 17)).toBe(17);
    expect(stand.floorBelow(d, 0)).toBe(0);
    expect(stand.ceilingAbove(d, 0)).toBeCloseTo(stand.plates[0].bottom);
  });

  it("1단 가장자리 밖 땅 → 천장 없음, 층 0", () => {
    const d = dirAt(20, 0);
    expect(stand.ceilingAbove(d, 0)).toBe(Infinity);
    expect(stand.tierAt(d, 0)).toBe(0);
  });

  it("3단에서 떨어지는 중 → 받는 접시는 2단, 2단 가장자리를 넘으면 안쪽으로 되돌린다", () => {
    expect(stand.catcherBelow(24)?.tier).toBe(2);
    expect(stand.catcherBelow(7)).toBeNull();
    const p2 = stand.plates[1];
    const far = dirAt(p2.half + 3, 20);
    expect(stand.keepOverCatcher(far, 20, 1)).toBe(true);
    expect(stand.angleOf(far)).toBeLessThan(p2.ang);
  });

  it("기둥 속 → 기둥 겉으로 밀어낸다(꼭대기 위는 막지 않는다)", () => {
    const inside = dirAt(0.3, 17, 90);
    expect(stand.pushOutOfColumn(inside, 17, 0.5)).toBe(true);
    expect(stand.axisDist(inside, 17)).toBeCloseTo(stand.columnR + 0.5);
    const above = dirAt(0.3, 40, 90);
    expect(stand.pushOutOfColumn(above, 40, 0.5)).toBe(false);
  });

  it("자리 → 세계 좌표: 층 높이만큼 별 중심에서 멀다", () => {
    const p = stand.worldOf({ tier: 2, dist: 6, bear: 90 }, 0, new THREE.Vector3());
    expect(p.length()).toBeCloseTo(stand.R + 17);
  });
});
