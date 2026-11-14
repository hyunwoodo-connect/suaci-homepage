import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { S } from "../settings";
import { offset } from "./sphere";
import { Occupancy } from "./occupancy";

const START = new THREE.Vector3(0, 1, 0);

describe("Occupancy", () => {
  it("isFree → 시제품의 some() 과 같은 답(칸 나눔으로 줄여 봐도)", () => {
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

  it("nearCorridor → 통로 반지름 + pad 안이면 true", () => {
    const occ = new Occupancy();
    occ.addCorridor(START, 10);
    expect(occ.nearCorridor(offset(START, 12, 0), 3)).toBe(true);
    expect(occ.nearCorridor(offset(START, 14, 0), 3)).toBe(false);
  });
});
