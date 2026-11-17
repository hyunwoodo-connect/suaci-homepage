import type * as THREE from "three";

import { HAND_FROM_Z } from "./parts";

/** 몸 메시의 점 하나 */
export interface SkinPoint {
  mesh: THREE.SkinnedMesh;
  i: number;
}

/** 몸 메시들에서 한쪽 손의 점: 처음 선 자세에서 소매 끝(HAND_FROM_Z)보다 side(+1 · -1) 쪽으로 더 나간 점 */
export function handPoints(meshes: readonly THREE.SkinnedMesh[], side: number): SkinPoint[] {
  const points: SkinPoint[] = [];
  for (const mesh of meshes) {
    const position = mesh.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const out = position.getZ(i) * side;
      if (out > HAND_FROM_Z) points.push({ mesh, i });
    }
  }
  return points;
}
