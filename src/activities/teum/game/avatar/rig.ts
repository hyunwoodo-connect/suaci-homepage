import * as THREE from "three";

import { ease } from "../core/frame";
import type { Services } from "../services";
import { clamp } from "../world/sphere";
import type { PartFit, PartSlot } from "./parts";
import { AVATAR_BODY, PARTS } from "./parts";
import { unbindSkirtFromArms } from "./skirtWeights";

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

/** 뼈대 있는 몸이 오면 넘기는 것 */
export interface RigHandle {
  pose: PoseFn;
  /** 부품을 끼운다(같은 칸의 것은 빠진다). 모델을 아직 안 받았으면 받아서 끼운다 — 그사이 같은 칸에 다른 것을 고르면 늦게 온 것은 버린다 */
  wear(key: string): void;
  /** 그 칸을 비운다 */
  strip(slot: PartSlot): void;
  /** 몸과 끼운 부품을 담은 틀(꾸미기 씬이 이 틀만 보이게 한다) */
  hold: THREE.Group;
}

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

/** 손에 든 것: 손뼈 원점은 실제 손보다 몸 안쪽에 있어, 팔 방향으로 (처음 자세의 손끝까지 남은 길이 × 이 비율)만큼 더 나간 자리가 손이다 */
const HAND_REACH = 0.45;
/** 손에 든 것이 따라가는 손 살(점) 수 */
const PALM_POINTS = 12;
/** 쥔 자리 살의 이만큼이 한 뼈에 묶였으면 그 뼈에 끼운다(살과 함께 돌아서 정확하다). 아니면 살(점)을 매 프레임 따라간다 */
const RIGID_SHARE = 0.85;
/** 손 살로 치지 않는 점: 몸통·다리 뼈에 가장 많이 묶인 점(팔을 내리면 손이 허리께라 둘레에 치마·엉덩이 살이 섞인다) */
const BODY_BONE = /Hips|Spine|UpLeg|Leg|Foot|Toe/;

/** 몸 메시의 점 하나 */
interface SkinPoint {
  mesh: THREE.SkinnedMesh;
  i: number;
}

/**
 * 뼈대 있는 몸이 오면 도형 몸을 숨기고 끼운 뒤, 몸짓 함수와 부품 끼우기를 onReady 로 넘긴다(무엇을 입을지는 옷장이 정한다).
 * 재질은 모델을 받을 때 키마다 한 번 칠해 두었다(아바타 몸·부품에는 색조가 없어 그 칠 그대로 쓴다)
 */
