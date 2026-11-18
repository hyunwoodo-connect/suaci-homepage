import * as THREE from "three";

import type { ModelLibrary } from "../models/library";
import { S } from "../settings";
import type { Hull } from "./outline";
import { addHull } from "./outline";
import { HIDE } from "./tuning";

// 숨는 애(라임 상자) 하나. 뼈대가 없어 움직임은 모두 여기서 몸 전체를 옮기고 늘이고 기울여서 낸다 — 늘 찌그러졌다 펴지는 맛이 있게.
// 리본 귀(모델 위쪽 30%)만은 셰이더로 따로 움직인다: 몸보다 반 박자 늦게 따라오는 스프링이고, 빳빳이 서거나 팔랑인다.
// 몸짓 사전(연출 지시서): 폴짝 · 종종걸음 · 깜짝 · 버둥 · 넘어졌다 일어나기 · 리본 잡아당기기 · 춤 · 손 흔들기,
// 줄 설 때 작아지기, 언박싱의 들썩·터지기, 하늘에서 떨어지기.
// 몸짓의 시간·크기는 hideseek.data.json 의 box·moves

/** 상자 키(m) */
const BOX_HEIGHT = HIDE.box.height;
/** 상자 모델 키 */
export const LIMEBOX = "limebox";
/** 숨은 상자의 흰 테두리 굵기(px) — 모든 상자가 나눠 쓴다(버섯 꼭대기에서 내려다볼 때 굵게) */
export const BOX_OUTLINE_PX = { value: HIDE.box.outlinePx };

const { box, moves } = HIDE;
const RAD = Math.PI / 180;
/** 몸짓의 크기(hideseek.data.json 의 moves): 뒤뚱거리는 각, 폴짝의 납작·늘어남, 깜짝의 늘어남, 버둥의 각 */
const WADDLE = moves.waddleDegrees * RAD,
  HOP_LOW = 1 - moves.hopSquash,
  HOP_LONG = moves.hopStretch - 1,
  STARTLE_LONG = moves.startleStretch - 1,
  FLAIL = moves.flailDegrees * RAD;
/** 숨쉬기 한 번(초)·찌그러지는 몫 */
const BREATH_PERIOD = box.breathSeconds,
  BREATH_SQUASH = box.breathSquash;
/** 폴짝: 움츠리는 시간·떠 있는 시간·착지 뒤 출렁이는 시간(초) */
const HOP_CROUCH = 0.1,
  HOP_AIR = 0.36,
  HOP_SETTLE = 0.3,
  HOP_TIME = HOP_CROUCH + HOP_AIR + HOP_SETTLE;
/** 춤: 좌우로 기우는 각·몸을 트는 각(rad) · 박자마다 뛰는 높이(키 반의 몫) */
const DANCE_LEAN = 0.24,
  DANCE_TWIST = 0.5,
  DANCE_HOP = 0.22;
/** 깜짝: 늘어나는 시간·출렁이며 돌아오는 시간(초) */
const STARTLE_UP = 0.08,
  STARTLE_BACK = 0.3,
  STARTLE_TIME = STARTLE_UP + STARTLE_BACK;
/** 넘어졌다 일어나기(초) */
const TOPPLE_TIME = 0.55;
/** 언박싱의 들썩·터지기(초) */
const JIGGLE_TIME = 0.4,
  POP_TIME = 0.28;
/** 떨어질 때 중력(m/s²)과 튀는 몫(보너스 상자는 두 번 튄다) */
const DROP_GRAVITY = 22,
  DROP_BOUNCE = 0.34;
/** 리본 귀 스프링: 빠르기(rad/s)·감쇠 몫, 귀가 시작하는 높이(배포본 모델의 정점 좌표 — 압축하며 키가 -1..1 로 맞춰진다) */
const EAR_RATE = 15,
  EAR_DAMP = 0.28,
  EAR_BASE = 0.4;
