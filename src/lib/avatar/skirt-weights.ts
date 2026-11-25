import * as THREE from "three";

// 치마가 한쪽만 들리던 까닭: 자동으로 입힌 뼈대가 치마 자락 일부를 팔·손 뼈에 묶어 놓았다. 팔을 내리면 치마가 따라 들린다.
// 허리 아래이고 몸통 가까이 있는 점은 팔에 묶일 까닭이 없으니, 그 몫을 그 점의 다른 뼈(없으면 골반 쪽 다리뼈)로 넘긴다.
// 높이·폭은 처음 선 자세(바인드)의 몸 모델 기준 비율이다

/** 몸 높이 비율로 이보다 아래가 치마·다리 */
const WAIST = 0.56;
/** 허리께에서는 이 폭에 걸쳐 조금씩만 넘긴다(옷이 찢어져 보이지 않게) */
const BLEND = 0.13;
/** 몸통 가운데에서 옆으로 (팔을 편 폭 × 이 비율) 안의 점만 — 편 손은 건드리지 않는다 */
const TORSO = 0.3;
/** 몸 메시만 본다: 키 ÷ 팔을 편 폭이 이 사이(부품·머리카락 같은 다른 메시는 뺀다) */
const BODY_RATIO = [1.1, 1.7] as const;
const ARM_BONE = /Shoulder|Arm|Hand/;
/** 다른 뼈가 하나도 없는 점이 넘겨받을 뼈 */
const FALLBACK_BONE = "RightUpLeg";

/** 몸 모델의 치마 자락을 팔 뼈에서 떼어 낸다(받은 모델을 제자리에서 고친다 — 아바타를 받자마자 한 번) */
export function unbindSkirtFromArms(root: THREE.Object3D) {
  root.traverse((c) => {
    if (c instanceof THREE.SkinnedMesh) fixMesh(c);
  });
}

/* ─── 내부 ─────────────────────────── */

type SkinAttribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;

function fixMesh(mesh: THREE.SkinnedMesh) {
  const g = mesh.geometry,
    ps = g.attributes.position,
    si = g.attributes.skinIndex,
    sw = g.attributes.skinWeight;
  if (!si || !sw) return;
  g.computeBoundingBox();
  const bb = g.boundingBox!,
    hy = bb.max.y - bb.min.y,
    hz = bb.max.z - bb.min.z,
    cz = (bb.max.z + bb.min.z) / 2,
    ratio = hy / hz;
  if (!(ratio > BODY_RATIO[0] && ratio < BODY_RATIO[1])) return;
  const bones = mesh.skeleton.bones,
    isArm = bones.map((b) => ARM_BONE.test(b.name)),
    fallbackAt = bones.findIndex((b) => b.name === FALLBACK_BONE),
    fallback = Math.max(0, fallbackAt);
  for (let i = 0; i < ps.count; i++) {
    const yn = (ps.getY(i) - bb.min.y) / hy,
      fromMiddle = ps.getZ(i) - cz,
      side = Math.abs(fromMiddle) / hz;
    if (yn > WAIST || side > TORSO) continue;
    const ramp = (WAIST - yn) / BLEND;
    let fr = Math.min(1, ramp);
    // 팔 뼈 몫(aw)과 그중 가장 작은 칸(lo), 팔이 아닌 뼈 가운데 가장 큰 칸(best)
    let aw = 0,
      best = -1,
      bw = 0,
      lo = -1,
      lw = 9;
    for (let k = 0; k < 4; k++) {
      const w = get(sw, i, k),
        bone = get(si, i, k);
      if (isArm[bone]) {
        aw += w;
        if (w < lw) {
          lw = w;
          lo = k;
        }
      } else if (w > bw) {
        bw = w;
        best = k;
      }
    }
    if (aw <= 0) continue;
    if (best < 0) {
      // 팔 뼈뿐인 점: 가장 작은 팔 칸을 넘겨받을 뼈로 바꾸고 나머지 팔 칸은 그만큼 줄인다(팔 칸이 하나뿐이면 통째로 넘긴다)
      if (aw - lw < 1e-4) fr = 1;
      const keep = fr >= 1 ? 0 : ((1 - fr) * aw) / (aw - lw);
      for (let k = 0; k < 4; k++) {
        if (k === lo) continue;
        const w = get(sw, i, k) * keep;
        set(sw, i, k, w);
      }
      const moved = aw * fr;
      set(si, i, lo, fallback);
      set(sw, i, lo, moved);
    } else {
      for (let k = 0; k < 4; k++) {
        const bone = get(si, i, k);
        if (!isArm[bone]) continue;
        const w = get(sw, i, k) * (1 - fr);
        set(sw, i, k, w);
      }
      const total = bw + aw * fr,
        gained = Math.min(1, total);
      set(sw, i, best, gained);
    }
  }
  si.needsUpdate = true;
  sw.needsUpdate = true;
}

function get(a: SkinAttribute, i: number, k: number): number {
  if (k === 0) return a.getX(i);
  if (k === 1) return a.getY(i);
  if (k === 2) return a.getZ(i);
  return a.getW(i);
}

function set(a: SkinAttribute, i: number, k: number, v: number) {
  if (k === 0) a.setX(i, v);
  else if (k === 1) a.setY(i, v);
  else if (k === 2) a.setZ(i, v);
  else a.setW(i, v);
}
