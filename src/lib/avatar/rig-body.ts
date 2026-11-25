import * as THREE from "three";

import type { PartSlot } from "./parts";
import { unbindSkirtFromArms } from "./skirt-weights";

// 받은 몸을 재서 틀에 넣는다. 잰 값과, 몸짓·손에 든 것·꾸미기가 같이 고치는 값은 모두 Rig 하나에 담는다

/** 아바타를 끼울 자리: 기울기 그룹(tiltG)과 오기 전까지 서 있던 도형 몸 */
export interface RigSlots {
  tiltG: THREE.Group;
  body: THREE.Object3D;
  nose: THREE.Object3D;
}

/** 뼈 하나의 처음 자세(모델 기준 돌림과 세계 돌림) */
interface Rest {
  q: THREE.Quaternion;
  w: THREE.Quaternion;
  wi: THREE.Quaternion;
}

/** 몸 메시의 점 하나 */
export interface SkinPoint {
  mesh: THREE.SkinnedMesh;
  i: number;
}

/** 손 살(점)을 매 프레임 따라가는 손에 든 것: 그 점들의 가운데에서 offset 만큼 떨어진 자리에 둔다 */
interface Held {
  G: THREE.Group;
  points: SkinPoint[];
  offset: THREE.Vector3;
}

/** 처음 선 자세의 뼈 하나: 뼈·자리·돌림·크기 */
type BindBone = [THREE.Bone, THREE.Vector3, THREE.Quaternion, THREE.Vector3];

/** 뼈대 있는 몸 하나: 받을 때 잰 값과, 몸짓(st)·손에 든 것(held)·꾸미기(worn·picks)가 고치는 값 */
export interface Rig {
  av: THREE.Group;
  tiltG: THREE.Group;
  /** 몸과 끼운 부품을 담은 틀 */
  hold: THREE.Group;
  /** 이름 → 뼈 */
  B: Record<string, THREE.Bone>;
  /** 뼈마다 처음 자세의 돌림 */
  R0: Record<string, Rest>;
  /** 얼굴이 보는 x 쪽(faceDir)·왼팔이 있는 z 쪽(leftDir): 몸짓의 부호 */
  faceDir: number;
  leftDir: number;
  /** 틀에 넣기 전(모델 기준) 몸 상자의 크기·가운데 */
  sz: THREE.Vector3;
  ct: THREE.Vector3;
  /** 머리 상자와 그 크기·가운데 */
  hb: THREE.Box3;
  hs: THREE.Vector3;
  hc: THREE.Vector3;
  skins: THREE.SkinnedMesh[];
  /** 처음 선 자세(끼우는 순간만 되돌린다) */
  bind: BindBone[];
  /** 몸짓이 천천히 따라가는 값: 나아가는 정도(f)·솟음(+)과 떨어짐(-)(r)·옆으로 끄는 기울기(b) */
  st: { f: number; r: number; b: number };
  /** 손 살을 따라가는 손에 든 것(한 뼈에 끼웠거나 없으면 null) */
  held: Held | null;
  /** 칸마다 끼운 것 */
  worn: Partial<Record<PartSlot, THREE.Group>>;
  /** 칸마다 고른 차례 — 늦게 도착한 모델이 그 뒤에 고른 것을 덮지 않게 */
  picks: Record<PartSlot, number>;
}

/**
 * 받은 몸을 잰 뒤 틀(hold)에 넣어 기울기 그룹에 끼우고 도형 몸을 숨긴다.
 * 재는 차례가 중요하다: 머리·방향·처음 돌림은 틀에 넣기 전, 모델 기준일 때 잰다
 */
