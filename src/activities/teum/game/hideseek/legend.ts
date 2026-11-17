import * as THREE from "three";

import { S } from "../settings";
import { offset, offsetInto } from "../world/sphere";
import type { HideFx } from "./effects";
import { HIDE } from "./tuning";

// 전설의 생물: 가장 큰 생물(고래)이 한 판에 많아야 한 번, 판 위를 낮게 천천히 가로지른다. 멀리서도 보이게 몸이 은은히 빛나고 지나간 자리에 라임 빛가루가 남는다.
// 잡는 법은 다른 생물과 같다 — 톡 친다. 다만 legend.hits 번(세 번). 머리 위 큰 물방울 셋이 맞힐 때마다 하나씩 차고 고래가 점점 크게 반응한다
// (1 몸을 떨며 빛남, 2 크게 울며 빛 고리, 3 내려와 등을 내민다). 부딪쳐서는 안 타진다.
// 다 맞히면 태워 가장 먼 숨은 상자 앞까지 데려다준다 — 그 상자는 찾은 것이 된다. 조작을 가져가는 것은 전설뿐이다(볼거리라서).
// 나올지(판마다 chance, 첫 판은 반드시)·언제(from~to 초 사이)·얼마나(staySeconds)·태워 가는 시간(rideSeconds)은 hideseek.data.json 의 legend

/** 전설의 손님이 되는 고래에게 부탁하는 것(Whale) */
export interface LegendWhale {
  /** 지금 자리(단위 벡터)와 몸(세계 자리를 읽는다) */
  readonly v: THREE.Vector3;
  readonly g: THREE.Object3D;
  readonly isRiding: boolean;
  readonly pathLeft: number;
  parade(
    from: THREE.Vector3,
    to: THREE.Vector3,
    seconds: number,
    lift: number,
    reach: number,
  ): void;
  carryTo(to: THREE.Vector3, seconds: number): void;
  board(lift: number): void;
  endParade(): void;
  keepOff(): void;
  attach(o: THREE.Object3D): void;
}

/** 이번 프레임에 일어난 일: 나타났다 · 나를 태웠다 · 데려다줬다 */
export type LegendEvent = "came" | "boarded" | "arrived";

/** 지금 하는 일: 안 나옴 · 나올 때를 기다림 · 판 위를 지나감 · 태워 감 */
type LegendState = "off" | "waiting" | "passing" | "carrying";

/** 몸의 빛: 크기(m)·가장 밝을 때·숨 쉬듯 밝아졌다 어두워지는 빠르기, 가까이 가면 옅어진다(이 거리 m 안에서는 꺼지고, 이만큼 더 멀어지면 다 켜진다 — 곁에서는 화면을 덮지 않게) */
const GLOW_SIZE = 110,
  GLOW_PEAK = 0.5,
  GLOW_BREATH = 1.3,
  GLOW_OFF_WITHIN = 60,
  GLOW_FADE_SPAN = 80;
/** 빛가루: 뿌리는 간격(초)·몸 둘레로 흩는 거리(m)·크기(m)·남아 있는 시간(초) */
const DUST_EVERY = 0.12,
  DUST_SPREAD = 16,
  DUST_SIZE = 1.6,
  DUST_LIFE = 6;

/** 물방울 표시: 크기(m)·몸 위 높이(m)·사이(m) · 맞힐 때 번쩍이는 빛의 세기 · 등을 내밀 때 내려오는 높이(땅에서 m) · 누를 수 있는 몸의 반높이·반길이(m) */
const DROP_SIZE = 6,
  DROP_OVER = 17,
  DROP_GAP = 7,
  HIT_FLASH = 1.8,
  BOARD_LIFT = 7,
  BODY_HALF_H = 9,
  BODY_HALF_L = 26;

const from = new THREE.Vector3(),
  to = new THREE.Vector3(),
  dust = new THREE.Vector3();

/** 전설의 생물 */
export class Legend {
  private state: LegendState = "off";
  /** 나타날 때(찾기 시작 뒤 초) */
  private at = 0;
  private readonly glow: THREE.Sprite;
  private glowK = 0;
  private dustT = 0;
  private time = 0;
  private readonly hub = new THREE.Vector3();
  /** 맞힌 수 · 맞힐 때 번쩍임(1 에서 줄어든다) · 머리 위 물방울 · 빈 것·찬 것 그림 */
  private hits = 0;
  private flash = 0;
  private readonly drops: THREE.Sprite[] = [];
  private readonly emptyTex: THREE.CanvasTexture;
  private readonly fullTex: THREE.CanvasTexture;

