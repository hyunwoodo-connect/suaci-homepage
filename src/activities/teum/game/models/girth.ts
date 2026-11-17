import * as THREE from "three";

import girthsJson from "../../assets/girths.json";
import type { BodyPart } from "../maps/tangles";

// 모델의 높이마다 굵기: 조형물·큰 풍선 꽃처럼 찍어 놓는 모델은 높이에 따라 굵기가 크게 다르다(막대사탕의 막대 곁은 비어 있다).
// 놓을 때는 모델을 아직 받지 않았으므로, 미리 재 둔 표(assets/girths.json — 키 1 일 때 토막마다의 반지름)를 쓴다.
// 표는 개발 도구가 받은 모델에서 잰다: 개발 서버에서 window.__teum.map.girths() 의 결과를 그 파일에 옮긴다(모델이 바뀌면 다시)

/** 굵기 표: 에셋 키 → 바닥에서 꼭대기까지 토막마다의 반지름(키 1 일 때) */
export const GIRTHS: Readonly<Record<string, readonly number[]>> = girthsJson;

/** 굵기를 재는 토막 수 */
export const GIRTH_BANDS = 16;
/** 모델 하나에서 재는 점 수 · 토막의 굵기로 치는 몫(삐죽 나온 것 하나가 벽이 되지 않게) */
const SAMPLES = 5000,
  GIRTH_SHARE = 0.9;

/**
 * 찍어 놓은 모델(에셋 key, 키 H m, 바닥이 땅에서 lo m)의 몸 토막. 표에 없는 모델은 통째 원기둥(반너비 halfWide × H)으로 본다.
 * softFrom(키의 몫)부터는 무른 것(꽃송이)
 */
export function stampedParts(
  key: string,
  halfWide: number,
  H: number,
  lo: number,
  softFrom = 2,
): BodyPart[] {
  const girth = GIRTHS[key];
  if (!girth) return [{ r: halfWide * H, lo, hi: lo + H }];
  const out: BodyPart[] = [],
    step = H / girth.length;
  girth.forEach((share, i) => {
    if (share <= 0) return;
    out.push({
      r: share * H,
      lo: lo + i * step,
      hi: lo + (i + 1) * step,
      isSoft: i / girth.length >= softFrom,
    });
  });
  return out;
}

/** 받은 모델에서 굵기를 잰다(키 1 일 때 토막마다의 반지름 — 소수 넷째 자리까지). 점이 없으면 null */
export function measureGirth(root: THREE.Object3D): number[] | null {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert(),
    m = new THREE.Matrix4(),
    points: THREE.Vector3[] = [];
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const position = (o.geometry as THREE.BufferGeometry).attributes.position,
      share = position.count / SAMPLES,
      stride = Math.ceil(share),
      every = Math.max(1, stride);
    m.multiplyMatrices(toRoot, o.matrixWorld);
    for (let i = 0; i < position.count; i += every) {
      const point = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(m);
      points.push(point);
    }
  });
  if (!points.length) return null;
  const box = new THREE.Box3().setFromPoints(points),
    tall = box.max.y - box.min.y,
    cx = (box.min.x + box.max.x) / 2,
    cz = (box.min.z + box.max.z) / 2;
  if (!(tall > 0)) return null;
  const bands: number[][] = Array.from({ length: GIRTH_BANDS }, () => []);
  for (const p of points) {
    const share = ((p.y - box.min.y) / tall) * GIRTH_BANDS,
      band = Math.floor(share),
      last = GIRTH_BANDS - 1,
      at = Math.min(last, band),
      dx = p.x - cx,
      dz = p.z - cz,
      far = Math.hypot(dx, dz) / tall;
    bands[at].push(far);
  }
  return bands.map((list) => {
    if (!list.length) return 0;
    list.sort((a, b) => a - b);
    const share = list.length * GIRTH_SHARE,
      pick = Math.floor(share),
      last = list.length - 1,
      at = Math.min(last, pick),
      scaled = list[at] * 1e4;
    return Math.round(scaled) / 1e4;
  });
}