export function measureRig(av: THREE.Group, slots: RigSlots): Rig {
  const tiltG = slots.tiltG,
    B = collectBones(av);
  // 자동 뼈대가 치마 자락 일부를 팔 뼈에 묶어 둬서 팔을 내리면 치마가 한쪽만 들린다 — 받자마자 떼어 낸다
  unbindSkirtFromArms(av);
  av.updateMatrixWorld(true);
  const hb = measureHead(av, B);
  const { faceDir, leftDir } = measureFacing(B);
  const R0 = readRestTurns(B);
  const box = new THREE.Box3().setFromObject(av),
    sz = new THREE.Vector3(),
    ct = new THREE.Vector3();
  box.getSize(sz);
  box.getCenter(ct);
  const hold = new THREE.Group();
  av.position.sub(ct);
  hold.add(av);
  const holdScale = 1.5 / sz.y;
  hold.scale.setScalar(holdScale);
  hold.rotation.y = faceDir > 0 ? -Math.PI / 2 : Math.PI / 2; // 얼굴이 앞(+z)을 보게
  slots.body.visible = false;
  slots.nose.visible = false;
  tiltG.add(hold);
  const skins: THREE.SkinnedMesh[] = [];
  av.traverse((c) => {
    if (c instanceof THREE.SkinnedMesh) skins.push(c);
  });
  const hs = new THREE.Vector3(),
    hc = new THREE.Vector3();
  hb.getSize(hs);
  hb.getCenter(hc);
  const bind = captureBindPose(av);
  return {
    av,
    tiltG,
    hold,
    B,
    R0,
    faceDir,
    leftDir,
    sz,
    ct,
    hb,
    hs,
    hc,
    skins,
    bind,
    st: { f: 0, r: 0, b: 0 },
    held: null,
    worn: {},
    picks: { hair: 0, face: 0, ear: 0, hand: 0, board: 0 },
  };
}

/* ─── 내부 ─────────────────────────── */

// 뼈를 이름으로 모으고, 몸 메시는 화면 밖 판정에서 뺀다
function collectBones(av: THREE.Group): Record<string, THREE.Bone> {
  const B: Record<string, THREE.Bone> = {};
  av.traverse((c) => {
    if (c instanceof THREE.Bone) B[c.name] = c;
    if (c instanceof THREE.Mesh) c.frustumCulled = false;
  });
  return B;
}

// 머리 상자: 머리뼈보다 위에 있는 점들만 잰다(자동 뼈대가 손끝을 머리에 묶어 둔 곳이 있어서 뼈 이름으로는 못 잰다).
// 세계에 놓기 전, 모델 기준일 때 재야 한다
function measureHead(av: THREE.Group, B: Record<string, THREE.Bone>): THREE.Box3 {
  const hb = new THREE.Box3(),
    tv = new THREE.Vector3(),
    headBase = new THREE.Vector3();
  B.Head.getWorldPosition(headBase);
  const hy0 = headBase.y + 0.03;
  av.traverse((c) => {
    if (!(c instanceof THREE.SkinnedMesh)) return;
    c.skeleton.update();
    const ps = c.geometry.attributes.position;
    for (let i = 0; i < ps.count; i++) {
      c.getVertexPosition(i, tv).applyMatrix4(c.matrixWorld);
      if (tv.y > hy0) hb.expandByPoint(tv);
    }
  });
  return hb;
}

// 얼굴이 x 축 어느 쪽을 보는지(faceDir), 왼팔이 z 축 어느 쪽에 있는지(leftDir)를 재서 몸짓의 부호를 맞춘다
function measureFacing(B: Record<string, THREE.Bone>): { faceDir: number; leftDir: number } {
  const headFront = new THREE.Vector3();
  B.headfront.getWorldPosition(headFront);
  const head = new THREE.Vector3();
  B.Head.getWorldPosition(head);
  const faceDir = headFront.x - head.x > 0 ? 1 : -1;
  const leftArm = new THREE.Vector3();
  B.LeftArm.getWorldPosition(leftArm);
  const leftArmZ = leftArm.z - head.z,
    leftDir = Math.sign(leftArmZ) || 1;
  return { faceDir, leftDir };
}

// 뼈마다 처음 자세의 돌림(모델 기준·세계·세계의 역)
function readRestTurns(B: Record<string, THREE.Bone>): Record<string, Rest> {
  const R0: Record<string, Rest> = {};
  for (const k in B) {
    const w = new THREE.Quaternion();
    B[k].getWorldQuaternion(w);
    R0[k] = { q: B[k].quaternion.clone(), w, wi: w.clone().invert() };
  }
  return R0;
}

// 처음 선 자세: 뼈마다 자리·돌림·크기. 뼈대 전체(skeleton.pose)를 되돌리면 뼈대 맨 위의 배율까지 날아가 몸이 사라져서, 뼈마다 되돌린다
function captureBindPose(av: THREE.Group): BindBone[] {
  const rest: BindBone[] = [];
  av.traverse((c) => {
    if (!(c instanceof THREE.Bone)) return;
    const p = c.position.clone(),
      q = c.quaternion.clone(),
      sc = c.scale.clone();
    rest.push([c, p, q, sc]);
  });
  return rest;
}
