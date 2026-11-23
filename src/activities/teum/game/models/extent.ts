import * as THREE from "three";

// 모델 크기 재기: 맞출 기준 길이, 높은 부분이 어느 쪽인지

/** 위쪽(높은 부분)이 어느 쪽에 있는지 — 대포는 주둥이 쪽, 미끄럼틀은 탑 쪽. frame 은 셈을 할 좌표계(세계 행렬 앞에 곱한다) */
export function topDir(
  hold: THREE.Object3D,
  frame: THREE.Matrix4 = new THREE.Matrix4(),
): { x: number; z: number; len: number; ext: number } {
  hold.updateMatrixWorld(true);
  const box = new THREE.Box3(),
    part = new THREE.Box3(),
    m = new THREE.Matrix4();
  hold.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const geometry: THREE.BufferGeometry = o.geometry;
    if (geometry.boundingBox === null) geometry.computeBoundingBox();
    m.multiplyMatrices(frame, o.matrixWorld);
    part.copy(geometry.boundingBox!).applyMatrix4(m);
    box.union(part);
  });
  const c = new THREE.Vector3();
  box.getCenter(c);
  const cut = box.min.y + (box.max.y - box.min.y) * 0.72,
    acc = new THREE.Vector3(),
    t = new THREE.Vector3();
  let n = 0;
  hold.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    m.multiplyMatrices(frame, o.matrixWorld);
    const a = o.geometry.attributes.position;
    for (let i = 0; i < a.count; i += 3) {
      t.fromBufferAttribute(a, i).applyMatrix4(m);
      if (t.y > cut) {
        acc.add(t);
        n++;
      }
    }
  });
  const mean = 1 / Math.max(1, n);
  acc.multiplyScalar(mean).sub(c);
  acc.y = 0;
  const width = box.max.x - box.min.x,
    depth = box.max.z - box.min.z,
    ext = Math.max(width, depth);
  return { x: acc.x, z: acc.z, len: acc.length(), ext };
}

/** 맞출 기준 길이: w 는 가로·세로 중 긴 쪽, x·z 는 그 축, 나머지(h)는 키 */
export function extentBy(sz: THREE.Vector3, by: string): number {
  if (by === "w") return Math.max(sz.x, sz.z);
  if (by === "x") return sz.x;
  if (by === "z") return sz.z;
  return sz.y;
}