/** 금빛 리본(흰 부분만 물들인다) */
const GOLD_GLSL = `// 금빛 리본
      { float gmx = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)), gmn = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
      float gs = (gmx - gmn) / max(gmx, 0.001), isWhite = step(gs, 0.2) * step(0.45, gmx);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.76, 0.22) * (0.5 + 0.55 * gmx), isWhite); }
      #include <alphamap_fragment>`;
/**
 * 리본 귀: 밑동(EAR_BASE)을 축으로 box.earScale 배 길게(폰에서 물건 위·옆으로 삐죽 나오게) 늘이고(z)
 * 끝으로 갈수록 앞뒤(x)·좌우(y)로 휜다. 귀에는 먹색 테두리를 둘러 배경과 섞이지 않게 한다
 */
const EAR_FROM = EAR_BASE.toFixed(3),
  EAR_SPAN = (1 - EAR_BASE).toFixed(3),
  EAR_INK = new THREE.Color(HIDE.colors.ink);
const EAR_GLSL = `#include <begin_vertex>
      { float earW = smoothstep(${EAR_FROM} - 0.05, ${EAR_FROM} + 0.1, position.y);
      vec3 earQ = transformed - vec3(0.0, ${EAR_FROM}, 0.0);
      float earTip = clamp(earQ.y / ${EAR_SPAN}, 0.0, 1.0);
      vEarW = earW;
      earQ.y *= uEarL * (1.0 + uEar.z);
      earQ.x += uEar.x * earTip; earQ.z += uEar.y * earTip;
      transformed = mix(transformed, earQ + vec3(0.0, ${EAR_FROM}, 0.0), earW); }`;
const EAR_HEAD = "uniform vec3 uEar;\nuniform float uEarL;\nvarying float vEarW;\n";
/** 귀 테두리: 귀 부분에서 시선과 비스듬한 가장자리를 먹색으로 */
const EAR_RIM_GLSL = `#include <alphamap_fragment>
      #ifndef FLAT_SHADED
      { float earRim = 1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition)));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${EAR_INK.r.toFixed(3)}, ${EAR_INK.g.toFixed(3)}, ${EAR_INK.b.toFixed(3)}), smoothstep(0.62, 0.8, earRim) * vEarW); }
      #endif`;

/** 한 번 하고 끝나는 몸짓 */
type Act = "hop" | "startle" | "flail" | "knock" | "wave" | "dance" | "topple" | "jiggle";

/** 이번 프레임의 몸: 띄우기(m)·찌그러짐(키 배수)·앞으로 숙임·옆으로 기욺·돌기(rad)·크기, 귀의 앞뒤·좌우 휨과 늘어남 */
interface Pose {
  lift: number;
  squash: number;
  pitch: number;
  roll: number;
  yaw: number;
  size: number;
  earX: number;
  earZ: number;
  earStretch: number;
}

const bx = new THREE.Vector3(),
  bf = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  spinQ = new THREE.Quaternion(),
  tiltQ = new THREE.Quaternion(),
  tiltE = new THREE.Euler(),
  axis = new THREE.Vector3(),
  YAXIS = new THREE.Vector3(0, 1, 0);

/** 라임 상자 하나 */
export class LimeBox {
  /** 자리(이 그룹을 행성 위에 놓는다) */
  readonly g = new THREE.Group();
  /** 행성 위 자리(단위 벡터)와 바닥 높이(땅 또는 꼭대기, m) */
  readonly v = new THREE.Vector3();
  a = 0;
  /** 보는 쪽(접선 단위 벡터) */
  readonly f = new THREE.Vector3(1, 0, 0);
  /** 키의 반(m) */
  readonly hh: number;
  /** 바닥 위로 떠 있는 높이(떨어지는 중) */
  private air = 0;
  private vy = 0;
  private dropping = false;
  private readonly hold: THREE.Group;
  private readonly ph: number;
  private readonly pose: Pose = blankPose();
  /** 리본 귀 셰이더 값(x 앞뒤 휨, y 좌우 휨, z 늘어남)과 스프링 */
  private readonly ear = { value: new THREE.Vector3() };
  /** 귀 길이 배수(숨어 있는 동안 box.earScale — 물건 위·옆으로 삐죽 나오게, 줄에 서면 원래대로) */
  private readonly earLong = { value: HIDE.box.earScale };
  private readonly earAt = new THREE.Vector3();
  private readonly earVel = new THREE.Vector3();
  // ---- 한 번 하는 몸짓 ----
  private act: Act | null = null;
  private actT = 0;
  private actFor = 0;
  /** 폴짝 높이(m) · 폴짝하며 한 바퀴 도나 */
  private hopHigh = 0;
  private hopSpins = false;
  // ---- 이어지는 몸짓 ----
  private scurry = 0;
  private scurryPhase = 0;
  private popT = -1;
  /** 크기 배수: 바라는 값과 지금 값 */
  private sizeWant = 1;
  private sizeNow = 1;
  /** 흰 테두리(숨어 있는 동안 — 모델이 오면 만든다)와 켜 달라는 값 */
  private hull: Hull | null = null;
  private wantsOutline = false;

