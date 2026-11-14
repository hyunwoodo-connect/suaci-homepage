import * as THREE from "three";

import { ease } from "../core/frame";
import type { Services } from "../services";
import { clamp } from "../world/sphere";
import { AVATAR_BODY, DEFAULT_WEAR, PARTS } from "./parts";

// 뼈대가 있는 아바타: 몸짓은 뼈를 코드로 직접 돌려서 만든다. 이 아이는 걷지 않는다. 늘 떠 있다:
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

/**
 * 뼈대 있는 몸이 오면 도형 몸을 숨기고 끼운 뒤, 부품을 차례로 입힌다. 몸짓 함수는 onReady 로 넘긴다.
 * 재질은 모델을 받을 때 키마다 한 번 칠해 두었다(아바타 몸·부품에는 색조가 없어 그 칠 그대로 쓴다)
 */
export function setupRig(s: Services, slots: RigSlots, onReady: (pose: PoseFn) => void) {
  const models = s.models;
  if (!models.has(AVATAR_BODY)) return;
  models.when(AVATAR_BODY, (av) => {
    const tiltG = slots.tiltG,
      B: Record<string, THREE.Bone> = {};
    av.traverse((c) => {
      if (c instanceof THREE.Bone) B[c.name] = c;
      if (c instanceof THREE.Mesh) c.frustumCulled = false;
    });
    av.updateMatrixWorld(true);
    // 머리 크기: 머리뼈보다 위에 있는 점들만 잰다(자동 뼈대가 손끝을 머리에 묶어 둔 곳이 있어서 뼈 이름으로는 못 잰다). 세계에 놓기 전, 모델 기준일 때 재야 한다
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
    // 얼굴이 x 축 어느 쪽을 보는지(faceDir), 왼팔이 z 축 어느 쪽에 있는지(leftDir)를 재서 몸짓의 부호를 맞춘다
    const headFront = new THREE.Vector3();
    B.headfront.getWorldPosition(headFront);
    const head = new THREE.Vector3();
    B.Head.getWorldPosition(head);
    const faceDir = headFront.x - head.x > 0 ? 1 : -1;
    const leftArm = new THREE.Vector3();
    B.LeftArm.getWorldPosition(leftArm);
    const leftArmZ = leftArm.z - head.z,
      leftDir = Math.sign(leftArmZ) || 1;
    const R0: Record<string, Rest> = {};
    for (const k in B) {
      const w = new THREE.Quaternion();
      B[k].getWorldQuaternion(w);
      R0[k] = { q: B[k].quaternion.clone(), w, wi: w.clone().invert() };
    }
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
    const st = { f: 0, r: 0, b: 0 },
      Q = new THREE.Quaternion(),
      D = new THREE.Quaternion(),
      D2 = new THREE.Quaternion(),
      D3 = new THREE.Quaternion(),
      AX = new THREE.Vector3(1, 0, 0),
      AY = new THREE.Vector3(0, 1, 0),
      AZ = new THREE.Vector3(0, 0, 1);
    // 뼈 하나를 모델 기준으로 돌린다: sw = 앞뒤(아래로 뻗은 팔다리는 +가 앞, 위로 선 몸통·머리는 +가 뒤로 젖힘), lo = 옆으로 기울이기·팔 내리기, tw = 위에서 본 돌리기
    const pose = (name: string, sw: number, lo: number, tw?: number) => {
      const b = B[name],
        r = R0[name];
      if (!b) return;
      const swing = sw * faceDir;
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
    };
    // st.f = 나아가는 정도, st.r = 솟음(+)·떨어짐(-), st.b = 옆으로 끄는 기울기. 모두 천천히 따라간다
    onReady(({ dt, tot, vy, air, fx, time: t }) => {
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
      pose("Hips", hipsSwing, hipsSide, hipsTwist);
      const spineSwing = 0.16 * glide + 0.03 * sway;
      pose("Spine01", spineSwing, 0);
      const neckSwing = 0.3 * glide + 0.15 * rise - 0.1 * fall;
      pose("neck", neckSwing, 0);
      const headSwing = 0.42 * glide + 0.2 * rise - 0.15 * fall + 0.04 * swayLate * idle,
        headSide = -faceDir * 0.12 * st.b;
      pose("Head", headSwing, headSide);
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
      pose("LeftUpLeg", leftThigh, leftThighSide);
      pose("RightUpLeg", rightThigh, rightThighSide);
      const leftKnee =
          -0.5 * idle - 0.15 * idle * sway - 0.12 * glide - 0.18 * glide * kick - 1.0 * fall,
        rightKnee =
          -0.5 * idle + 0.15 * idle * sway - 0.12 * glide + 0.18 * glide * kick - 1.0 * fall;
      pose("LeftLeg", leftKnee, 0);
      pose("RightLeg", rightKnee, 0);
      const toePoint = 0.5 * (glide + rise); // 발끝을 편다
      pose("LeftFoot", toePoint, 0);
      pose("RightFoot", toePoint, 0);
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
      pose("LeftArm", leftArmSwing, leftArmSide, leftArmTwist);
      pose("RightArm", rightArmSwing, rightArmSide, rightArmTwist);
      const elbowBend = 0.3 * idle,
        leftElbowSide = 0.15 * idle * leftDir,
        rightElbowSide = -0.15 * idle * leftDir;
      pose("LeftForeArm", elbowBend, leftElbowSide, 0);
      pose("RightForeArm", elbowBend, rightElbowSide, 0);
    });
    // 꾸미기: 칸(slot)마다 하나씩, 같은 칸에 새로 끼우면 바뀐다
    const hs = new THREE.Vector3(),
      hc = new THREE.Vector3();
    hb.getSize(hs);
    hb.getCenter(hc);
    const worn: Record<string, THREE.Group | null> = {};
    const wear = (key: string, then: () => void) => {
      const d = PARTS[key];
      if (!d) return then();
      if (worn[d.slot]) {
        worn[d.slot]!.removeFromParent();
        worn[d.slot] = null;
      }
      if (!models.has(key)) return then(); // 없는 이름을 주면 그 칸을 비운다
      models.when(key, (root) => {
        const m = root.clone(true),
          bb = new THREE.Box3().setFromObject(m),
          bs = new THREE.Vector3(),
          bc = new THREE.Vector3();
        bb.getSize(bs);
        bb.getCenter(bc);
        const G = new THREE.Group(),
          s2 = (hs.z * d.w) / bs.z;
        m.traverse((c) => {
          if (c instanceof THREE.Mesh) c.frustumCulled = false;
        });
        m.position.copy(bc).negate();
        G.add(m);
        G.scale.setScalar(s2);
        G.rotation.y = faceDir > 0 ? 0 : Math.PI; // 뽑아 온 부품은 앞이 +x를 본다. 그 앞을 얼굴 쪽으로
        if (d.slot === "hair") {
          const partX = hc.x + faceDir * (d.f || 0) * hs.x,
            partY = hb.max.y + d.top! * hs.y - (bs.y * s2) / 2;
          G.position.set(partX, partY, hc.z);
        } else {
          const partX = hc.x + faceDir * (hs.x / 2 + (d.f || 0) * hs.x - (bs.x * s2) / 2),
            partY = hc.y + (d.y || 0) * hs.y;
          G.position.set(partX, partY, hc.z);
        }
        av.add(G);
        av.updateMatrixWorld(true);
        B.Head.attach(G);
        worn[d.slot] = G;
        then();
      });
    };
    const wearAll = (i: number) => {
      if (i < DEFAULT_WEAR.length) wear(DEFAULT_WEAR[i], () => wearAll(i + 1));
    };
    wearAll(0);
  });
}
