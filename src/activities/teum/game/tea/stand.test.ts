import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { StandShape } from "./stand";
import { TEA } from "./teaTuning";

const stand = new StandShape(TEA);
const R = stand.R;

function v(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(x, y, z);
}

describe("StandShape(기획서 v3.1 1장)", () => {
  it("접시 셋 → 북극 땅에서 8·17·25m 높이, 반지름 17·12·7m, 기둥 둘레 틈 0.8m", () => {
    expect(stand.plates.map((p) => p.top - R)).toEqual([8, 17, 25]);
    expect(stand.plates.map((p) => p.radius)).toEqual([17, 12, 7]);
    expect(stand.plates[0].holeR).toBeCloseTo(stand.columnR + 0.8);
  });

  it("위 방향: 축에서 20m 안은 축 위(+y), 26m 밖은 별 바깥, 남반구는 늘 별 바깥", () => {
    const up = new THREE.Vector3();
    stand.upAt(v(12, R + 17, 0), up);
    expect(up.y).toBeCloseTo(1);
    const far = v(28, 6, 0);
    stand.upAt(far, up);
    expect(up.angleTo(far.normalize())).toBeCloseTo(0);
    stand.upAt(v(3, -R, 0), up);
    expect(up.y).toBeLessThan(-0.9);
    stand.upAt(v(23, 20, 0), up);
    expect(up.y).toBeGreaterThan(0.6);
    expect(up.x).toBeGreaterThan(0.1);
  });

  it("2단 위에서 아래로 → 2단 윗면, 2단 가장자리 밖에서 아래로 → 1단 윗면", () => {
    const down = new THREE.Vector3(0, 1, 0);
    const on = stand.castDown(v(6, R + 18, 0), down, 5);
    expect(on?.tier).toBe(2);
    expect(on?.point.y).toBeCloseTo(R + 17);
    const off = stand.castDown(v(13, R + 18, 0), down, 20);
    expect(off?.tier).toBe(1);
  });

  it("1단 밖 땅 위에서 아래로 → 별 표면(층 0), 기둥 둘레 틈으로는 접시에 안 닿는다", () => {
    const up = new THREE.Vector3();
    const above = v(19, 26, 0);
    stand.upAt(above, up);
    const ground = stand.castDown(above, up, 20);
    expect(ground?.tier).toBe(0);
    expect(ground?.point.length()).toBeCloseTo(R);
    const inGap = stand.castDown(v(1.5, R + 18, 0), new THREE.Vector3(0, 1, 0), 30);
    expect(inGap?.tier).toBe(0);
  });

  it("떨어지는 동안 → 받는 접시 가장자리 안으로 되돌린다", () => {
    const P = v(16.8, R + 12, 0);
    expect(stand.keepOverCatcher(P, 1)).toBe(true);
    expect(Math.hypot(P.x, P.z)).toBeCloseTo(16);
  });

  it("기둥 속 → 수평으로 밀어낸다(꼭대기 위는 막지 않는다)", () => {
    const inside = v(0.3, R + 17.5, 0);
    expect(stand.pushOutOfColumn(inside, 0.5)).toBe(true);
    expect(Math.hypot(inside.x, inside.z)).toBeCloseTo(stand.columnR + 0.5);
    const above = v(0.3, stand.topY + 2, 0);
    expect(stand.pushOutOfColumn(above, 0.5)).toBe(false);
  });

  it("보인다 선: 접시를 가로지르면 막히고, 같은 층 위 두 점 사이는 안 막힌다", () => {
    const below = v(10, R + 12, 0),
      onTop = v(10, R + 18, 0);
    expect(stand.segmentBlocked(below, onTop, 0)).toBe(true);
    const a = v(9, R + 18, 0),
      b = v(0, R + 18, 9);
    expect(stand.segmentBlocked(a, b, 0)).toBe(false);
  });

  it("땅 자리 → 북극에서 땅을 따라 잰 거리, 접시 자리 → 가운데에서 수평 거리", () => {
    const g = stand.spotPoint({ tier: 0, dist: 19.3, bear: 180 }, new THREE.Vector3());
    expect(g.length()).toBeCloseTo(R);
    expect(Math.hypot(g.x, g.z)).toBeCloseTo(18, 0);
    const p = stand.spotPoint({ tier: 2, dist: 6, bear: 90 }, new THREE.Vector3());
    expect(p.y).toBeCloseTo(R + 17);
    expect(p.x).toBeCloseTo(6);
  });
});
