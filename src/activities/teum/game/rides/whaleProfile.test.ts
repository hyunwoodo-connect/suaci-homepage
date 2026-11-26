import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { Height } from "../world/tall";
import type { PathSight } from "./whaleProfile";
import { cruiseTable, sightOf, topsTable } from "./whaleProfile";

/** 고래 몸 가운데에서 배·등까지(m) */
const HALF = 22.7;
const AT = new THREE.Vector3(1, 0, 0);
const thing = (bottom: number, top: number): Height => ({ v: AT, r: 10, bottom, top });
/** 한 바퀴 60 칸, 모두 빈 들판 */
const empty = (): PathSight[] => Array.from({ length: 60 }, () => ({ top: 0, roof: Infinity }));

describe("sightOf — 한 칸 아래에서 본 것", () => {
  it("아무것도 없으면 → 꼭대기는 그 자리의 땅, 지나갈 바닥은 없다", () => {
    expect(sightOf(4, [], HALF)).toEqual({ top: 4, roof: Infinity });
  });

  it("땅에 선 것들 → 가장 높은 꼭대기를 넘는다", () => {
    const sight = sightOf(0, [thing(0, 40), thing(0, 75), thing(0, 20)], HALF);
    expect(sight).toEqual({ top: 75, roof: Infinity });
  });

  it("낮게 떠 있는 것(큰 라임: 33~84m) → 그 아래로는 못 지나간다, 꼭대기를 넘는다", () => {
    expect(sightOf(0, [thing(33, 84)], HALF)).toEqual({ top: 84, roof: Infinity });
  });

  it("높이 떠 있는 것(떠 있는 섬: 123~163m) → 넘지 않고 그 바닥 아래로 지나간다", () => {
    expect(sightOf(0, [thing(123, 163)], HALF)).toEqual({ top: 0, roof: 123 });
  });

  it("떠 있는 것 아래에 선 것이 있으면 → 선 것은 넘고 떠 있는 것은 그 아래로", () => {
    expect(sightOf(0, [thing(123, 163), thing(0, 30)], HALF)).toEqual({ top: 30, roof: 123 });
  });
});

describe("cruiseTable — 평소 높이 표", () => {
  it("빈 들판만 → 어디서나 평소 높이(60m)", () => {
    const table = cruiseTable(empty(), HALF);
    expect([Math.min(...table), Math.max(...table)]).toEqual([60, 60]);
  });

  it("몸의 절반보다 낮은 것(30m) → 평소 높이 그대로(배가 이미 그 위에 떠 있다)", () => {
    const sights = empty();
    sights[30].top = 30;
    expect(cruiseTable(sights, HALF)[30]).toBe(60);
  });

  it("높은 것(50m) 위 → 배가 꼭대기 위로 뜬다(가운데가 아니라 배가)", () => {
    const sights = empty();
    sights[30].top = 50;
    const belly = cruiseTable(sights, HALF)[30] - HALF;
    expect(belly).toBeGreaterThan(50);
  });

  it("높은 것 곁의 칸 → 미리 올라가 있고, 멀리서는 평소 높이로 돌아온다", () => {
    const sights = empty();
    sights[30].top = 50;
    const table = cruiseTable(sights, HALF);
    expect([table[28] > 60, table[32] > 60, table[45]]).toEqual([true, true, 60]);
  });

  it("아주 높은 것(150m) → 가장 높게(112m)를 넘지 않는다", () => {
    const sights = empty();
    sights[30].top = 150;
    expect(Math.max(...cruiseTable(sights, HALF))).toBe(112);
  });

  it("높이 떠 있는 것 아래 → 등이 그 바닥 아래로 내려와 있다(곁의 높은 것 때문에 올라가 있지 않다)", () => {
    const sights = empty();
    sights[30].roof = 101;
    sights[33].top = 80;
    const back = cruiseTable(sights, HALF)[30] + HALF;
    expect(back).toBeLessThan(101);
  });

  it("표의 끝과 처음은 이어져 있다(고리) → 끝 칸의 높은 것이 첫 칸도 올린다", () => {
    const sights = empty();
    sights[59].top = 60;
    expect(cruiseTable(sights, HALF)[0]).toBeGreaterThan(60);
  });
});

describe("topsTable — 등을 내줄 때 낮출 수 있는 데까지", () => {
  it("칸마다 곁(앞뒤 7칸)의 가장 높은 꼭대기", () => {
    const sights = empty();
    sights[30].top = 50;
    const tops = topsTable(sights);
    expect([tops[23], tops[30], tops[37], tops[38]]).toEqual([50, 50, 50, 0]);
  });

  it("높이 떠 있는 것은 넣지 않는다(그 아래에서는 마음껏 낮춘다)", () => {
    const sights = empty();
    sights[30].roof = 123;
    expect(Math.max(...topsTable(sights))).toBe(0);
  });
});
