import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { S } from "../settings";
import { Land } from "../world/land";
import { from } from "../world/sphere";
import { grandTour, islandLoop } from "./whaleRoute";

const out = new THREE.Vector3();

describe("고래가 도는 길", () => {
  it("큰 바퀴 → 출발 마을 곁에서 떠나 행성 반대쪽까지 간다", () => {
    const route = grandTour();
    const start = from(0, 0);
    expect(route.at(0, out).angleTo(start) * S.R).toBeLessThan(80);
    let farthest = 0;
    for (let t = 0; t < 220; t += 2) farthest = Math.max(farthest, route.at(t, out).angleTo(start));
    expect(farthest).toBeGreaterThan(3);
    expect(route.tables).toBe(2);
  });

  it("섬 일주 → 한 바퀴 내내 뭍 위, 세 마을 곁(120m 안)을 지난다", () => {
    const spec = { dist: 225.8, bear: 225, reach: 90 };
    const land = new Land(spec);
    const route = islandLoop(land.centre!);
    const towns = [from(0, 0), from(371.3, 180), from(371.3, 270)];
    const nearest = towns.map(() => Infinity);
    for (let t = 0; t < 200; t += 0.5) {
      const v = route.at(t, out);
      expect(land.has(v, 250)).toBe(true);
      towns.forEach((town, k) => {
        nearest[k] = Math.min(nearest[k], v.angleTo(town) * S.R);
      });
    }
    for (const metres of nearest) expect(metres).toBeLessThan(120);
  });

  it("섬 일주의 높이 표 칸과 시계가 같은 고리를 가리킨다", () => {
    const land = new Land({ dist: 225.8, bear: 225, reach: 90 });
    const route = islandLoop(land.centre!);
    const seat = route.tableAt(37);
    const cells = 240;
    const i = Math.floor(seat.along * cells);
    const cell = route.cell(seat.table, i, cells, new THREE.Vector3());
    expect(cell.angleTo(route.at(37, out)) * S.R).toBeLessThan(10);
  });
});
