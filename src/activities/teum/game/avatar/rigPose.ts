import * as THREE from "three";

import { ease } from "../core/frame";
import { clamp } from "../world/sphere";
import type { Rig } from "./rigBody";
import { followHand } from "./rigHand";

// 몸짓은 뼈를 코드로 직접 돌려서 만든다. 이 아이는 걷지 않는다. 늘 떠 있다:
// 멈추면 물속처럼 둥실, 나아가면 몸을 눕혀 팔을 날개처럼 펴고, 솟으면 만세, 떨어지면 허우적

/** 이번 프레임 몸짓에 쓰는 값: 빠르기 배수(tot)·위아래 속도·솟은 높이·옆으로 끄는 정도(fx)·시각 */
export interface PoseInput {
  dt: number;
  tot: number;
  vy: number;
  air: number;
  fx: number;
  time: number;
}

/** 한 프레임 몸짓 */
export type PoseFn = (i: PoseInput) => void;

const Q = new THREE.Quaternion(),
  D = new THREE.Quaternion(),
  D2 = new THREE.Quaternion(),
  D3 = new THREE.Quaternion(),
  AX = new THREE.Vector3(1, 0, 0),
  AY = new THREE.Vector3(0, 1, 0),
  AZ = new THREE.Vector3(0, 0, 1);

/**
 * 뼈 하나를 모델 기준으로 돌린다: sw = 앞뒤(아래로 뻗은 팔다리는 +가 앞, 위로 선 몸통·머리는 +가 뒤로 젖힘),
 * lo = 옆으로 기울이기·팔 내리기, tw = 위에서 본 돌리기
 */
export function poseBone(rig: Rig, name: string, sw: number, lo: number, tw?: number) {
  const b = rig.B[name],
    r = rig.R0[name];
  if (!b) return;
  const swing = sw * rig.faceDir;
  D.setFromAxisAngle(AZ, swing);
  if (tw) {
    D3.setFromAxisAngle(AY, tw);
    D.multiply(D3);
  }
  if (lo) {
    D2.setFromAxisAngle(AX, lo);
    D.multiply(D2);
  }
  Q.copy(r.wi).multiply(D).multiply(r.w);
  b.quaternion.copy(r.q).multiply(Q);
}

