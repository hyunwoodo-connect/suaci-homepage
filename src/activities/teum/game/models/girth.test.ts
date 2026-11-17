import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { BIG_FLOWERS, SCULPTURES } from "../../assets/settings";
import { GIRTH_BANDS, GIRTHS, measureGirth, stampedParts } from "./girth";

describe("굵기 표(assets/girths.json)", () => {
  it("조형물·큰 풍선 꽃·열기구가 모두 있다 → 통째 원기둥으로 보는 것이 없다", () => {
    const keys = [...Object.keys(SCULPTURES), ...BIG_FLOWERS, "d_hotairballoon"],
      missing = keys.filter((key) => !GIRTHS[key]);
    expect(missing).toEqual([]);
  });

  it("줄마다 토막 수가 같고 음수가 없다", () => {
    for (const [key, girth] of Object.entries(GIRTHS)) {
      expect(girth, key).toHaveLength(GIRTH_BANDS);
      expect(Math.min(...girth), key).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("stampedParts", () => {
  it("표에 있는 모델 → 키에 맞춘 토막(막대사탕의 막대는 머리보다 가늘다)", () => {
    const parts = stampedParts("s_lollipop", 0.3, 100, 0),
      stick = parts[3],
      head = parts[10];
    expect(parts).toHaveLength(GIRTH_BANDS);
    expect(stick.r).toBeLessThan(head.r / 3);
    expect(parts[parts.length - 1].hi).toBeCloseTo(100, 5);
  });

  it("표에 없는 모델 → 반너비로 통째 원기둥", () => {
    expect(stampedParts("no_such_model", 0.4, 10, 2)).toEqual([{ r: 4, lo: 2, hi: 12 }]);
  });

  it("softFrom 부터는 무른 토막", () => {
    const parts = stampedParts("flower_pink", 0.3, 16, 0, 0.5);
    expect(parts[0].isSoft).toBe(false);
    expect(parts[GIRTH_BANDS - 1].isSoft).toBe(true);
  });
});

describe("measureGirth", () => {
  it("원기둥 → 토막마다 반지름이 같다(키 1 기준)", () => {
    const geometry = new THREE.CylinderGeometry(2, 2, 8, 24, 16),
      root = new THREE.Group();
    root.add(new THREE.Mesh(geometry));
    const girth = measureGirth(root)!;
    expect(girth).toHaveLength(GIRTH_BANDS);
    for (const r of girth) expect(r).toBeCloseTo(0.25, 2);
  });

  it("점이 없으면 → null", () => {
    expect(measureGirth(new THREE.Group())).toBeNull();
  });
});
