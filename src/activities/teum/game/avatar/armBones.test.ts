import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { addReachBones, armShare } from "./armBones";

// 뼈: 0 Hips · 1 Spine02 · 2 headfront
const BONES = ["Hips", "Spine02", "headfront"];

/** 키 1.2 · 팔을 편 폭 0.88(가운데 0)인 몸에 점을 놓는다: [y, z] — 모두 머리 앞 뼈에 묶여 있다 */
function body(points: [number, number][]) {
  const all: [number, number][] = [[0, -0.44], [1.2, 0.44], ...points];
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
      all.flatMap(() => [2, 0, 0, 0]),
      4,
    ),
  );
  g.setAttribute(
    "skinWeight",
    new THREE.Float32BufferAttribute(
      all.flatMap(() => [1, 0, 0, 0]),
      4,
    ),
  );
  const mesh = new THREE.SkinnedMesh(g, new THREE.MeshBasicMaterial());
  const bones = BONES.map((name) => Object.assign(new THREE.Bone(), { name }));
  bones[0].add(bones[1]);
  bones[1].add(bones[2]);
  bones[1].position.y = 0.7;
  mesh.add(bones[0]);
  mesh.bind(new THREE.Skeleton(bones));
  return mesh;
}

function weightsOf(mesh: THREE.SkinnedMesh, i: number) {
  const si = mesh.geometry.attributes.skinIndex,
    sw = mesh.geometry.attributes.skinWeight,
    names = mesh.skeleton.bones.map((b) => b.name);
  const out: Record<string, number> = {};
  const pairs = [
    [si.getX(i), sw.getX(i)],
    [si.getY(i), sw.getY(i)],
    [si.getZ(i), sw.getZ(i)],
    [si.getW(i), sw.getW(i)],
  ];
  for (const [b, w] of pairs) if (w > 1e-6) out[names[b]] = +w.toFixed(3);
  return out;
}

describe("armShare", () => {
  it("옆으로 0.22 넘게 나간 점(높이 0.44~0.84) → 온전히 팔", () => {
    expect(armShare(0.6, 0.3)).toBe(1);
    expect(armShare(0.5, 0.43)).toBe(1);
  });

  it("몸통(옆으로 0.16 안)·치마 높이의 몸통 곁·머리 높이 → 팔이 아니다", () => {
    expect(armShare(0.7, 0.1)).toBe(0);
    expect(armShare(0.5, 0.2)).toBe(0);
    expect(armShare(0.9, 0.3)).toBe(0);
    expect(armShare(0.4, 0.3)).toBe(0);
  });

  it("어깨께(옆으로 0.16~0.22, 치마 위) → 조금씩 섞인다", () => {
    const near = armShare(0.7, 0.17),
      far = armShare(0.7, 0.21);
    expect(near).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(near);
    expect(far).toBeLessThan(1);
  });
});

describe("addReachBones", () => {
  it("팔의 점 → 그쪽 어깨의 새 뼈에 묶이고, 몸통의 점은 그대로다", () => {
    const mesh = body([
      [0.6, 0.3],
      [0.6, -0.3],
      [0.7, 0.05],
    ]);
    const bones = addReachBones(mesh);
    expect(bones).not.toBeNull();
    expect(weightsOf(mesh, 2)).toEqual({ ReachPlus: 1 });
    expect(weightsOf(mesh, 3)).toEqual({ ReachMinus: 1 });
    expect(weightsOf(mesh, 4)).toEqual({ headfront: 1 });
  });

  it("새 뼈 → 어깨 자리(높이 0.74, 옆으로 0.17)에 세계 축과 나란히 놓인다", () => {
    const mesh = body([[0.6, 0.3]]),
      bones = addReachBones(mesh)!,
      at = new THREE.Vector3(),
      turn = new THREE.Quaternion();
    bones.plus.getWorldPosition(at);
    bones.plus.getWorldQuaternion(turn);
    expect(at.y).toBeCloseTo(0.74);
    expect(at.z).toBeCloseTo(0.17);
    expect(turn.angleTo(new THREE.Quaternion())).toBeCloseTo(0);
  });

  it("새 뼈를 돌리면 → 팔의 점이 어깨를 축으로 돈다(몸통의 점은 제자리)", () => {
    const mesh = body([
      [0.6, 0.3],
      [0.7, 0.05],
    ]);
    const bones = addReachBones(mesh)!;
    bones.plus.rotation.x = -Math.PI / 2;
    mesh.updateMatrixWorld(true);
    mesh.skeleton.update();
    const arm = mesh.getVertexPosition(2, new THREE.Vector3()),
      torso = mesh.getVertexPosition(3, new THREE.Vector3());
    // 어깨(0.74, 0.17)에서 (아래로 0.14, 옆으로 0.13) 떨어진 점이 -90도 돌면 (위로 0.13, 옆으로 0.14)
    expect(arm.y).toBeCloseTo(0.74 + 0.13);
    expect(arm.z).toBeCloseTo(0.17 + 0.14);
    expect(torso.y).toBeCloseTo(0.7);
  });

  it("몸이 아닌 메시(키·폭 비율이 다름) → 건드리지 않는다", () => {
    const mesh = body([[0.6, 0.3]]);
    mesh.geometry.attributes.position.setZ(1, 3);
    expect(addReachBones(mesh)).toBeNull();
    expect(weightsOf(mesh, 2)).toEqual({ headfront: 1 });
  });
});