  /** scale: 키 배수(보너스 1.4·안에서 나오는 작은 상자), gold: 리본을 금빛으로 */
  constructor(
    models: ModelLibrary,
    scene: THREE.Scene,
    readonly scale = 1,
    gold = false,
    rand: () => number = Math.random,
  ) {
    const height = BOX_HEIGHT * scale;
    const onArrive = (model: THREE.Object3D) => {
      livelyEars(model, this.ear, this.earLong);
      if (gold) goldRibbon(model);
      // 테두리 껍데기도 귀와 같이 휜다
      const bend = {
        head: EAR_HEAD,
        vertex: EAR_GLSL,
        uniforms: { uEar: this.ear, uEarL: this.earLong },
        key: "ears2",
      };
      this.hull = addHull(model, 0xffffff, BOX_OUTLINE_PX, bend);
      this.hull.visible = this.wantsOutline;
    };
    this.hold = models.fit(LIMEBOX, height, "h", { ownLime: true, onArrive });
    this.hh = this.hold.userData.hh;
    this.g.add(this.hold);
    scene.add(this.g);
    this.ph = rand() * Math.PI * 2;
  }

  /** 지금 크기 배수(줄 설 때 작아지고, 멀면 화면에서 보이게 커진다) */
  get size(): number {
    return this.sizeNow;
  }

  /** 숨어 있는 동안 귀를 길게(box.earScale) · 원래대로 */
  setLongEars(on: boolean) {
    this.earLong.value = on ? HIDE.box.earScale : 1;
  }

  /** 몸과 귀 둘레의 흰 테두리(숨어 있는 동안 — 배경이 무슨 색이든 떠 보이게) */
  setOutline(on: boolean) {
    this.wantsOutline = on;
    if (this.hull) this.hull.visible = on;
  }

  /** 보이나 */
  get visible(): boolean {
    return this.g.visible;
  }
  set visible(on: boolean) {
    this.g.visible = on;
  }

  /** 이 자리(v 단위 벡터, 바닥 높이 a)에 face 쪽을 보고 선다. 하던 짓은 그친다(크기 배수는 그대로) */
  put(v: THREE.Vector3, a: number, face: THREE.Vector3) {
    this.v.copy(v).normalize();
    this.a = a;
    this.faceTo(face);
    this.air = 0;
    this.vy = 0;
    this.dropping = false;
    this.act = null;
    this.scurry = 0;
    this.popT = -1;
    this.earAt.set(0, 0, 0);
    this.earVel.set(0, 0, 0);
    this.g.scale.setScalar(1);
    this.g.visible = true;
  }

  /** 보는 쪽을 바꾼다(접선으로 눕힌다) */
  faceTo(face: THREE.Vector3) {
    const radial = face.dot(this.v);
    this.f.copy(face).addScaledVector(this.v, -radial);
    if (this.f.lengthSq() < 1e-8) return;
    this.f.normalize();
  }

  /** 몸 가운데의 세계 자리(지금 크기 배수대로) */
  center(out: THREE.Vector3): THREE.Vector3 {
    const half = this.hh * this.sizeNow,
      radius = S.R + this.a + this.air + half;
    return out.copy(this.v).multiplyScalar(radius);
  }

