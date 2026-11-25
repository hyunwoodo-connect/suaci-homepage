import * as THREE from "three";

import type { PartFit, PartSlot } from "./parts";
import { PARTS } from "./parts";
import type { Rig } from "./rig-body";
import { mainBoneOf, palmCenter, palmPointsNear } from "./rig-hand";
import { poseBone } from "./rig-pose";

// 꾸미기: 칸(slot)마다 하나씩, 같은 칸에 새로 끼우면 바뀐다. 뼈에 끼울 때는 처음 선 자세(바인드) 기준으로 자리를 계산해서,
// 움직이는 도중에 갈아 끼워도 어긋나지 않는다

/** 몸과 부품 모델을 내주는 곳(놀이의 모델 창구가 이 모양을 맞춘다) */
export interface ModelSource {
  /** 이번 에셋 판에 그 모델이 있나 */
  has(key: string): boolean;
  /** 아직 안 받았으면 받아 달라고 한다 */
  need(key: string): void;
  /** 모델이 오면(이미 왔으면 바로) cb */
  when(key: string, cb: (root: THREE.Group) => void): void;
}

/** 손에 든 것: 손뼈 원점은 실제 손보다 몸 안쪽에 있어, 팔 방향으로 (처음 자세의 손끝까지 남은 길이 × 이 비율)만큼 더 나간 자리가 손이다 */
const HAND_REACH = 0.45;
/** 쥔 자리 살의 이만큼이 한 뼈에 묶였으면 그 뼈에 끼운다(살과 함께 돌아서 정확하다). 아니면 살(점)을 매 프레임 따라간다 */
const RIGID_SHARE = 0.85;

/** 칸의 자리에 놓을 부품 하나: 가운데를 맞춘 모델(m)·그 상자 크기(bs)·얼굴 쪽 돌림(yaw)·담을 틀(G) */
interface Piece {
  m: THREE.Group;
  bs: THREE.Vector3;
  yaw: number;
  G: THREE.Group;
}

/** 그 칸을 비운다(고른 차례를 넘겨서, 오는 중인 모델이 나중에 끼워지지 않게) */
export function stripSlot(rig: Rig, slot: PartSlot) {
  rig.picks[slot] += 1;
  if (slot === "hand") rig.held = null;
  rig.worn[slot]?.removeFromParent();
  delete rig.worn[slot];
}

/** 부품을 끼운다(같은 칸의 것은 빠진다). 모델이 오는 사이 같은 칸에 다른 것을 고르면 늦게 온 것은 버린다 */
export function wearPart(rig: Rig, models: ModelSource, key: string) {
  const d = PARTS[key];
  if (!d) return;
  stripSlot(rig, d.slot);
  const mine = rig.picks[d.slot];
  if (!models.has(key)) return;
  models.need(key);
  models.when(key, (root) => {
    if (rig.picks[d.slot] !== mine) return;
    const G = place(rig, d, root);
    if (G) rig.worn[d.slot] = G;
  });
}

/* ─── 내부 ─────────────────────────── */

// 부품 모델 하나를 칸의 자리에 놓는다(자리는 몸 모델 기준 — 몸 키 1.2). 놓지 못하면 null
function place(rig: Rig, d: PartFit, root: THREE.Group): THREE.Group | null {
  const m = root.clone(true),
    bb = new THREE.Box3().setFromObject(m),
    bs = new THREE.Vector3(),
    bc = new THREE.Vector3();
  bb.getSize(bs);
  bb.getCenter(bc);
  m.traverse((c) => {
    if (c instanceof THREE.Mesh) c.frustumCulled = false;
  });
  m.position.copy(bc).negate();
  const yaw = rig.faceDir > 0 ? 0 : Math.PI; // 뽑아 온 부품은 앞이 +x를 본다. 그 앞을 얼굴 쪽으로
  const G = new THREE.Group();
  const piece: Piece = { m, bs, yaw, G };
  if (d.slot === "hair" || d.slot === "face") return placeOnHead(rig, d, piece);
  if (d.slot === "ear") return placeEars(rig, d, piece);
  if (d.slot === "hand") return placeInHand(rig, d, piece);
  return placeBoard(rig, d, piece);
}

// 머리·얼굴: 머리 상자에 맞춰 키우고 머리뼈에 끼운다
function placeOnHead(
  rig: Rig,
  d: Extract<PartFit, { slot: "hair" | "face" }>,
  { m, bs, yaw, G }: Piece,
): THREE.Group {
  const { hs, hc, hb, faceDir, B } = rig;
  const k = (hs.z * d.w) / bs.z,
    half = (bs.y * k) / 2;
  G.add(m);
  G.scale.setScalar(k);
  G.rotation.y = yaw;
  if (d.slot === "hair") {
    const partX = hc.x + faceDir * (d.f ?? 0) * hs.x,
      partY = hb.max.y + d.top * hs.y - half;
    G.position.set(partX, partY, hc.z);
  } else {
    const partX = hc.x + faceDir * (hs.x / 2 + d.f * hs.x - (bs.x * k) / 2),
      partY = hc.y + d.y * hs.y;
    G.position.set(partX, partY, hc.z);
  }
  toBind(rig);
  attachTo(rig.av, B.Head, G);
  return G;
}

// 귀: 좌우 한 쌍을 머리 양옆에 놓고 머리뼈에 끼운다
function placeEars(
  rig: Rig,
  d: Extract<PartFit, { slot: "ear" }>,
  { m, bs, yaw, G }: Piece,
): THREE.Group {
  const { hs, hc, B } = rig;
  const k = (hs.y * d.h) / bs.y;
  for (const side of [-1, 1]) {
    const E = new THREE.Group();
    const piece = side < 0 ? m : m.clone();
    E.add(piece);
    E.scale.setScalar(k);
    E.rotation.y = yaw;
    const earY = hc.y + d.y * hs.y - (bs.y * k) / 2,
      earZ = hc.z + side * (hs.z / 2 + bs.z * k * 0.3);
    E.position.set(hc.x, earY, earZ);
    G.add(E);
  }
  toBind(rig);
  attachTo(rig.av, B.Head, G);
  return G;
}

