import * as THREE from "three";

import type { Services } from "../services";
import { S } from "../settings";
import { offset, offsetInto } from "../world/sphere";
import type { HideFx } from "./effects";
import type { Hull } from "./outline";
import { addHull } from "./outline";
import { HIDE } from "./tuning";

// 전설의 생물: 가장 큰 생물(고래)이 한 판에 많아야 한 번, 하늘 높이(legend.lift) 크고 느리게 판 위를 가로지른다. 땅에 닿아 보이면 안 된다.
// 나타날 때 그쪽 하늘이 밝아지고 낮은 울음이 한 번(화면 밖이면 그쪽 화면 가장자리가 3초 동안 금빛으로 — overlay). 글자는 없다.
// 보통 생물과 급이 다르게: 고리 대신 몸 전체에 금빛 테두리가 1.5초 주기로 숨 쉰다.
// 화면에 보이면 거리와 상관없이 한 번 누른다(몸 전체를 받는다) →
//   0초 미스트 줄기가 하늘로 길게(0.5초) → 0.5초 크게 울며 몸을 한 번 뒤집고 하늘에 금빛 고리 →
//   1.2초 나를 향해 큰 원을 그리며 내려온다(descendSeconds — 카메라가 따라 올려다본다) → 내 앞에서 등을 낮추고 나를 태운다 →
//   carryLift 높이로 올라가 가장 먼 숨은 상자 앞까지 데려다준다(그 상자는 찾은 것). legend.staySeconds 안에 못 누르면 지나간다.
// 나올지(판마다 chance, 첫 판은 반드시)·언제(from~to 초 사이)는 hideseek.data.json 의 legend

/** 전설의 손님이 되는 고래에게 부탁하는 것(Whale) */
export interface LegendWhale {
  /** 지금 자리(단위 벡터)와 몸(세계 자리를 읽는다) */
  readonly v: THREE.Vector3;
  readonly g: THREE.Object3D;
  readonly isRiding: boolean;
  readonly pathLeft: number;
  /** 몸 키의 절반(m — 땅에 닿지 않게 내려오는 높이를 정한다) */
  readonly bodyHalf: number;
  parade(
    from: THREE.Vector3,
    to: THREE.Vector3,
    seconds: number,
    lift: number,
    reach: number,
  ): void;
  swoop(center: THREE.Vector3, end: THREE.Vector3, seconds: number, lift: number): void;
  carryTo(to: THREE.Vector3, seconds: number, lift: number): void;
  board(): void;
  roll(seconds: number): void;
  endParade(): void;
  dismount(): void;
  keepOff(): void;
  attach(o: THREE.Object3D): void;
}

/** 이번 프레임에 일어난 일: 나타났다 · 크게 울었다 · 내려오기 시작했다 · 나를 태웠다 · 데려다줬다 */
export type LegendEvent = "came" | "cried" | "descending" | "boarded" | "arrived";

/** 지금 하는 일: 안 나옴 · 나올 때를 기다림 · 판 위를 지나감 · 눌렸다 · 내려온다 · 등을 내밀었다 · 태워 감 */
type LegendState =
  "off" | "waiting" | "passing" | "tapped" | "descending" | "boarding" | "carrying";

/** 몸의 빛: 크기(m)·가장 밝을 때·숨 쉬듯 밝아졌다 어두워지는 빠르기, 가까이 가면 옅어진다(이 거리 m 안에서는 꺼지고, 이만큼 더 멀어지면 다 켜진다) */
const GLOW_SIZE = 110,
  GLOW_PEAK = 0.5,
  GLOW_BREATH = 1.3,
  GLOW_OFF_WITHIN = 60,
  GLOW_FADE_SPAN = 80,
  GOLD = 0xffd166;
/** 빛가루: 뿌리는 간격(초)·몸 둘레로 흩는 거리(m)·크기(m)·남아 있는 시간(초) */
const DUST_EVERY = 0.12,
  DUST_SPREAD = 16,
  DUST_SIZE = 1.6,
  DUST_LIFE = 6;