  // ---- 몸짓 사전 ----

  /** 폴짝: 0.1초 납작(80%) → 길게 늘어나며 뛰어오름(height m — 안 주면 제 키만큼) → 착지에 다시 납작 → 출렁 두 번. spins: 뛰며 한 바퀴 */
  hop(height: number | null = null, spins = false) {
    this.hopHigh = height ?? this.hh * 2;
    this.hopSpins = spins;
    this.start("hop", HOP_TIME);
  }

  /** 종종걸음의 세기(0..1): 좌우로 12도씩 뒤뚱거리며 통통(한 걸음 0.12초) */
  setScurry(k: number) {
    this.scurry = k;
  }

  /** 깜짝: 0.08초에 키 130%로 쭉 늘어나고 귀가 빳빳이 선다 → 0.3초에 출렁이며 돌아온다 */
  startle() {
    this.start("startle", STARTLE_TIME);
  }

  /** 버둥: 제자리에서 좌우 25도씩 빠르게 네 번, 귀는 따로 팔랑 */
  flail(seconds: number) {
    this.start("flail", seconds);
  }

  /** 넘어졌다 일어난다(우왕좌왕하다가) */
  topple() {
    this.start("topple", TOPPLE_TIME);
  }

  /** 리본이 걸려 한 번 잡아당긴다(숨으러 달려가다가) */
  tug() {
    this.start("knock", 0.7);
  }

  /** 춤: seconds 동안 좌우로 씰룩씰룩하며 통통, 귀를 흔든다(찾았을 때) */
  dance(seconds: number) {
    this.start("dance", seconds);
  }

  /** 폴짝 한 번에 걸리는 시간(초) */
  static readonly hopSeconds = HOP_TIME;

  /** 리본 귀로 손을 흔든다 */
  wave() {
    this.start("wave", 1);
  }

  /** 들썩(언박싱 첫 번) */
  jiggle() {
    this.start("jiggle", JIGGLE_TIME);
  }

  /** 크기 배수(1 이 그대로): 찾아서 내 뒤에 줄을 설 때 작아진다 — 천천히 바뀐다(isInstant 면 바로) */
  setSize(k: number, isInstant = false) {
    this.sizeWant = k;
    if (isInstant) this.sizeNow = k;
  }

  /** 터진다(작아지며 사라진다) */
  pop() {
    this.popT = 0;
  }

  /** 터지는 중이거나 사라졌나 */
  get isPopping(): boolean {
    return this.popT >= 0;
  }

  /** 이만큼(m) 위에서 떨어뜨린다(땅에 닿으면 통통 튄다) */
  dropFrom(height: number) {
    this.air = height;
    this.vy = 0;
    this.dropping = true;
  }

  /** 떨어지는 중인가 */
  get isDropping(): boolean {
    return this.dropping;
  }

  /** 한 프레임: 숨쉬기·하던 몸짓을 몸에 입히고 행성 위에 놓는다 */
  update(dt: number, time: number) {
    const g = this.g;
    if (!g.visible) return;
    const P = this.pose;
    resetPose(P);
    const breathTime = time + this.ph;
    P.squash = breathAt(breathTime);
    this.playAct(dt, P);
    this.playLoops(dt, P);
    this.fall(dt);
    const sizeStep = dt * 7,
      sizing = Math.min(1, sizeStep);
    this.sizeNow += (this.sizeWant - this.sizeNow) * sizing;
    P.size *= this.sizeNow;
    if (this.popT >= 0) {
      this.popT += dt;
      const u = this.popT / POP_TIME;
      if (u >= 1) {
        g.visible = false;
        return;
      }
      // 먼저 납작 눌렸다가 부풀며 사라진다
      P.squash = u < 0.4 ? 1 - 0.3 * (u / 0.4) : 0.7 + 0.6 * ((u - 0.4) / 0.6);
      P.size *= u < 0.4 ? 1 : 1 - (u - 0.4) / 0.6;
    }
    this.swayEars(dt, P);
    // 모델 틀의 크기 배수(키를 box.height 에 맞춘 값) 위에 찌그러짐을 얹는다 — 배수를 덮어쓰면 키 설정이 화면에 나오지 않는다
    const fit = this.hold.userData.k,
      wide = (1 + (1 - P.squash) * 0.5) * fit,
      tall = P.squash * fit;
    this.hold.scale.set(wide, tall, wide);
    this.hold.position.y = this.hh * P.squash;
    g.scale.setScalar(P.size);
    // 놓기: 위가 v, 앞(모델 +x)이 f
    bx.crossVectors(this.f, this.v).normalize();
    bf.crossVectors(this.v, bx).normalize();
    m4.makeBasis(bf, this.v, bx);
    g.quaternion.setFromRotationMatrix(m4);
    if (P.yaw) {
      spinQ.setFromAxisAngle(YAXIS, P.yaw);
      g.quaternion.multiply(spinQ);
    }
    const radius = S.R + this.a + this.air + P.lift;
    g.position.copy(this.v).multiplyScalar(radius);
    if (P.roll || P.pitch) {
      // 숙임(앞으로 +)과 기욺은 바닥을 축으로
      tiltE.set(P.roll, 0, -P.pitch);
      tiltQ.setFromEuler(tiltE);
      g.quaternion.multiply(tiltQ);
    }
  }