// 손에 든 것: 팔을 내린 자세의 손에 놓고, 쥔 자리 살이 한 뼈에 묶였으면 그 뼈에, 아니면 살을 따라가게 둔다
function placeInHand(
  rig: Rig,
  d: Extract<PartFit, { slot: "hand" }>,
  { m, bs, yaw, G }: Piece,
): THREE.Group | null {
  const { av, B, ct, sz, faceDir } = rig;
  const bone = B[d.bone],
    fore = B[d.bone.replace("Hand", "ForeArm")];
  if (!bone) return null;
  const k = d.size / Math.max(bs.x, bs.y, bs.z);
  toBind(rig);
  // 처음 자세(팔을 옆으로 뻗음)에서 손뼈부터 몸 옆 끝(손끝)까지
  const handAtBind = local(av, bone),
    fromMiddle = handAtBind.z - ct.z,
    handOut = Math.abs(fromMiddle),
    tip = sz.z / 2 - handOut - 0.04,
    reach = Math.max(0, tip) * HAND_REACH;
  toIdle(rig);
  const hp = local(av, bone);
  if (fore) {
    const elbow = local(av, fore),
      along = hp.clone().sub(elbow).normalize();
    hp.addScaledVector(along, reach);
  }
  G.add(m);
  G.scale.setScalar(k);
  // 드는 것(부케)은 손목에서 앞으로 기울이고, 늘어뜨리는 것(가방)은 손 아래로 곧게
  const tilt = d.hang ? 0 : -faceDir * 0.45;
  G.rotation.set(0, yaw, tilt);
  const handX = hp.x + faceDir * (d.hang ? 0.02 : 0.09),
    handY = hp.y + (d.hang ? -bs.y * k * 0.52 : bs.y * k * 0.22),
    handZ = hp.z + Math.sign(hp.z) * (d.hang ? 0.08 : 0.03);
  G.position.set(handX, handY, handZ);
  // 쥔 자리: 드는 것은 놓은 가운데(손에 쥔 듯 보이게 맞춘 자리), 늘어뜨리는 것은 끈 꼭대기
  const gripY = d.hang ? hp.y : handY,
    grip = new THREE.Vector3(handX, gripY, handZ),
    points = palmPointsNear(rig, grip);
  const { main, share } = mainBoneOf(points);
  if (points.length === 0 || share >= RIGID_SHARE) {
    attachTo(av, main ?? bone, G);
    return G;
  }
  av.add(G);
  const center = new THREE.Vector3();
  palmCenter(rig, points, center);
  const offset = G.position.clone().sub(center);
  rig.held = { G, points, offset };
  return G;
}

// 보드: 처음 자세의 발밑(몸 모델 원점)에 긴 변을 앞뒤로 놓고 엉덩이뼈에 끼운다 — 몸을 눕혀 날 때도 발 쪽을 따라간다
function placeBoard(
  rig: Rig,
  d: Extract<PartFit, { slot: "board" }>,
  { m, bs, G }: Piece,
): THREE.Group {
  const k = d.len / Math.max(bs.x, bs.z);
  G.add(m);
  G.scale.setScalar(k);
  G.rotation.y = bs.z > bs.x ? Math.PI / 2 : 0;
  const boardY = (-bs.y * k) / 2 - 0.015;
  G.position.set(0, boardY, 0);
  toBind(rig);
  attachTo(rig.av, rig.B.Hips, G);
  return G;
}

// 끼우는 순간만 처음 자세로 되돌린다(다음 프레임에 몸짓이 자세를 다시 잡는다)
function toBind(rig: Rig) {
  for (const [bone, p, q, sc] of rig.bind) {
    bone.position.copy(p);
    bone.quaternion.copy(q);
    bone.scale.copy(sc);
  }
  rig.av.updateMatrixWorld(true);
}

// 손에 드는 것은 팔을 내리고 선 자세 기준으로 끼운다. 처음 자세는 팔을 옆으로 뻗고 있어서, 거기 맞추면 팔을 내릴 때 물건이 눕는다
function toIdle(rig: Rig) {
  toBind(rig);
  const leftDir = rig.leftDir;
  const leftArmDown = 0.8 * leftDir,
    rightArmDown = -0.8 * leftDir,
    leftElbowIn = 0.15 * leftDir,
    rightElbowIn = -0.15 * leftDir;
  poseBone(rig, "LeftArm", 0, leftArmDown, 0);
  poseBone(rig, "RightArm", 0, rightArmDown, 0);
  poseBone(rig, "LeftForeArm", 0.3, leftElbowIn, 0);
  poseBone(rig, "RightForeArm", 0.3, rightElbowIn, 0);
  rig.av.updateMatrixWorld(true);
}

// 몸 안에 넣었다가 뼈로 옮겨 붙인다(세계 자리를 그대로 두고 뼈를 따라가게)
function attachTo(av: THREE.Group, bone: THREE.Bone, G: THREE.Group) {
  av.add(G);
  G.updateMatrixWorld(true);
  bone.attach(G);
}

// 한 물체의 세계 자리를 몸 모델 기준으로
function local(av: THREE.Group, o: THREE.Object3D) {
  const w = new THREE.Vector3();
  o.getWorldPosition(w);
  return av.worldToLocal(w);
}
