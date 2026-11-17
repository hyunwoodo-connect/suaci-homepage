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

/** 높이마다의 몸 굵기: 바닥에서 step(m)씩 올라가며 그 높이 띠의 반지름(m) */
export interface Girth {
  step: number;
  radii: number[];
}

/** 굵기를 재는 높이 띠(m) · 띠 안의 점 가운데 이 몫 번째로 먼 점을 그 띠의 굵기로 친다(삐죽 나온 가지 하나가 벽이 되지 않게) */
const GIRTH_STEP = 2,
  GIRTH_SHARE = 0.9;
/** 모델 하나에서 재는 점 수(이보다 많으면 건너뛰며 잰다) */
const GIRTH_SAMPLES = 6000;

/**
 * 모델 틀(hold — 가운데가 원점, 세로축이 y)의 높이마다 굵기를 잰다(미터 — scale 은 틀의 배율, 바닥이 0).
 * 밑동이 넓고 위에 갓이 있는 나무처럼 높이마다 굵기가 다른 것을 보이는 대로 막는 데 쓴다
 */
export function girthOf(hold: THREE.Object3D, scale: number): Girth {
  hold.updateMatrixWorld(true);
  const toHold = hold.matrixWorld.clone().invert(),
    m = new THREE.Matrix4(),
    t = new THREE.Vector3(),
    points: { y: number; r: number }[] = [];
  let bottom = Infinity;
  hold.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    m.multiplyMatrices(toHold, o.matrixWorld);
    const a = o.geometry.attributes.position,
      every = a.count / GIRTH_SAMPLES,
      skip = Math.ceil(every);
    for (let i = 0; i < a.count; i += skip) {
      t.fromBufferAttribute(a, i).applyMatrix4(m);
      const y = t.y * scale,
        r = Math.hypot(t.x, t.z) * scale;
      points.push({ y, r });
      bottom = Math.min(bottom, y);
    }
  });
  const bands: number[][] = [];
  for (const { y, r } of points) {
    const steps = (y - bottom) / GIRTH_STEP,
      at = Math.floor(steps);
    (bands[at] ??= []).push(r);
  }
  const radii = Array.from(bands, (band) => {
    if (!band || band.length === 0) return 0;
    band.sort((a, b) => a - b);
    const rank = (band.length - 1) * GIRTH_SHARE;
    return band[Math.floor(rank)];
  });
  return { step: GIRTH_STEP, radii };
}

/** 높이 from~to(m, 바닥에서) 사이에서 가장 굵은 곳의 반지름(그 높이에 몸통이 없으면 0) */
export function girthAt(girth: Girth, from: number, to: number): number {
  const low = from / girth.step,
    high = to / girth.step,
    first = Math.floor(low),
    last = Math.floor(high);
  let widest = 0;
  for (let i = Math.max(0, first); i <= last && i < girth.radii.length; i++)
    widest = Math.max(widest, girth.radii[i]);
  return widest;
}