/** 한 프레임 몸짓: 나아감·솟음·기울기(rig.st)를 천천히 따라간 뒤 뼈마다 돌리고, 손에 든 것을 손에 맞춘다 */
export function poseFrame(rig: Rig, { dt, tot, vy, air, fx, time: t }: PoseInput) {
  const { st, hold, tiltG, faceDir, leftDir } = rig;
  // st.f = 나아가는 정도, st.r = 솟음(+)·떨어짐(-), st.b = 옆으로 끄는 기울기. 모두 천천히 따라간다
  const forward = tot / 0.85,
    forwardTarget = clamp(forward, 0, 1);
  st.f += (forwardTarget - st.f) * ease(3.5, dt);
  const riseTarget = vy > 2.5 ? 1 : vy < -2 && air > 2 ? -1 : 0;
  st.r += (riseTarget - st.r) * ease(6, dt);
  const bankTarget = fx * Math.min(1, tot);
  st.b = (st.b || 0) + (bankTarget - (st.b || 0)) * ease(4, dt);
  // 몸짓의 무게: 나아감(glide)은 솟거나 떨어지는 동안 줄고, 멈춤(idle)은 나아가지 않는 만큼
  const rise = Math.max(0, st.r),
    fall = Math.max(0, -st.r),
    glide = st.f * (1 - rise) * (1 - fall),
    idle = 1 - st.f;
  const swayPhase = t * 1.7,
    swayLatePhase = t * 1.7 + 1.3,
    kickPhase = t * 6.5,
    flailPhase = t * 11;
  const sway = Math.sin(swayPhase),
    swayLate = Math.sin(swayLatePhase),
    kick = Math.sin(kickPhase),
    flail = Math.sin(flailPhase);
  hold.position.y = 0.06 * sway * idle; // 둥실
  const leanWanted = 1.25 * glide - tiltG.rotation.x,
    lean = clamp(leanWanted, 0, 0.95) * glide; // 화면 기울기와 합쳐서 거의 엎드린 자세까지
  const hipsSwing = -lean + 0.05 * swayLate * idle,
    hipsSide = faceDir * 0.4 * st.b,
    hipsTwist = -faceDir * 0.25 * st.b * 0;
  poseBone(rig, "Hips", hipsSwing, hipsSide, hipsTwist);
  const spineSwing = 0.16 * glide + 0.03 * sway;
  poseBone(rig, "Spine01", spineSwing, 0);
  const neckSwing = 0.3 * glide + 0.15 * rise - 0.1 * fall;
  poseBone(rig, "neck", neckSwing, 0);
  const headSwing = 0.42 * glide + 0.2 * rise - 0.15 * fall + 0.04 * swayLate * idle,
    headSide = -faceDir * 0.12 * st.b;
  poseBone(rig, "Head", headSwing, headSide);
  // 다리: 멈추면 물장구처럼 번갈아 늘어뜨리고, 나아가면 뒤로 모아 살랑, 솟으면 곧게, 떨어지면 무릎을 접는다
  const leftThigh =
      0.22 * idle +
      0.12 * idle * sway -
      0.2 * glide +
      0.2 * glide * kick +
      0.55 * fall +
      0.08 * fall * flail,
    rightThigh =
      0.22 * idle -
      0.12 * idle * sway -
      0.2 * glide -
      0.2 * glide * kick +
      0.55 * fall -
      0.08 * fall * flail,
    leftThighSide = 0.05 * leftDir,
    rightThighSide = -0.05 * leftDir;
  poseBone(rig, "LeftUpLeg", leftThigh, leftThighSide);
  poseBone(rig, "RightUpLeg", rightThigh, rightThighSide);
  const leftKnee =
      -0.5 * idle - 0.15 * idle * sway - 0.12 * glide - 0.18 * glide * kick - 1.0 * fall,
    rightKnee = -0.5 * idle + 0.15 * idle * sway - 0.12 * glide + 0.18 * glide * kick - 1.0 * fall;
  poseBone(rig, "LeftLeg", leftKnee, 0);
  poseBone(rig, "RightLeg", rightKnee, 0);
  const toePoint = 0.5 * (glide + rise); // 발끝을 편다
  poseBone(rig, "LeftFoot", toePoint, 0);
  poseBone(rig, "RightFoot", toePoint, 0);
  // 팔: 멈추면 살짝 벌려 늘어뜨리고 살랑, 나아가면 옆으로 펴서 뒤로 젖힌 날개, 솟으면 위로, 떨어지면 위에서 허우적
  const wobPhase = t * 2.3,
    wobWave = Math.sin(wobPhase);
  const low = 0.8 * idle + 0.07 * idle * swayLate - 0.18 * glide - 1.25 * rise - 0.85 * fall,
    back = 0.55 * glide,
    wob = 0.22 * fall * flail + 0.06 * glide * wobWave;
  const leftArmSwing = 0.12 * idle * sway,
    leftArmSide = (low + wob) * leftDir + 0.3 * st.b * glide,
    leftArmTwist = -faceDir * leftDir * back,
    rightArmSwing = -0.12 * idle * sway,
    rightArmSide = -(low - wob) * leftDir + 0.3 * st.b * glide,
    rightArmTwist = faceDir * leftDir * back;
  poseBone(rig, "LeftArm", leftArmSwing, leftArmSide, leftArmTwist);
  poseBone(rig, "RightArm", rightArmSwing, rightArmSide, rightArmTwist);
  const elbowBend = 0.3 * idle,
    leftElbowSide = 0.15 * idle * leftDir,
    rightElbowSide = -0.15 * idle * leftDir;
  poseBone(rig, "LeftForeArm", elbowBend, leftElbowSide, 0);
  poseBone(rig, "RightForeArm", elbowBend, rightElbowSide, 0);
  followHand(rig);
}
