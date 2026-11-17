import * as THREE from "three";

// 팔이 팔뼈를 따르지 않던 까닭: 자동으로 입힌 뼈대가 팔뼈(어깨·팔·손)를 몸 앞뒤(가운데 축)에 놓았다 — 몸은 앞이 +x, 팔이 ±z 인데
// 뼈대는 그 반대로 본 것이다. 그래서 보이는 팔과 손의 살은 가까운 다른 뼈(한쪽 팔은 머리 앞 뼈, 다른 쪽은 등뼈·다리뼈)에 묶여 있어서,
// 고개를 끄덕이면 팔이 같이 흔들리고 팔뼈를 돌려도 팔은 올라가지 않는다.
// 받자마자 한 번, 진짜 어깨 자리에 뼈를 하나씩 새로 놓고 팔과 손의 살을 거기에 묶는다(몸통 쪽은 조금씩 섞어 옷이 찢어져 보이지 않게).
// 높이·폭은 처음 선 자세(바인드)의 몸 모델 기준이다(키 1.2 — 팔을 옆으로 비스듬히 내린 자세)

/** 팔을 드는 뼈 둘: 팔이 +z 쪽인 것과 -z 쪽인 것 */
export interface ReachBones {
  plus: THREE.Bone;
  minus: THREE.Bone;
}

/** 새 뼈가 매달릴 뼈(등 위쪽) */
const SPINE = "Spine02";
/** 어깨 자리: 높이·가운데에서 옆으로(m) */
const SHOULDER_Y = 0.74,
  SHOULDER_Z = 0.17;
/**
 * 팔의 살: 옆으로 ARM_FROM 넘게 나간 점(치마 자락은 0.21 안이다) — 높이 ARM_LOW~ARM_HIGH(그 위는 머리).
 * 치마보다 위(BLEND_LOW 넘게)에서는 BLEND_FROM 부터 조금씩 섞는다(어깨가 몸통에서 부드럽게 이어지게)
 */
const ARM_FROM = 0.22,
  BLEND_FROM = 0.16,
  ARM_LOW = 0.44,
  ARM_HIGH = 0.84,
  BLEND_LOW = 0.56;
/** 몸 메시만 본다: 키 ÷ 팔을 편 폭이 이 사이(부품·머리카락 같은 다른 메시는 뺀다) */
const BODY_RATIO = [1.1, 1.7] as const;

/**
 * 몸 모델의 어깨에 팔을 드는 뼈를 놓고 팔·손의 살을 거기에 묶는다(받은 모델을 제자리에서 고친다 — 아바타를 받자마자 한 번,
 * 처음 선 자세일 때). 등뼈가 없거나 몸 메시가 아니면 null
 */
export function addReachBones(root: THREE.Object3D): ReachBones | null {
  root.updateMatrixWorld(true);
  let bones: ReachBones | null = null;
  root.traverse((c) => {
    if (bones === null && c instanceof THREE.SkinnedMesh) bones = fixMesh(c);
  });
  return bones;
}

/** 팔에 묶는 몫(0 몸통 … 1 팔): 처음 선 자세의 높이 y 와 가운데에서 옆으로 나간 거리 side(m) */
export function armShare(y: number, side: number): number {
  if (y <= ARM_LOW || y >= ARM_HIGH) return 0;
  if (side >= ARM_FROM) return 1;
  if (y <= BLEND_LOW || side <= BLEND_FROM) return 0;
  const u = (side - BLEND_FROM) / (ARM_FROM - BLEND_FROM);
  return u * u * (3 - 2 * u);
}

/* ─── 내부 ─────────────────────────── */

function fixMesh(mesh: THREE.SkinnedMesh): ReachBones | null {
  const g = mesh.geometry,
    ps = g.attributes.position,
    si = g.attributes.skinIndex,
    sw = g.attributes.skinWeight;
  if (!si || !sw) return null;
  g.computeBoundingBox();
  const bb = g.boundingBox!,
    tall = bb.max.y - bb.min.y,
    span = bb.max.z - bb.min.z,
    ratio = tall / span;
  if (!(ratio > BODY_RATIO[0] && ratio < BODY_RATIO[1])) return null;
  const old = mesh.skeleton,
    spineAt = old.bones.findIndex((b) => b.name === SPINE);
  if (spineAt < 0) return null;
  const spine = old.bones[spineAt],
    plus = shoulderBone(spine, "ReachPlus", SHOULDER_Z),
    minus = shoulderBone(spine, "ReachMinus", -SHOULDER_Z);
  spine.updateMatrixWorld(true);
  const plusInverse = plus.matrixWorld.clone().invert(),
    minusInverse = minus.matrixWorld.clone().invert(),
    plusAt = old.bones.length,
    minusAt = plusAt + 1;
  const skeleton = new THREE.Skeleton(
    [...old.bones, plus, minus],
    [...old.boneInverses, plusInverse, minusInverse],
  );
  mesh.bind(skeleton, mesh.bindMatrix);
  for (let i = 0; i < ps.count; i++) {
    const y = ps.getY(i),
      z = ps.getZ(i),
      side = Math.abs(z),
      share = armShare(y, side);
    if (share <= 0) continue;
    const arm = z > 0 ? plusAt : minusAt,
      rest = 1 - share;
    si.setXYZW(i, arm, spineAt, 0, 0);
    sw.setXYZW(i, share, rest, 0, 0);
  }
  si.needsUpdate = true;
  sw.needsUpdate = true;
  return { plus, minus };
}

// 어깨 자리(세계 기준 — 받은 그대로의 처음 선 자세)에 뼈를 놓는다. 돌림은 세계 축에 맞춘다(뼈를 돌리는 쪽이 모델 축으로 셈한다)
function shoulderBone(spine: THREE.Bone, name: string, z: number): THREE.Bone {
  const bone = new THREE.Bone();
  bone.name = name;
  spine.add(bone);
  const at = new THREE.Vector3(0, SHOULDER_Y, z),
    upright = new THREE.Quaternion();
  spine.getWorldQuaternion(upright);
  const local = spine.worldToLocal(at),
    level = upright.invert();
  bone.position.copy(local);
  bone.quaternion.copy(level);
  return bone;
}