export function setupRig(s: Services, slots: RigSlots, onReady: (rig: RigHandle) => void) {
  const models = s.models;
  if (!models.has(AVATAR_BODY)) return;
  models.when(AVATAR_BODY, (av) => {
    const tiltG = slots.tiltG,
      B: Record<string, THREE.Bone> = {};
    av.traverse((c) => {
      if (c instanceof THREE.Bone) B[c.name] = c;
      if (c instanceof THREE.Mesh) c.frustumCulled = false;
    });
    // 자동 뼈대가 치마 자락 일부를 팔 뼈에 묶어 둬서 팔을 내리면 치마가 한쪽만 들린다 — 받자마자 떼어 낸다
    unbindSkirtFromArms(av);
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
    // 손에 든 것은 손뼈가 아니라 보이는 손의 살을 따라간다. 자동 뼈대가 손 살을 손뼈 아닌 뼈에 묶어 두어서(오른손은 머리 앞 뼈
    // headfront 에 거의 다, 왼손은 여러 뼈에 나눠서), 손뼈에 끼우면 팔을 크게 움직일 때(솟구치기·떨어지기·날기) 보이는 손에서 떨어진다.
    // 쥔 자리 살이 거의 한 뼈에 묶였으면 그 뼈에 끼우고, 나눠 묶였으면 살(점) 몇 개를 매 프레임 따라간다 — 이때 방향은 몸에 대해
    // 그대로 둔다(가방은 늘 몸 아래쪽으로 늘어진다)
    const skins: THREE.SkinnedMesh[] = [];
    av.traverse((c) => {
      if (c instanceof THREE.SkinnedMesh) skins.push(c);
    });
    const pv = new THREE.Vector3();
    // 지금 자세에서 점 하나의 자리(몸 모델 기준). 뼈 행렬(skeleton.update)은 부르는 쪽이 먼저 맞춘다
    const skinAt = ({ mesh, i }: SkinPoint) => {
      mesh.getVertexPosition(i, pv);
      pv.applyMatrix4(mesh.matrixWorld);
      return av.worldToLocal(pv);
    };
    // 지금 자세에서 점들의 가운데
    const palmCenter = (points: readonly SkinPoint[], out: THREE.Vector3) => {
      out.set(0, 0, 0);
      for (const mesh of skins) mesh.skeleton.update();
      for (const p of points) {
        const at = skinAt(p);
        out.add(at);
      }
      return out.divideScalar(points.length);
    };
    let held: { G: THREE.Group; points: SkinPoint[]; offset: THREE.Vector3 } | null = null;
    const followHand = () => {
      if (!held) return;
      av.updateMatrixWorld(true);
      palmCenter(held.points, held.G.position).add(held.offset);
    };
    // st.f = 나아가는 정도, st.r = 솟음(+)·떨어짐(-), st.b = 옆으로 끄는 기울기. 모두 천천히 따라간다
    const poseFrame: PoseFn = ({ dt, tot, vy, air, fx, time: t }) => {
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
      followHand();
    };
    // 꾸미기: 칸(slot)마다 하나씩, 같은 칸에 새로 끼우면 바뀐다. 뼈에 끼울 때는 처음 선 자세(바인드) 기준으로 자리를 계산해서,
    // 움직이는 도중에 갈아 끼워도 어긋나지 않는다
    const hs = new THREE.Vector3(),
      hc = new THREE.Vector3();
    hb.getSize(hs);
    hb.getCenter(hc);
    // 처음 선 자세: 뼈마다 자리·돌림·크기. 뼈대 전체(skeleton.pose)를 되돌리면 뼈대 맨 위의 배율까지 날아가 몸이 사라져서, 뼈마다 되돌린다
    const rest: [THREE.Bone, THREE.Vector3, THREE.Quaternion, THREE.Vector3][] = [];
    av.traverse((c) => {
      if (!(c instanceof THREE.Bone)) return;
      const p = c.position.clone(),
        q = c.quaternion.clone(),
        sc = c.scale.clone();
      rest.push([c, p, q, sc]);
    });
    // 끼우는 순간만 처음 자세로 되돌린다(다음 프레임에 몸짓이 자세를 다시 잡는다)
    const toBind = () => {
      for (const [bone, p, q, sc] of rest) {
        bone.position.copy(p);
        bone.quaternion.copy(q);
        bone.scale.copy(sc);
      }
      av.updateMatrixWorld(true);
    };
    // 손에 드는 것은 팔을 내리고 선 자세 기준으로 끼운다. 처음 자세는 팔을 옆으로 뻗고 있어서, 거기 맞추면 팔을 내릴 때 물건이 눕는다
    const toIdle = () => {
      toBind();
      const leftArmDown = 0.8 * leftDir,
        rightArmDown = -0.8 * leftDir,
        leftElbowIn = 0.15 * leftDir,
        rightElbowIn = -0.15 * leftDir;
      pose("LeftArm", 0, leftArmDown, 0);
      pose("RightArm", 0, rightArmDown, 0);
      pose("LeftForeArm", 0.3, leftElbowIn, 0);
      pose("RightForeArm", 0.3, rightElbowIn, 0);
      av.updateMatrixWorld(true);
    };
    const attachTo = (bone: THREE.Bone, G: THREE.Group) => {
      av.add(G);
      G.updateMatrixWorld(true);
      bone.attach(G);
    };
    // 지금 자세에서 쥔 자리(몸 모델 기준)에 가장 가까운 손 살(점)들
    const palmPointsNear = (point: THREE.Vector3): SkinPoint[] => {
      const near: { d: number; p: SkinPoint }[] = [];
      for (const mesh of skins) {
        mesh.skeleton.update();
        const count = mesh.geometry.attributes.position.count;
        for (let i = 0; i < count; i++) {
          const p = { mesh, i };
          if (isBodySkin(p)) continue;
          const d = skinAt(p).distanceToSquared(point);
          near.push({ d, p });
        }
      }
      near.sort((a, b) => a.d - b.d);
      return near.slice(0, PALM_POINTS).map(({ p }) => p);
    };
    const local = (o: THREE.Object3D) => {
      const w = new THREE.Vector3();
      o.getWorldPosition(w);
      return av.worldToLocal(w);
    };
    // 부품 모델 하나를 칸의 자리에 놓는다(자리는 몸 모델 기준 — 몸 키 1.2). 놓지 못하면 null
    const place = (d: PartFit, root: THREE.Group): THREE.Group | null => {
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
      const yaw = faceDir > 0 ? 0 : Math.PI; // 뽑아 온 부품은 앞이 +x를 본다. 그 앞을 얼굴 쪽으로
      const G = new THREE.Group();
      if (d.slot === "hair" || d.slot === "face") {
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
        toBind();
        attachTo(B.Head, G);
        return G;
      }
      if (d.slot === "ear") {
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
        toBind();
        attachTo(B.Head, G);
        return G;
      }
      if (d.slot === "hand") {
        const bone = B[d.bone],
          fore = B[d.bone.replace("Hand", "ForeArm")];
        if (!bone) return null;
        const k = d.size / Math.max(bs.x, bs.y, bs.z);
        toBind();
        // 처음 자세(팔을 옆으로 뻗음)에서 손뼈부터 몸 옆 끝(손끝)까지
        const handAtBind = local(bone),
          fromMiddle = handAtBind.z - ct.z,
          handOut = Math.abs(fromMiddle),
          tip = sz.z / 2 - handOut - 0.04,
          reach = Math.max(0, tip) * HAND_REACH;
        toIdle();
        const hp = local(bone);
        if (fore) {
          const elbow = local(fore),
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
        // 쥔 자리: 드는 것은 그 가운데(시제품에서 손에 쥔 듯 맞춘 자리), 늘어뜨리는 것은 끈 꼭대기
        const gripY = d.hang ? hp.y : handY,
          grip = new THREE.Vector3(handX, gripY, handZ),
          points = palmPointsNear(grip);
        const { main, share } = mainBoneOf(points);
        if (points.length === 0 || share >= RIGID_SHARE) {
          attachTo(main ?? bone, G);
          return G;
        }
        av.add(G);
        const center = new THREE.Vector3();
        palmCenter(points, center);
        const offset = G.position.clone().sub(center);
        held = { G, points, offset };
        return G;
      }
      // 보드: 처음 자세의 발밑(몸 모델 원점)에 긴 변을 앞뒤로 놓고 엉덩이뼈에 끼운다 — 몸을 눕혀 날 때도 발 쪽을 따라간다
      const k = d.len / Math.max(bs.x, bs.z);
      G.add(m);
      G.scale.setScalar(k);
      G.rotation.y = bs.z > bs.x ? Math.PI / 2 : 0;
      const boardY = (-bs.y * k) / 2 - 0.015;
      G.position.set(0, boardY, 0);
      toBind();
      attachTo(B.Hips, G);
      return G;
    };
    const worn: Partial<Record<PartSlot, THREE.Group>> = {};
    // 칸마다 고른 차례 — 늦게 도착한 모델이 그 뒤에 고른 것을 덮지 않게
    const picks: Record<PartSlot, number> = { hair: 0, face: 0, ear: 0, hand: 0, board: 0 };
    const strip = (slot: PartSlot) => {
      picks[slot] += 1;
      if (slot === "hand") held = null;
      worn[slot]?.removeFromParent();
      delete worn[slot];
    };
    const wear = (key: string) => {
      const d = PARTS[key];
      if (!d) return;
      strip(d.slot);
      const mine = picks[d.slot];
      if (!models.has(key)) return;
      models.need(key);
      models.when(key, (root) => {
        if (picks[d.slot] !== mine) return;
        const G = place(d, root);
        if (G) worn[d.slot] = G;
      });
    };
    onReady({ pose: poseFrame, wear, strip, hold });
  });
}

/* ─── 내부 ─────────────────────────── */

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

// 점들이 가장 많이 묶인 뼈와 그 몫(0..1)
function mainBoneOf(points: readonly SkinPoint[]): { main: THREE.Bone | null; share: number } {
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
