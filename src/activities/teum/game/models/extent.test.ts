import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { girthAt, girthOf } from "./extent";

/** 밑동(반지름 6, 키 4) 위에 가는 줄기(반지름 2, 키 8), 그 위에 넓은 갓(반지름 9, 키 6)을 올린 나무 — 가운데가 원점 */
function tree(): THREE.Group {
  const hold = new THREE.Group();
  const part = (radius: number, height: number, bottom: number) => {
    const g = new THREE.CylinderGeometry(radius, radius, height, 48, 8, true),
      mesh = new THREE.Mesh(g);
    mesh.position.y = bottom + height / 2 - 9;
    hold.add(mesh);
  };
  part(6, 4, 0);
  part(2, 8, 4);
  part(9, 6, 12);
  return hold;
}

describe("girthOf", () => {
  it("높이마다 굵기가 다른 모델 → 밑동·줄기·갓의 반지름이 높이 띠마다 따로 나온다", () => {
    const girth = girthOf(tree(), 1);
    expect(girth.radii[0]).toBeCloseTo(6, 1);
    expect(girth.radii[3]).toBeCloseTo(2, 1);
    expect(girth.radii[7]).toBeCloseTo(9, 1);
  });

  it("틀의 배율 → 굵기와 높이가 같이 커진다", () => {
    const girth = girthOf(tree(), 2);
    expect(girth.radii[0]).toBeCloseTo(12, 1);
    expect(girth.radii.length).toBeGreaterThanOrEqual(18);
  });
});

describe("girthAt", () => {
  const girth = { step: 2, radii: [6, 6, 2, 2, 2, 2, 9, 9, 9] };

  it("몸이 걸친 높이에서 가장 굵은 곳 → 그 반지름", () => {
    expect(girthAt(girth, 0.3, 2.1)).toBe(6);
    expect(girthAt(girth, 5, 6.8)).toBe(2);
    expect(girthAt(girth, 10.5, 12.3)).toBe(9);
  });

  it("꼭대기보다 위 · 바닥보다 아래 → 0(막지 않는다)", () => {
    expect(girthAt(girth, 18.5, 20)).toBe(0);
    expect(girthAt(girth, -3, -1)).toBe(0);
  });
});