  /** eye: 보는 자리(카메라 — 가까이서는 몸의 빛을 줄인다) */
  constructor(
    private readonly whale: LegendWhale,
    private readonly fx: HideFx,
    private readonly rand: () => number,
    private readonly eye: THREE.Object3D,
  ) {
    this.glow = fx.glowSprite(GLOW_SIZE);
    whale.attach(this.glow);
    this.emptyTex = dropTexture(false);
    this.fullTex = dropTexture(true);
    const n = HIDE.legend.hits,
      mid = (n - 1) / 2;
    for (let i = 0; i < n; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.emptyTex,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        fog: false,
      });
      const sp = new THREE.Sprite(mat),
        across = (i - mid) * DROP_GAP;
      sp.position.set(0, DROP_OVER, across);
      sp.scale.setScalar(DROP_SIZE);
      sp.renderOrder = 6;
      sp.visible = false;
      whale.attach(sp);
      this.drops.push(sp);
    }
  }

  /** 지금 지나가는 중이라 칙으로 맞힐 수 있나 */
  get isCatchable(): boolean {
    return this.state === "passing" && this.hits < HIDE.legend.hits;
  }

  /** 누를 수 있는 몸(지나가는 동안): 몸 가운데(out)와 반높이·반길이(m). 없으면 null */
  body(out: THREE.Vector3): { halfH: number; halfW: number } | null {
    if (!this.isCatchable) return null;
    this.whale.g.getWorldPosition(out);
    return { halfH: BODY_HALF_H, halfW: BODY_HALF_L };
  }

  /** 칙에 맞았다: 물방울 하나가 차고 점점 크게 반응한다. 다 차면 내려와 등을 내민다. 맞힌 수 */
  hit(): number {
    if (!this.isCatchable) return this.hits;
    this.hits++;
    this.drops[this.hits - 1].material.map = this.fullTex;
    this.flash = this.hits >= 2 ? 1.6 : 1;
    const ring = 10 + this.hits * 8;
    this.fx.sonar(this.whale.v, 0, ring, 0.8);
    if (this.hits >= HIDE.legend.hits) this.whale.board(BOARD_LIFT);
    return this.hits;
  }

  /** 지금 판 위에 있나(지나가거나 태워 가는 중 — 칸 옆 표시가 깜빡인다) */
  get isAround(): boolean {
    return this.state === "passing" || this.state === "carrying";
  }

  /** 지금 나를 태워 가는 중인가(그동안 조작은 멈춘다) */
  get isCarrying(): boolean {
    return this.state === "carrying";
  }

  /** 판 시작: 이번 판에 나올지와 나올 때를 정한다(sure — 첫 판은 반드시 나온다). hub: 무대 마을 중심 */
  plan(sure: boolean, hub: THREE.Vector3) {
    this.stop();
    this.hub.copy(hub);
    this.hits = 0;
    for (const d of this.drops) d.material.map = this.emptyTex;
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
    const whale = this.whale;
    this.time += dt;
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
      if (whale.isRiding) {
        const goal = farthest();
        if (goal) {
          whale.carryTo(goal, HIDE.legend.rideSeconds);
          this.state = "carrying";
          event = "boarded";
        } else this.leave();
      } else if (whale.pathLeft <= 0) this.leave();
    } else if (whale.pathLeft <= 0 || !whale.isRiding) {
      this.leave();
      event = "arrived";
    }
    this.shine(dt);
    return event;
  }

  /** 지나가던 것을 돌려보낸다(판이 끝났다) — 태웠으면 내려 준다 */
  stop() {
    if (this.state === "passing" || this.state === "carrying") this.whale.endParade();
    this.state = "off";
  }

  /** 빛을 끈다(찾기가 끝난 뒤에도 프레임마다 부른다 — 서서히 꺼진다) */
  fade(dt: number) {
    this.shine(dt);
  }

  // 판 위로 들어선다: 무대 가운데에서 aside 만큼 비켜난 줄을, 가운데 span 밖에서 반대편 span 밖까지
  private enter() {
    const L = HIDE.legend;
    const bearing = this.rand() * 360,
      sideBearing = bearing + 90,
      backBearing = bearing + 180;
    const mid = offset(this.hub, L.aside, sideBearing);
    offsetInto(from, mid, L.span, backBearing);
    offsetInto(to, mid, L.span, bearing);
    // 닿아서는 안 태운다(칙을 다 맞혀야 등을 내민다)
    this.whale.parade(from, to, L.staySeconds, L.lift, 0);
    this.state = "passing";
  }

  private leave() {
    this.whale.endParade();
    this.state = "off";
  }

  // 몸이 은은히 빛나고(지나가거나 태워 가는 동안), 지나간 자리에 빛가루가 남는다
  private shine(dt: number) {
    const on = this.state === "passing" || this.state === "carrying";
    const want = on ? 1 : 0,
      step = dt * 1.5,
      k = Math.min(1, step);
    this.glowK += (want - this.glowK) * k;
    const fade = dt * 2.5;
    const left = this.flash - fade;
    this.flash = Math.max(0, left);
    const showDrops = this.isCatchable || (this.state === "passing" && this.hits > 0);
    for (const d of this.drops) d.visible = showDrops;
    this.whale.g.getWorldPosition(dust);
    const breathPhase = this.time * GLOW_BREATH,
      breath = 0.8 + 0.2 * Math.sin(breathPhase),
      away = this.eye.position.distanceTo(dust),
      clear = (away - GLOW_OFF_WITHIN) / GLOW_FADE_SPAN,
      capped = Math.min(1, clear),
      far = Math.max(0, capped);
    const bright = 1 + this.flash * HIT_FLASH;
    this.glow.material.opacity = GLOW_PEAK * this.glowK * breath * far * bright;
    this.glow.visible = this.glowK > 0.01;
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
    this.fx.dot(dust, size, DUST_LIFE);
  }
}

/* ─── 내부 ─────────────────────────── */

// 머리 위 물방울 그림: 빈 것은 흰 바탕, 찬 것은 라임. 먹색 테두리
function dropTexture(isFull: boolean): THREE.CanvasTexture {
  const size = 64,
    cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d");
  if (g) {
    g.beginPath();
    g.moveTo(32, 6);
    g.bezierCurveTo(44, 22, 54, 32, 54, 42);
    g.arc(32, 42, 22, 0, Math.PI);
    g.bezierCurveTo(10, 32, 20, 22, 32, 6);
    g.closePath();
    g.fillStyle = isFull ? HIDE.colors.lime : "rgba(255,255,255,0.85)";
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = HIDE.colors.ink;
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
