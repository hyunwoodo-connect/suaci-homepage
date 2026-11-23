import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { S } from "../settings";
import { Land } from "./land";
import { offset } from "./sphere";
import { Occupancy } from "./occupancy";

const START = new THREE.Vector3(0, 1, 0);

describe("Occupancy", () => {
  it("isFree → 하나씩 다 보는 것과 같은 답(칸 나눔으로 줄여 봐도)", () => {
    const occ = new Occupancy();
    const filled: { v: THREE.Vector3; r: number }[] = [];
    for (let i = 0; i < 300; i++) {
      const v = offset(START, (i * 37) % 900, (i * 53) % 360),
        r = 2 + (i % 9) * 4;
      occ.fill(v, r);
      filled.push({ v, r });
    }
    for (let i = 0; i < 400; i++) {
      const q = offset(START, (i * 11) % 950, (i * 29) % 360),
        pad = 1 + (i % 7);
      const brute = !filled.some((o) => o.v.angleTo(q) * S.R < o.r + pad);
      expect(occ.isFree(q, pad)).toBe(brute);
    }
  });

  it("바다는 늘 찬 자리 → 뭍이 정해진 지도에서 바다의 빈자리는 없다", () => {
    const land = new Land({ dist: 0, bear: 0, reach: 90 });
    const occ = new Occupancy(land);
    const quarter = (Math.PI * S.R) / 2;
    expect(occ.isFree(offset(START, quarter - 20, 10), 5)).toBe(true);
    expect(occ.isFree(offset(START, quarter + 20, 10), 5)).toBe(false);
  });

  it("nearCorridor → 통로 반지름 + pad 안이면 true", () => {
    const occ = new Occupancy();
    occ.addCorridor(START, 10);
    expect(occ.nearCorridor(offset(START, 12, 0), 3)).toBe(true);
    expect(occ.nearCorridor(offset(START, 14, 0), 3)).toBe(false);
  });
});