  /** v 에서 to(단위 벡터) 쪽으로 speed(m/s) 만큼 간다. 남은 거리(m)를 돌려준다 */
  stepToward(to: THREE.Vector3, speed: number, dt: number): number {
    const angle = this.v.angleTo(to),
      dist = angle * S.R;
    if (dist < 1e-4) return 0;
    const reach = speed * dt,
      move = Math.min(dist, reach),
      stepAngle = move / S.R;
    axis.crossVectors(this.v, to).normalize();
    // 나아가는 쪽을 본다
    bf.crossVectors(axis, this.v);
    this.faceTo(bf);
    this.v.applyAxisAngle(axis, stepAngle).normalize();
    return dist - move;
  }

  /** 치운다(모델 재질은 모델 자리가 치운다) */
  dispose() {
    this.g.removeFromParent();
    this.hull?.dispose();
  }

  /* ─── 내부 ─────────────────────────── */

  private start(act: Act, seconds: number) {
    this.act = act;
    this.actT = 0;
    this.actFor = seconds;
  }

  // 한 번 하는 몸짓을 몸에 입힌다
  private playAct(dt: number, P: Pose) {
    if (!this.act) return;
    this.actT += dt;
    const t = this.actT;
    if (t >= this.actFor) {
      this.act = null;
      return;
    }
    const u = t / this.actFor;
    switch (this.act) {
      case "hop":
        this.hopPose(t, P);
        break;
      case "startle": {
        if (t < STARTLE_UP) {
          const k = t / STARTLE_UP;
          P.squash *= 1 + STARTLE_LONG * k;
          P.earStretch += 0.5 * k;
          break;
        }
        const back = (t - STARTLE_UP) / STARTLE_BACK,
          swing = settle(back, 2);
        P.squash *= 1 + STARTLE_LONG * swing;
        P.earStretch += 0.5 * (1 - back);
        break;
      }
      case "flail": {
        const swing = u * Math.PI * 8;
        P.roll += Math.sin(swing) * FLAIL;
        P.earZ += Math.cos(swing) * 0.45;
        P.earStretch += 0.25;
        break;
      }
      case "knock": {
        // 리본을 앞으로 두 번 톡톡 잡아당긴다
        const tapPhase = u * Math.PI * 2,
          beat = Math.sin(tapPhase),
          tap = Math.abs(beat);
        P.earX += 0.5 * tap;
        P.pitch += 0.12 * tap;
        break;
      }
      case "topple": {
        // 앞으로 넘어져 누웠다가 벌떡
        const falling = u / 0.35,
          rising = (u - 0.6) / 0.4,
          down = u < 0.35 ? smooth(falling) : u < 0.6 ? 1 : 1 - smooth(rising);
        P.pitch += 1.5 * down;
        P.squash *= 1 - 0.12 * down;
        if (u > 0.6) P.lift += arc(rising) * this.hh;
        break;
      }
      case "dance": {
        // 좌우로 네 번 씰룩(몸이 기울며 엉덩이를 흔든다), 박자마다 통통, 귀는 반대로 팔랑
        const beat = u * Math.PI * 8,
          sway = Math.sin(beat),
          bounce = Math.abs(sway);
        P.roll += sway * DANCE_LEAN;
        P.yaw += sway * DANCE_TWIST;
        P.lift += bounce * DANCE_HOP * this.hh;
        P.squash *= 1 - 0.08 * (1 - bounce);
        P.earZ -= sway * 0.55;
        P.earStretch += 0.2 * bounce;
        break;
      }
      case "wave": {
        const wavePhase = u * Math.PI * 6;
        P.earZ += Math.sin(wavePhase) * 0.5 * (1 - u * 0.5);
        P.roll += Math.sin(wavePhase) * 0.05;
        break;
      }
      case "jiggle": {
        const wobblePhase = u * Math.PI * 5;
        P.lift += arc(u) * 0.14 * this.scale;
        P.roll += Math.sin(wobblePhase) * 0.16 * (1 - u);
        break;
      }
    }
  }