/** 금빛 테두리: 굵기(px)·숨 쉬는 주기(초) · 나타날 때 하늘이 밝아지는 시간(초) */
const RIM_PX = 3,
  RIM_PERIOD = 1.5,
  ARRIVE_GLOW = 0.8;
/** 눌린 뒤(초): 미스트가 닿는 때 · 내려오기 시작하는 때 · 뒤집는 시간 · 하늘의 금빛 고리 반지름(m) · 미스트 알갱이 수 */
const MIST_SECONDS = 0.5,
  DESCEND_AT = 1.2,
  ROLL_SECONDS = 0.7,
  SKY_RING = 45,
  MIST_DOTS = 8;
/**
 * 내려와 서는 자리(내 앞 m — 고래 모델은 길이 64m·지느러미까지 폭 54m 라, 이보다 가까우면 카메라가 몸속에 든다) · 몸 아래 띄우는 높이(m) ·
 * 등을 내밀고 못 태우면 떠나기까지(초) · 누를 수 있는 몸의 반높이·반길이(m)
 */
const BOARD_AHEAD = 40,
  BELLY_CLEAR = 2.5,
  BOARD_WAIT = 2,
  BODY_HALF_H = 9,
  BODY_HALF_L = 26;

const from = new THREE.Vector3(),
  to = new THREE.Vector3(),
  dust = new THREE.Vector3(),
  mote = new THREE.Vector3();

/** 전설의 생물 */
export class Legend {
  private state: LegendState = "off";
  /** 나타날 때(찾기 시작 뒤 초) · 지금 일을 한 지(초) */
  private at = 0;
  private stateT = 0;
  private readonly glow: THREE.Sprite;
  private glowK = 0;
  private flash = 0;
  private dustT = 0;
  private time = 0;
  private hasCried = false;
  private mistShown = -1;
  private readonly hub = new THREE.Vector3();
  private readonly rimPx = { value: RIM_PX };
  private rim: Hull | null = null;
  /** 테두리를 두른 고래의 면 수(모델이 늦게 오면 다시 두른다) */
  private rimFor = 0;
  private readonly mistFrom = new THREE.Vector3();

  /** eye: 보는 자리(카메라 — 가까이서는 몸의 빛을 줄인다) */
  constructor(
    private readonly s: Services,
    private readonly whale: LegendWhale,
    private readonly fx: HideFx,
    private readonly rand: () => number,
    private readonly eye: THREE.Object3D,
  ) {
    this.glow = fx.glowSprite(GLOW_SIZE);
    this.glow.material.color.set(GOLD);
    whale.attach(this.glow);
  }

  /** 지금 지나가는 중이라 누를 수 있나 */
  get isCatchable(): boolean {
    return this.state === "passing";
  }

  /** 누를 수 있는 몸(지나가는 동안): 몸 가운데(out)와 반높이·반길이(m). 없으면 null */
  body(out: THREE.Vector3): { halfH: number; halfW: number } | null {
    if (!this.isCatchable) return null;
    this.whale.g.getWorldPosition(out);
    return { halfH: BODY_HALF_H, halfW: BODY_HALF_L };
  }

  /** 눌렸다: 미스트 줄기가 하늘로 날아간다(그 뒤는 update 가 정한 때에) */
  tap() {
    if (!this.isCatchable) return;
    this.goTo("tapped");
    this.hasCried = false;
    this.mistShown = -1;
    this.mistFrom.copy(this.s.player.P);
  }

  /** 지금 판 위에 있나(지나가거나 내려오거나 태워 가는 중) */
  get isAround(): boolean {
    return this.state !== "off" && this.state !== "waiting";
  }

  /** 지금 나를 붙잡고 있나 — 내려오기 시작한 뒤부터 데려다줄 때까지(그동안 조작은 멈춘다) */
  get isCarrying(): boolean {
    return this.state === "descending" || this.state === "boarding" || this.state === "carrying";
  }

  /** 판 시작: 이번 판에 나올지와 나올 때를 정한다(sure — 첫 판은 반드시 나온다). hub: 무대 마을 중심 */
  plan(sure: boolean, hub: THREE.Vector3) {
    this.stop();
    this.hub.copy(hub);
    const roll = this.rand(),
      when = this.rand();
    const comes = sure || roll < HIDE.legend.chance;
    this.state = comes ? "waiting" : "off";
    this.at = HIDE.legend.from + when * (HIDE.legend.to - HIDE.legend.from);
  }

