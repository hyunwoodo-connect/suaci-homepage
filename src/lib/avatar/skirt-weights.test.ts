import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { unbindSkirtFromArms } from "./skirt-weights";

// 뼈: 0 Hips · 1 RightUpLeg · 2 LeftArm · 3 LeftHand
const BONES = ["Hips", "RightUpLeg", "LeftArm", "LeftHand"];

/** 키 1.2 · 팔 편 폭 0.8(가운데 0)인 몸에 점을 놓는다: [y, z, 뼈 넷, 무게 넷] */
function body(points: [number, number, number[], number[]][]) {
  const all: [number, number, number[], number[]][] = [
    [0, -0.4, [0, 0, 0, 0], [1, 0, 0, 0]],
    [1.2, 0.4, [0, 0, 0, 0], [1, 0, 0, 0]],
    ...points,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      all.flatMap(([y, z]) => [0, y, z]),
      3,
    ),
  );
  g.setAttribute(
    "skinIndex",
    new THREE.Uint16BufferAttribute(
      all.flatMap(([, , b]) => b),
      4,
    ),
  );
  g.setAttribute(
    "skinWeight",
    new THREE.Float32BufferAttribute(
      all.flatMap(([, , , w]) => w),
      4,
    ),
  );
  const mesh = new THREE.SkinnedMesh(g, new THREE.MeshBasicMaterial());
  const bones = BONES.map((name) => Object.assign(new THREE.Bone(), { name }));
  mesh.bind(new THREE.Skeleton(bones));
  return mesh;
}

function weightsOf(mesh: THREE.SkinnedMesh, i: number) {
  const si = mesh.geometry.attributes.skinIndex,
    sw = mesh.geometry.attributes.skinWeight;
  const out: Record<string, number> = {};
  const pairs = [
    [si.getX(i), sw.getX(i)],
    [si.getY(i), sw.getY(i)],
    [si.getZ(i), sw.getZ(i)],
    [si.getW(i), sw.getW(i)],
  ];
  for (const [b, w] of pairs) if (w > 1e-6) out[BONES[b]] = (out[BONES[b]] ?? 0) + +w.toFixed(4);
  return out;
}

describe("unbindSkirtFromArms", () => {
  it("허리 아래 몸통 가까운 점의 팔 몫 → 그 점의 다른 뼈로 다 넘긴다", () => {
    const mesh = body([[0.3, 0.05, [2, 0, 0, 0], [0.6, 0.4, 0, 0]]]);
    unbindSkirtFromArms(mesh);
    expect(weightsOf(mesh, 2)).toEqual({ Hips: 1 });
  });

  it("허리께(높이 비율 0.56 바로 아래) → 조금만 넘긴다", () => {
    const mesh = body([[0.66, 0, [2, 0, 0, 0], [0.5, 0.5, 0, 0]]]);
    unbindSkirtFromArms(mesh);
    const w = weightsOf(mesh, 2);
    expect(w.LeftArm).toBeGreaterThan(0.4);
    expect(w.LeftArm).toBeLessThan(0.5);
  });

  it("팔 뼈뿐인 점 → 다리뼈로 넘긴다", () => {
    const mesh = body([[0.2, 0, [3, 0, 0, 0], [1, 0, 0, 0]]]);
    unbindSkirtFromArms(mesh);
    expect(weightsOf(mesh, 2)).toEqual({ RightUpLeg: 1 });
  });

  it("편 손(몸통에서 먼 점)·허리 위 점 → 그대로", () => {
    const mesh = body([
      [0.5, 0.38, [3, 0, 0, 0], [1, 0, 0, 0]],
      [0.9, 0, [2, 0, 0, 0], [0.7, 0.3, 0, 0]],
    ]);
    unbindSkirtFromArms(mesh);
    expect(weightsOf(mesh, 2)).toEqual({ LeftHand: 1 });
    expect(weightsOf(mesh, 3)).toEqual({ LeftArm: 0.7, Hips: 0.3 });
  });

  it("몸이 아닌 메시(키·폭 비율이 다름) → 건드리지 않는다", () => {
    const mesh = body([[0.3, 0, [2, 0, 0, 0], [1, 0, 0, 0]]]);
    mesh.geometry.attributes.position.setZ(1, 3);
    unbindSkirtFromArms(mesh);
    expect(weightsOf(mesh, 2)).toEqual({ LeftArm: 1 });
  });
});