  // 폴짝: 움츠림(80%) → 떠서 길게(115%) → 착지에 납작(80%) → 출렁 두 번
  private hopPose(t: number, P: Pose) {
    if (t < HOP_CROUCH) {
      P.squash *= 1 - HOP_LOW * (t / HOP_CROUCH);
      return;
    }
    const airT = t - HOP_CROUCH;
    if (airT < HOP_AIR) {
      const k = airT / HOP_AIR,
        offMid = 2 * k - 1,
        rise = 1 - Math.abs(offMid);
      P.lift += arc(k) * this.hopHigh;
      P.squash *= 1 + HOP_LONG * (1 - rise);
      if (this.hopSpins) P.yaw += smooth(k) * Math.PI * 2;
      return;
    }
    const back = (airT - HOP_AIR) / HOP_SETTLE;
    P.squash *= 1 - HOP_LOW * settle(back, 2);
  }

  // 이어지는 몸짓: 종종걸음
  private playLoops(dt: number, P: Pose) {
    if (this.scurry > 0.05) {
      this.scurryPhase += (dt / moves.stepSeconds) * Math.PI;
      const sway = Math.sin(this.scurryPhase),
        bob = Math.abs(sway);
      P.roll += sway * WADDLE * this.scurry;
      P.lift += bob * 0.22 * this.scale * this.scurry;
      P.squash *= 1 - 0.06 * (1 - bob) * this.scurry;
    }
  }

  // 리본 귀: 몸의 기욺·숙임·오르내림을 반 박자 늦게 따라가는 스프링(따라가다 지나쳐 출렁인다) 위에, 몸짓이 정한 휨·늘어남을 얹는다
  private swayEars(dt: number, P: Pose) {
    const at = this.earAt,
      vel = this.earVel;
    const fine = dt / 0.02,
      steps = Math.ceil(fine),
      n = Math.max(1, steps),
      h = dt / n,
      pull = EAR_RATE * EAR_RATE,
      drag = 2 * EAR_DAMP * EAR_RATE;
    const liftNow = P.lift / (this.hh * 2);
    for (let i = 0; i < n; i++) {
      vel.x += ((P.pitch - at.x) * pull - vel.x * drag) * h;
      vel.y += ((P.roll - at.y) * pull - vel.y * drag) * h;
      vel.z += ((liftNow - at.z) * pull - vel.z * drag) * h;
      at.addScaledVector(vel, h);
    }
    // 몸보다 늦은 만큼 반대로 휘어 보인다
    const behindX = at.x - P.pitch,
      behindZ = P.roll - at.y,
      behindUp = at.z - liftNow;
    const lagX = clampTo(behindX, 0.9),
      lagZ = clampTo(behindZ, 0.9),
      lagUp = clampTo(behindUp, 0.6);
    const swayX = P.earX + lagX * 0.6,
      swayZ = P.earZ + lagZ * 0.6,
      stretch = P.earStretch + lagUp * 0.5,
      floor = Math.max(-0.7, stretch);
    this.ear.value.set(swayX, swayZ, floor);
  }