  /**
   * 한 프레임(찾는 중). roundT: 찾기 시작 뒤 초, farthest: 나를 태웠을 때 데려다줄 곳(가장 먼 숨은 상자의 자리, 없으면 null).
   * 일어난 일이 있으면 알려 준다
   */
  update(dt: number, roundT: number, farthest: () => THREE.Vector3 | null): LegendEvent | null {
    const whale = this.whale,
      L = HIDE.legend;
    this.time += dt;
    this.stateT += dt;
    let event: LegendEvent | null = null;
    if (this.state === "waiting") {
      // 큰 바퀴를 돌던 고래가 판 도중에 나를 태워 가지 않게 한다
      whale.keepOff();
      // 고래가 다른 길(언박싱에서 부른 한 번 지나가기)을 가는 중이면 그 길을 마칠 때까지 기다린다
      const isFree = whale.pathLeft <= 0 && !whale.isRiding;
      if (roundT >= this.at && isFree) {
        this.enter();
        event = "came";
      }
    } else if (this.state === "off") whale.keepOff();
    else if (this.state === "passing") {
      if (whale.pathLeft <= 0) this.leave();
    } else if (this.state === "tapped") event = this.afterTap();
    else if (this.state === "descending") {
      if (this.stateT >= L.descendSeconds) {
        whale.board();
        this.goTo("boarding");
      }
    } else if (this.state === "boarding") {
      if (whale.isRiding) {
        const goal = farthest();
        if (goal) {
          // 높이는 몸 가운데 — 배가 땅에 닿지 않게 몸 키의 절반 + BELLY_CLEAR 밑으로는 내려가지 않는다
          const lowest = whale.bodyHalf + BELLY_CLEAR,
            lift = Math.max(L.carryLift, lowest);
          whale.carryTo(goal, L.rideSeconds, lift);
          this.goTo("carrying");
          event = "boarded";
        } else {
          this.leave();
          event = "arrived";
        }
      } else if (this.stateT > BOARD_WAIT) {
        this.leave();
        event = "arrived";
      }
    } else if (whale.pathLeft <= 0 || !whale.isRiding) {
      this.leave();
      event = "arrived";
    }
    this.shine(dt);
    return event;
  }

  /** 지나가던 것을 돌려보낸다(판이 끝났다) — 태웠으면 내려 준다 */
  stop() {
    if (this.isAround) this.whale.endParade();
    this.state = "off";
  }

  /** 빛을 끈다(찾기가 끝난 뒤에도 프레임마다 부른다 — 서서히 꺼진다) */
  fade(dt: number) {
    this.shine(dt);
  }

  dispose() {
    this.rim?.dispose();
  }

  /* ─── 내부 ─────────────────────────── */

  private goTo(state: LegendState) {
    this.state = state;
    this.stateT = 0;
  }

  // 판 위로 들어선다: 무대 가운데에서 aside 만큼 비켜난 줄을, 가운데 span 밖에서 반대편 span 밖까지 하늘 높이
  private enter() {
    const L = HIDE.legend;
    const bearing = this.rand() * 360,
      sideBearing = bearing + 90,
      backBearing = bearing + 180;
    const mid = offset(this.hub, L.aside, sideBearing);
    offsetInto(from, mid, L.span, backBearing);
    offsetInto(to, mid, L.span, bearing);
    // 닿아서는 안 태운다(눌러야 내려온다)
    this.whale.parade(from, to, L.staySeconds, L.lift, 0);
    this.goTo("passing");
    this.flash = 1.5;
    // 고래 모델이 자리 채움 도형 뒤에 늦게 오면 그때 다시 두른다
    const meshes = countMeshes(this.whale.g);
    if (meshes !== this.rimFor) {
      this.rim?.dispose();
      this.rim = addHull(this.whale.g, GOLD, this.rimPx);
      this.rimFor = meshes;
    }
  }

