import * as THREE from "three";

import type { Rig, SkinPoint } from "./rigBody";

// 손에 든 것은 손뼈가 아니라 보이는 손의 살을 따라간다. 자동 뼈대가 손 살을 손뼈 아닌 뼈에 묶어 두어서(오른손은 머리 앞 뼈
// headfront 에 거의 다, 왼손은 여러 뼈에 나눠서), 손뼈에 끼우면 팔을 크게 움직일 때(솟구치기·떨어지기·날기) 보이는 손에서 떨어진다.
// 쥔 자리 살이 거의 한 뼈에 묶였으면 그 뼈에 끼우고, 나눠 묶였으면 살(점) 몇 개를 매 프레임 따라간다 — 이때 방향은 몸에 대해
// 그대로 둔다(가방은 늘 몸 아래쪽으로 늘어진다)

/** 손에 든 것이 따라가는 손 살(점) 수 */
const PALM_POINTS = 12;
/** 손 살로 치지 않는 점: 몸통·다리 뼈에 가장 많이 묶인 점(팔을 내리면 손이 허리께라 둘레에 치마·엉덩이 살이 섞인다) */
const BODY_BONE = /Hips|Spine|UpLeg|Leg|Foot|Toe/;

const pv = new THREE.Vector3();

/** 지금 자세에서 점들의 가운데(몸 모델 기준)를 out 에 담는다 */
export function palmCenter(rig: Rig, points: readonly SkinPoint[], out: THREE.Vector3) {
  out.set(0, 0, 0);
  for (const mesh of rig.skins) mesh.skeleton.update();
  for (const p of points) {
    const at = skinAt(rig.av, p);
    out.add(at);
  }
  return out.divideScalar(points.length);
}

/** 손 살을 따라가는 것을 이번 프레임 자세의 그 살 자리로 옮긴다(몸짓을 다 잡은 뒤 부른다) */
export function followHand(rig: Rig) {
  const held = rig.held;
  if (!held) return;
  rig.av.updateMatrixWorld(true);
  palmCenter(rig, held.points, held.G.position).add(held.offset);
}

/** 지금 자세에서 쥔 자리(몸 모델 기준)에 가장 가까운 손 살(점)들 */
export function palmPointsNear(rig: Rig, point: THREE.Vector3): SkinPoint[] {
  const near: { d: number; p: SkinPoint }[] = [];
  for (const mesh of rig.skins) {
    mesh.skeleton.update();
    const count = mesh.geometry.attributes.position.count;
    for (let i = 0; i < count; i++) {
      const p = { mesh, i };
      if (isBodySkin(p)) continue;
      const d = skinAt(rig.av, p).distanceToSquared(point);
      near.push({ d, p });
    }
  }
  near.sort((a, b) => a.d - b.d);
  return near.slice(0, PALM_POINTS).map(({ p }) => p);
}

/** 점들이 가장 많이 묶인 뼈와 그 몫(0..1) */
export function mainBoneOf(points: readonly SkinPoint[]): {
  main: THREE.Bone | null;
  share: number;
} {
  const sum = new Map<THREE.Bone, number>();
  for (const { mesh, i } of points)
    for (const [b, w] of skinPairs(mesh, i)) {
      const bone = mesh.skeleton.bones[b],
        total = (sum.get(bone) ?? 0) + w;
      sum.set(bone, total);
    }
  let main: THREE.Bone | null = null,
    most = 0;
  for (const [bone, w] of sum)
    if (w > most) {
      main = bone;
      most = w;
    }
  const share = points.length ? most / points.length : 0;
  return { main, share };
}

/* ─── 내부 ─────────────────────────── */

// 지금 자세에서 점 하나의 자리(몸 모델 기준). 뼈 행렬(skeleton.update)은 부르는 쪽이 먼저 맞춘다.
// 돌려주는 벡터는 다음 부름에 덮인다
function skinAt(av: THREE.Group, { mesh, i }: SkinPoint) {
  mesh.getVertexPosition(i, pv);
  pv.applyMatrix4(mesh.matrixWorld);
  return av.worldToLocal(pv);
}

// 이 점이 가장 많이 묶인 뼈가 몸통·다리인가
function isBodySkin(p: SkinPoint): boolean {
  const bone = topBone(p);
  return BODY_BONE.test(bone.name);
}

// 이 점이 가장 많이 묶인 뼈
function topBone({ mesh, i }: SkinPoint): THREE.Bone {
  const pairs = skinPairs(mesh, i);
  let top = pairs[0];
  for (const pair of pairs) if (pair[1] > top[1]) top = pair;
  return mesh.skeleton.bones[top[0]];
}

// 점 하나의 [뼈 차례, 무게] 넷
function skinPairs(mesh: THREE.SkinnedMesh, i: number): [number, number][] {
  const index = mesh.geometry.attributes.skinIndex,
    w = mesh.geometry.attributes.skinWeight;
  return [
    [index.getX(i), w.getX(i)],
    [index.getY(i), w.getY(i)],
    [index.getZ(i), w.getZ(i)],
    [index.getW(i), w.getW(i)],
  ];
}
