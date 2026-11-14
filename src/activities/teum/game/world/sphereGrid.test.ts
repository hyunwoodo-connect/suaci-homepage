import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { chordOf, SphereGrid } from "./sphereGrid";

// 고정 씨앗으로 공 위에 고르게 뽑은 점
function points(n: number): THREE.Vector3[] {
  let s = 12345;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1,
      a = r() * Math.PI * 2,
      ring = Math.sqrt(1 - u * u);
    const v = new THREE.Vector3(ring * Math.cos(a), u, ring * Math.sin(a));
    out.push(v);
  }
  return out;
}

describe("SphereGrid", () => {
  const pts = points(3000);
  const grid = new SphereGrid(0.05);
  for (const v of pts) grid.add(v);

  it("query → 그 각 안의 점을 하나도 빠뜨리지 않고, 겹치지 않게", () => {
    const out: number[] = [];
    for (const q of pts.slice(0, 40))
      for (const angle of [0.02, 0.08, 0.3]) {
        const chord = chordOf(angle);
        const got = grid.query(q, chord, out).slice();
        const want = pts.flatMap((v, i) => (v.angleTo(q) < angle ? [i] : []));
        for (const i of want) expect(got).toContain(i);
        expect(new Set(got).size).toBe(got.length);
      }
  });

  it("move → 옮긴 자리에서 찾힌다", () => {
    const g = new SphereGrid(0.05);
    const id = g.add(new THREE.Vector3(0, 1, 0));
    const there = new THREE.Vector3(1, 0, 0);
    g.move(id, there);
    const out: number[] = [];
    expect(g.query(there, 0.01, out)).toEqual([id]);
    expect(g.query(new THREE.Vector3(0, 1, 0), 0.01, out)).toEqual([]);
  });

  it("chordOf → 2·sin(각/2)", () => {
    expect(chordOf(Math.PI / 3)).toBeCloseTo(1, 12);
  });
});