  // 눌린 뒤: 미스트가 하늘로 → 크게 울며 뒤집고 금빛 고리 → 나를 향해 내려오기 시작
  private afterTap(): LegendEvent | null {
    const t = this.stateT;
    if (t < MIST_SECONDS) {
      this.mist(t);
      return null;
    }
    if (!this.hasCried) {
      this.hasCried = true;
      this.whale.roll(ROLL_SECONDS);
      this.flash = 1.8;
      const alt = this.whale.g.position.length() - S.R;
      this.fx.wave(this.whale.v, alt, SKY_RING, 1, GOLD);
      return "cried";
    }
    if (t < DESCEND_AT) return null;
    const { player } = this.s,
      arc = BOARD_AHEAD / S.R;
    to.copy(player.p).addScaledVector(player.h, arc).normalize();
    const lift = this.whale.bodyHalf + BELLY_CLEAR;
    this.whale.swoop(player.p as THREE.Vector3, to, HIDE.legend.descendSeconds, lift);
    this.goTo("descending");
    return "descending";
  }

  // 미스트 줄기: 내 자리에서 고래까지 알갱이가 차례로 날아간다
  private mist(t: number) {
    const share = t / MIST_SECONDS,
      steps = share * MIST_DOTS,
      shown = Math.floor(steps);
    this.whale.g.getWorldPosition(dust);
    for (let i = this.mistShown + 1; i <= shown && i < MIST_DOTS; i++) {
      const part = (i + 1) / (MIST_DOTS + 1);
      mote.copy(this.mistFrom).lerp(dust, part);
      this.fx.dot(mote, 1.1, 0.5);
    }
    this.mistShown = Math.max(this.mistShown, shown);
  }

  private leave() {
    this.whale.endParade();
    this.state = "off";
  }

  // 몸이 은은히 빛나고 금빛 테두리가 숨 쉬고(판 위에 있는 동안), 지나간 자리에 빛가루가 남는다
  private shine(dt: number) {
    const on = this.isAround;
    const want = on ? 1 : 0,
      step = dt * 1.5,
      k = Math.min(1, step);
    this.glowK += (want - this.glowK) * k;
    const fade = dt / ARRIVE_GLOW;
    const left = this.flash - fade;
    this.flash = Math.max(0, left);
    this.whale.g.getWorldPosition(dust);
    const breathPhase = this.time * GLOW_BREATH,
      breath = 0.8 + 0.2 * Math.sin(breathPhase),
      away = this.eye.position.distanceTo(dust),
      clear = (away - GLOW_OFF_WITHIN) / GLOW_FADE_SPAN,
      capped = Math.min(1, clear),
      far = Math.max(0, capped);
    const bright = 1 + this.flash;
    this.glow.material.opacity = GLOW_PEAK * this.glowK * breath * far * bright;
    this.glow.visible = this.glowK > 0.01;
    if (this.rim) {
      const rimPhase = (this.time / RIM_PERIOD) * Math.PI * 2,
        pulse = 0.5 + 0.5 * Math.sin(rimPhase);
      this.rim.visible = on;
      this.rim.opacity.value = 0.35 + 0.65 * pulse;
    }
    if (!on) return;
    this.dustT -= dt;
    if (this.dustT > 0) return;
    this.dustT = DUST_EVERY;
    const dx = (this.rand() - 0.5) * 2 * DUST_SPREAD,
      dy = (this.rand() - 0.5) * 2 * DUST_SPREAD,
      dz = (this.rand() - 0.5) * 2 * DUST_SPREAD,
      size = DUST_SIZE * (0.6 + this.rand() * 0.9);
    dust.x += dx;
    dust.y += dy;
    dust.z += dz;
    // 몸 아래쪽(행성 쪽)으로 조금 내려 뿌린다 — 지나간 자리가 땅에서도 보인다
    const sink = S.R + (dust.length() - S.R) * 0.75;
    dust.setLength(sink);
    this.fx.dot(dust, size, DUST_LIFE, GOLD);
  }
}

/* ─── 내부 ─────────────────────────── */

// 테두리 껍데기를 뺀 면 수
function countMeshes(root: THREE.Object3D): number {
  let n = 0;
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && !o.userData.isHull) n++;
  });
  return n;
}