  private fall(dt: number) {
    if (!this.dropping) return;
    this.vy -= DROP_GRAVITY * dt;
    this.air += this.vy * dt;
    if (this.air > 0) return;
    this.air = 0;
    // 통통 튀다가 선다
    const rebound = -this.vy * DROP_BOUNCE;
    if (rebound > 1.6) this.vy = rebound;
    else {
      this.vy = 0;
      this.dropping = false;
    }
  }
}

/** 숨쉬기: 1 에서 0.97 사이로 천천히 오르내린다 */
export function breathAt(time: number): number {
  const phase = (time / BREATH_PERIOD) * Math.PI * 2;
  const wave = 0.5 + 0.5 * Math.sin(phase);
  return 1 - BREATH_SQUASH * wave;
}

/* ─── 내부 ─────────────────────────── */

function blankPose(): Pose {
  return {
    lift: 0,
    squash: 1,
    pitch: 0,
    roll: 0,
    yaw: 0,
    size: 1,
    earX: 0,
    earZ: 0,
    earStretch: 0,
  };
}

function resetPose(P: Pose) {
  P.lift = P.pitch = P.roll = P.yaw = 0;
  P.earX = P.earZ = P.earStretch = 0;
  P.squash = P.size = 1;
}

// 0..1 에서 솟았다 내려오는 곡선(꼭대기 1)
function arc(u: number): number {
  return 4 * u * (1 - u);
}

function smooth(u: number): number {
  return u * u * (3 - 2 * u);
}

// 출렁이며 가라앉는 곡선: 1 에서 시작해 swings 번 출렁이고 0 으로
function settle(u: number, swings: number): number {
  const phase = u * Math.PI * 2 * swings,
    fade = (1 - u) * (1 - u);
  return Math.cos(phase) * fade;
}

function clampTo(x: number, limit: number): number {
  const capped = Math.min(limit, x);
  return Math.max(-limit, capped);
}

// 리본 귀가 따로 움직이게 한다(재질은 이 틀만의 복제본이다): 정점 셰이더에서 귀 부분만 휘고 늘이고 접는다
function livelyEars(model: THREE.Object3D, ear: { value: THREE.Vector3 }, long: { value: number }) {
  model.traverse((c) => {
    if (!(c instanceof THREE.Mesh)) return;
    const mat = c.material as THREE.MeshStandardMaterial;
    const base = mat.onBeforeCompile,
      baseKey = mat.customProgramCacheKey;
    mat.onBeforeCompile = (sh, renderer) => {
      base.call(mat, sh, renderer);
      sh.uniforms.uEar = ear;
      sh.uniforms.uEarL = long;
      const patched = sh.vertexShader.replace("#include <begin_vertex>", EAR_GLSL);
      sh.vertexShader = EAR_HEAD + patched;
      const rimmed = sh.fragmentShader.replace("#include <alphamap_fragment>", EAR_RIM_GLSL);
      sh.fragmentShader = "varying float vEarW;\n" + rimmed;
    };
    mat.customProgramCacheKey = () => {
      const key = baseKey.call(mat);
      return key + "-ears2";
    };
    mat.needsUpdate = true;
  });
}

// 보너스 상자: 흰 리본만 금빛으로 물들인다(재질은 이 틀만의 복제본이다)
function goldRibbon(model: THREE.Object3D) {
  model.traverse((c) => {
    if (!(c instanceof THREE.Mesh)) return;
    const mat = c.material as THREE.MeshStandardMaterial;
    const base = mat.onBeforeCompile,
      baseKey = mat.customProgramCacheKey;
    mat.onBeforeCompile = (sh, renderer) => {
      base.call(mat, sh, renderer);
      sh.fragmentShader = sh.fragmentShader.replace("#include <alphamap_fragment>", GOLD_GLSL);
    };
    mat.customProgramCacheKey = () => {
      const key = baseKey.call(mat);
      return key + "-gold";
    };
    mat.needsUpdate = true;
  });
}
