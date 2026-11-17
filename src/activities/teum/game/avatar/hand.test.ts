import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { handPoints } from "./hand";
import { HAND_FROM_Z } from "./parts";

/** 처음 선 자세의 z 만 다른 점들로 몸 메시를 만든다(키 0.6 높이에 나란히) */
function bodyWith(zs: number[]): THREE.SkinnedMesh {
  const g = new THREE.BufferGeometry();
  const xyz = zs.flatMap((z) => [0, 0.6, z]);
  g.setAttribute("position", new THREE.Float32BufferAttribute(xyz, 3));
  return new THREE.SkinnedMesh(g, new THREE.MeshBasicMaterial());
}

describe("handPoints", () => {
  it("소매 끝보다 그쪽으로 더 나간 점만 → 손(소매·몸·반대쪽 손은 빠진다)", () => {
    const sleeve = HAND_FROM_Z - 0.01,
      hand = HAND_FROM_Z + 0.01,
      tip = HAND_FROM_Z + 0.06;
    const mesh = bodyWith([-tip, -sleeve, 0, sleeve, hand, tip]);
    const right = handPoints([mesh], 1).map((p) => p.i);
    const left = handPoints([mesh], -1).map((p) => p.i);
    expect(right).toEqual([4, 5]);
    expect(left).toEqual([0]);
  });

  it("메시가 여럿이면 → 모두에서 모은다", () => {
    const a = bodyWith([HAND_FROM_Z + 0.02]),
      b = bodyWith([0, HAND_FROM_Z + 0.03]);
    const points = handPoints([a, b], 1);
    expect(points.map((p) => [p.mesh === a ? "a" : "b", p.i])).toEqual([
      ["a", 0],
      ["b", 1],
    ]);
  });
});
