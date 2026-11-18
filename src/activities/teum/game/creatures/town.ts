import * as THREE from "three";

import { ease } from "../core/frame";
import { STAGE } from "../hideseek/openTuning";
import type { Services } from "../services";
import { S } from "../settings";
import { offsetInto } from "../world/sphere";
import type { Creature, Pose } from "./creature";
import type { Day } from "./days";
import { DAYS } from "./days";
import { face, go } from "./moves";
import type { PuffKind, PuffSink } from "./puffs";
import type { Act, Circle, Resident } from "./resident";
import {
  arch,
  between,
  canJoin,
  canNod,
  clearance,
  LOOK_SECONDS,
  LOOK_SWING,
  NOD_COOLDOWN,
  NOD_SAME_AGAIN,
  NOD_SECONDS,
  PLACE_REACH,
  pickChore,
  pushOut,
  ringSpot,
  ROOM_MARGIN,
  shouldGreet,
  SMOOTH,
  SNAPPY,
} from "./resident";

// 주민의 마을: 숨바꼭질 판 영역에 사는 생물(주민)을 프레임마다 움직인다. 종 이름은 보지 않는다 — 종마다의 하루·인사·버릇은 days 에게 묻는다.
// 한 프레임의 차례: 늘 도는 버릇 → 판에서 일어난 일(모이기·등 돌리기) → 나를 알아보기(인사·비켜 주기) → 힐끗거리기 →
// 지금 하는 것(하루의 한 가지·인사·까딱·반응) → 바란 몸짓으로 부드럽게 넘어가기.
// 몸짓은 "이번 프레임에 바라는 값"(W)으로 적고 끝에 한 번에 따라가게 한다 — 동작과 동작 사이가 끊기지 않는다.
// 리본 달린 물건 둘레(npc.propRoom)에는 서지도 지나가지도 않는다: 움직일 때마다 밖으로 밀어낸다(하늘 생물도)

/** 자리가 필요한 일이 찾아가는 곳의 갈래: 케이크·마카롱 · 벤치 · 큰 꽃 · 랜드마크 · 우체통 · 받침 접시 같은 것 */
export type PlaceKind = "sweet" | "bench" | "flower" | "landmark" | "mailbox" | "saucer";

/** 찾아갈 곳 하나: 자리·몸의 반지름(m)·꼭대기 높이(m, 땅에서) */
export interface Place {
  kind: PlaceKind;
  v: THREE.Vector3;
  r: number;
  top: number;
}

/** 이번 프레임에 바라는 몸짓(끝에 한 번에 따라간다) */
export interface Wants {
  /** 앞으로 숙임(음수)·뒤로 젖힘 · 옆으로 기울임(오른쪽이 +) · 보는 쪽에서 더 돌림(rad) */
  pitch: number;
  roll: number;
  yaw: number;
  /** 세로로 늘임(1 이 그대로) · 통째 부풀림(1 이 그대로) · 가라앉음(키의 몫) · 땅에서 뜬 높이(m — 땅 위 생물) */
  squash: number;
  swell: number;
  sink: number;
  lift: number;
  /** 하늘 생물이 떠 있을 높이(m, 땅에서) */
  alt: number;
  /** 구른 각(rad — 숙임에 그대로 더한다, 따라가지 않고 바로) */
  tumble: number;
  /** 따라가는 빠르기(1/초 — 탁 끊기는 몸짓은 크게) */
  rate: number;
  /** 두리번거려도 되나(몸짓이 고개를 맡으면 false) · 날개를 쉬나(내려앉아 쉴 때) · 통통 뛰는 걸음을 쉬나(살금살금 걷는 버릇) */
  isFree: boolean;
  isCalm: boolean;
  isGliding: boolean;
}

/** 마을이 보는 다른 것들 */
export interface TownLinks {
  /** 만났다(판이 돌지 않을 때 인사를 받으면) */
  meet(c: Creature): void;
}

/** 찾아갈 곳으로 치는 모델(에셋 키 → 갈래·몸 반지름 m·꼭대기 높이 m) */
const PLACE_MODELS: Readonly<Record<string, readonly [PlaceKind, number, number]>> = {
  d_cake: ["sweet", 2.2, 3],
  d_macaron: ["sweet", 2, 2],
  cake: ["sweet", 3, 4],
  macaron: ["sweet", 2.4, 2.4],
  candycart: ["sweet", 2.4, 3],
  gumdrops: ["sweet", 2, 1.6],
  petalbench: ["bench", 1.8, 1],
  sofa: ["bench", 2, 1.2],
  busstop: ["bench", 2, 2.6],
  picnic: ["bench", 2.2, 1],
  flower_pink: ["flower", 1.6, 5],
  flower_blue: ["flower", 1.6, 5],
  d_smileflower: ["flower", 1.6, 3],
  smileflower: ["flower", 2, 4],
  d_flowerpile: ["flower", 2, 2],
  flowerpile: ["flower", 2.4, 2.4],
  wishtree: ["landmark", 5, 9],
  mailbox: ["mailbox", 0.8, 2.2],
  d_teacup: ["saucer", 1.6, 1.4],
  teacup: ["saucer", 2.4, 2],
  bathtub: ["saucer", 2, 1.2],
};

/** 걷기의 좌우 뒤뚱(rad) */
const WADDLE = 0.07;
/** 길을 비켜 줄 때의 걸음(m/s) · 비켜 준 것으로 치는 여유(m) · 비켜서는 한 걸음(m) */
const YIELD_SPEED = 1.9,
  YIELD_EXTRA = 0.8,
  YIELD_STEP = 4;
/** 한 상자를 다음 주민이 힐끗거리기까지 띄우는 시간(초, 앞의 힐끗이 끝난 뒤) · 차례를 놓친 주민이 다시 기다리는 시간(초, 이 사이) */
const PEEK_APART = 2.5,
  PEEK_TURN_MIN = 3,
  PEEK_TURN_MAX = 6;
/** 들켰을 때 딴청 부리는 시간(초) · 내가 그쪽을 본다고 치는 각의 코사인(약 33도) */
const CAUGHT_SECONDS = 1.4,
  LOOKING_COS = 0.84;
/** 찾았을 때 폴짝거리는 시간(초)과 세기(m/s) · 꽝일 때 갸웃하는 시간(초) · 웃음을 참는 시간(초) */
const CHEER_SECONDS = 0.8,
  CHEER_HOP = 3.3,
  PUZZLE_SECONDS = 1.3,
  GIGGLE_SECONDS = 1.5;
/** 날아가는 상자를 눈으로 쫓는 거리(m) · 상자가 이만큼(m)도 안 움직인 채 이 시간(초)이 지나면 쫓기를 그만둔다 */
const WATCH_REACH = 30,
  BOX_MOVED = 0.05,
  WATCH_TIMEOUT = 3;
/** 쳐다보기(look)의 단계: 날아가는 상자를 쫓는 중 */
const TRACKING = 1;
/** "꼭꼭 숨어라" 때 등을 돌리는 주민: 광장 가운데에서 이 안(m) · 돌아서는 시간(초) */
const AWAY_REACH = 45,
  TURN_BACK = 0.6;
/** 금색 상자를 둘러서는 반지름(m)·둘째 겹까지의 간격(m)·내가 선 자리에서 비워 두는 거리(m)·달려가는 빠르기와 날아가는 빠르기(m/s)·하늘 생물이 떠 있는 높이(m) */
const GATHER_RING = 7.5,
  GATHER_ROW = 2.6,
  GATHER_ME = 2.2,
  GATHER_SPEED = 3.2,
  GATHER_FLIGHT = 4.5,
  GATHER_ALT = 2.6;
/** 서로 겹쳐 서지 않는 거리(m): 걷는 것끼리 · 둘러설 때 · 자리를 옮기지 않는 것(버섯) 곁 */
const APART = 1.5,
  APART_CROWD = 1.1,
  APART_ROOTED = 2.6;
/** 장미가 붉어지는 거리(m)와 다시 붉어지기까지(초) */
const BLUSH_REACH = 3,
  BLUSH_AGAIN = 8;
/** 랜드마크·조형물은 이만큼 떨어져 지나간다(m) */
const PLACE_ROOM = 1;
/** 판 영역 밖의 것도 찾아갈 곳으로 치는 여유(m) */
const PLACE_BEYOND = 25;
/** 길이 막혔다고 치는 시간(초) · 물건을 끼고 도는 쪽을 지키는 시간(초, 마지막으로 닿은 뒤) */
const STUCK_SECONDS = 1.2,
  HAND_SECONDS = 1.5;
/** 내가 판 영역에서 이보다 멀면 주민끼리의 일을 세지 않는다(m) */
const TOWN_AWAKE = 320;
/** 날개 달린 것은 걸음 수를 세지 않는다(날갯짓은 따로 돈다) */
const FLAP_STRIDE = 0.001;
/** 같이 차렷하는 제 무리까지의 거리(m) */
const DRILL_REACH = 10;
/** 이보다 먼 둘은 재지 않는다(내적 — 약 6m) */
const NEAR_COS = 0.99993;
/**
 * 멈춰 있다고 치는 기준: 몸짓이 1초에 이만큼(rad·배율을 더한 값)도 안 바뀌고, 자리도 이만큼(단위 벡터 거리의 제곱 — 약 2mm)도 안 옮겼다 ·
 * npc.stillMax 의 이 몫에 닿으면 꼼지락거린다 · 그때의 작은 폴짝(m/s)
 */
const STIR_RATE = 0.06,
  MOVED_SQ = 1.5e-11,
  STILL_SHARE = 0.8,
  FIDGET_HOP = 1.6;
/** 주민이 아닌 생물이 판 영역에 들어왔는지 볼 때 반경에 더 두는 여유(m) */
const STAGE_RIM = 6;
/** 내리막으로 치는 낙차(m)와 재 보는 거리(m) */
const SLOPE_DROP = 0.6,
  SLOPE_REACH = 6;

/** 정반대를 본다고 치는 내적 · 그때 먼저 트는 각(rad) */
const OPPOSITE = -0.98,
  UNSTICK_TURN = 0.3;

const at = new THREE.Vector3(),
  turnTo = new THREE.Vector3(),
  dir = new THREE.Vector3(),
  side = new THREE.Vector3(),
  spot = new THREE.Vector3(),
  view = new THREE.Vector3(),
  shove = new THREE.Vector3();

/** 주민의 마을 */
export class Town {
  /** 주민(판에 부른 생물) */
  readonly folk: Creature[] = [];
  /** 이번 프레임에 바라는 몸짓 */
  readonly W: Wants = {
    pitch: 0,
    roll: 0,
    yaw: 0,
    squash: 1,
    swell: 1,
    sink: 0,
    lift: 0,
    alt: 0,
    tumble: 0,
    rate: SMOOTH,
    isFree: true,
    isCalm: false,
    isGliding: false,
  };
  dt = 0;
  time = 0;
  /** 나의 자리와 빠르기(m/s) */
  readonly p: THREE.Vector3;
  pspd = 0;
  /** 리본 달린 물건(가장자리까지의 반지름) — 열쇠가 하나씩 살펴본다 */
  readonly props: Circle[] = [];
  /** 판 영역의 가운데와 반경(m) · 판 영역 안인지 가리는 내적(가운데와의) */
  readonly hub = new THREE.Vector3(0, 1, 0);
  radius = 70;
  private stageCos = 1;
  private isReactive = true;
  /** 서지도 지나가지도 않는 자리: 리본 달린 물건 둘레 · 랜드마크와 조형물 */
  private readonly avoid: Circle[] = [];
  private readonly solid: Circle[] = [];
  private readonly places: Place[] = [];
  private hasPlaces = false;
  /** 상자가 숨어 있는 물건들의 자리 */
  private readonly hiding: THREE.Vector3[] = [];
  private hidingN = 0;
  private isAway = false;
  private isGathering = false;
  private readonly gatherAt = new THREE.Vector3();
  /** 날아가는 상자(세계 자리 — 숨바꼭질이 매 프레임 고친다)와 그 바로 밑 땅의 자리 · 지난번에 본 자리와 그 뒤 멈춰 있은 시간(초) */
  private box: THREE.Vector3 | null = null;
  private readonly boxOver = new THREE.Vector3();
  private readonly boxLast = new THREE.Vector3();
  private boxStill = 0;
  /** 숨은 상자마다: 누가 힐끗거리는 중이면 그것이 끝나고 한숨 돌릴 때까지의 시각(초) — 한 상자를 여럿이 한꺼번에 힐끗거리지 않는다 */
  private readonly peekFreeAt: number[] = [];
  private squads = 0;
  private readonly can: boolean[] = [true, true, true];

  constructor(
    private readonly s: Services,
    private readonly links: TownLinks,
    private readonly puffs: PuffSink,
  ) {
    this.p = s.player.p;
  }

  /* ─── 판이 부르는 것 ─────────────────────────── */

  /** 주민으로 들인다 */
  add(c: Creature) {
    this.folk.push(c);
  }

  /** 판 영역: 가운데·반경과 리본 달린 물건(자리와 반지름 m) — 그 둘레 room(m) 안에는 서지도 지나가지도 않는다 */
  setStage(hub: THREE.Vector3, radius: number, keepOff: readonly Circle[], room: number) {
    this.hub.copy(hub).normalize();
    this.radius = radius;
    const rim = (radius + STAGE_RIM) / S.R;
    this.stageCos = Math.cos(rim);
    this.findPlaces();
    this.props.length = 0;
    this.avoid.length = 0;
    for (const k of keepOff) {
      const v = k.v.clone().normalize(),
        keepOut = k.r + room + ROOM_MARGIN;
      this.props.push({ v, r: k.r });
      this.avoid.push({ v, r: keepOut });
    }
  }

  /**
   * 주민이 아닌 생물도 리본 달린 물건 둘레에는 서지 않는다(판 영역에 들어왔을 때만 본다 — 줄지어 따라오다 판이 시작돼 집으로 가는 손님 등).
   * 물건을 가려 못 누르게 하면 안 된다
   */
  fend(c: Creature) {
    if (!this.avoid.length || c.v.dot(this.hub) < this.stageCos) return;
    if (pushOut(c.v, this.avoid, 0)) this.upright(c);
  }

  /** 새 무리 번호(같이 앉은 무리끼리는 까딱하지 않고, 병정은 무리로 움직인다) */
  newSquad(): number {
    this.squads++;
    return this.squads;
  }

  /** 주민을 그 자리에 새로 살게 한다(판 시작): 하던 것을 잊고, 서면 안 되는 자리면 밖으로 옮긴다 */
  settle(c: Creature, seat: THREE.Vector3, squad: number, slot: number, size: number, alt: number) {
    const r = c.res;
    if (!r) return;
    this.clear(c.v, 0);
    c.home.copy(c.v);
    r.seat.copy(seat);
    r.squad = squad;
    r.slot = slot;
    r.size = size;
    r.alt = alt;
    r.act = "chore";
    r.actT = 0;
    r.actFor = 0;
    r.chore = -1;
    r.choreT = 0;
    r.choreAge = 0;
    r.step = 0;
    r.stepT = 0;
    r.mate = null;
    r.lead = null;
    r.greetCd = c.rng.range(0, 3);
    r.nodCd = c.rng.range(2, 8);
    r.nodWith = null;
    r.peekWait = this.nextPeek(c);
    r.stillT = 0;
    r.actU = 0;
    r.actStep = 0;
    r.actClock = 0;
    r.actBeat = 0;
    r.tick = c.rng.range(2, 6);
    r.quirkCd = c.rng.range(6, 14);
    r.stuckT = 0;
    r.hand = 0;
    r.handT = 0;
    r.lift = 0;
    r.wobble = 0;
    r.late = 0;
    r.lean = 0;
    r.spin = 0;
    r.bold = 0;
    r.isGliding = false;
    r.isPerching = false;
    c.swell = 1;
    c.squash = 1;
    c.yaw = 0;
    c.roll = 0;
    c.pitch = 0;
    c.sink = 0;
    c.hop = 0;
    c.hopV = 0;
  }

  /** "꼭꼭 숨어라" 동안 광장 근처 주민이 눈을 가리듯 등을 돌린다 · 끝나면 돌아선다 */
  turnAway(on: boolean) {
    this.isAway = on;
    this.box = null;
  }

  /** 상자를 찾았다: 가까운 주민이 일제히 그쪽을 보고 좋아한다(종은 제일 먼저) */
  cheer(where: THREE.Vector3) {
    const N = STAGE.npc;
    for (const c of this.folk) {
      const r = c.res!;
      if (!this.isOpen(c, r)) continue;
      const far = this.dist(c.v, where),
        isCrier = DAYS[c.k].isCrier === true,
        reach = isCrier ? N.cheerReach * 2 : N.cheerReach;
      if (far > reach) continue;
      this.act(r, "cheer", CHEER_SECONDS, where);
      r.late = isCrier ? 0 : 0.08 + 0.1 * c.rng.next();
    }
  }

  /** 꽝을 열었다: 가까운 주민이 힐끗 보고 갸웃한다. 그중 가장 가까운 하나는 돌아서서 웃음을 참는다 */
  puzzle(where: THREE.Vector3) {
    let joker: Creature | null = null,
      least = Infinity;
    for (const c of this.folk) {
      const r = c.res!;
      if (!this.isOpen(c, r)) continue;
      const far = this.dist(c.v, where);
      if (far > STAGE.npc.puzzleReach) continue;
      this.act(r, "puzzle", PUZZLE_SECONDS, where);
      r.late = 0.25 * c.rng.next();
      // 한쪽으로 갸웃(생물마다 정해진 쪽)
      r.actU = c.an.x > 3.14 ? 1 : -1;
      if (far < least && !DAYS[c.k].isRooted) {
        least = far;
        joker = c;
      }
    }
    if (joker) this.act(joker.res!, "giggle", GIGGLE_SECONDS, where);
  }

  /**
   * 메롱 이사: 날아가는 상자(세계 자리)를 눈으로 쫓는다 · null 이면 그만.
   * 그만하라는 말이 오지 않아도 상자가 몇 초 멈춰 있으면(내려앉았다) 스스로 그만둔다
   */
  watch(box: THREE.Vector3 | null) {
    if (box !== this.box) this.boxStill = 0;
    this.box = box;
    if (box) this.boxLast.copy(box);
  }

  /** 상자가 숨어 있는 물건들의 자리 — 곁의 주민이 가끔 힐끗거린다 */
  setHiding(spots: readonly THREE.Vector3[]) {
    while (this.hiding.length < spots.length) {
      const slot = new THREE.Vector3();
      this.hiding.push(slot);
      this.peekFreeAt.push(0);
    }
    this.hidingN = spots.length;
    for (let i = 0; i < spots.length; i++) {
      this.hiding[i].copy(spots[i]).normalize();
      this.peekFreeAt[i] = 0;
    }
  }

  /** 넷을 다 찾았다: 금색 상자가 떨어지는 자리를 둥글게 둘러선다 */
  gather(where: THREE.Vector3) {
    this.isGathering = true;
    this.gatherAt.copy(where).normalize();
    this.box = null;
  }

  /** 판이 끝났다: 모인 것·등 돌린 것·쫓던 눈을 풀고 제 하루로 */
  release() {
    this.isGathering = false;
    this.isAway = false;
    this.box = null;
    this.hidingN = 0;
  }

  /* ─── 한 프레임 ─────────────────────────── */

  /** 프레임 처음: 시간과 나의 빠르기를 받고, 주민끼리의 일(마주치면 까딱·겹치지 않기·장미의 발그레)을 본다 */
  begin(dt: number, time: number, pspd: number, isReactive: boolean) {
    this.dt = dt;
    this.time = time;
    this.pspd = pspd;
    this.isReactive = isReactive;
    this.s.camera.camera.getWorldDirection(view);
    this.followBox();
    if (!this.folk.length || this.dist(this.p, this.hub) > TOWN_AWAKE) return;
    this.pairs();
  }

  /** 주민 하나의 한 프레임(dP: 나와의 거리 m, dA: 나와의 높이 차 m) */
  live(c: Creature, dP: number, dA: number, pose: Pose) {
    const r = c.res!,
      day = DAYS[c.k],
      dt = this.dt,
      W = this.W,
      isFlyer = c.role === "flock";
    W.pitch = 0;
    W.roll = 0;
    W.yaw = 0;
    W.squash = 1;
    W.swell = 1;
    W.sink = 0;
    W.lift = 0;
    W.alt = r.alt;
    W.tumble = 0;
    W.rate = SMOOTH;
    W.isFree = true;
    W.isCalm = false;
    W.isGliding = false;
    r.actT += dt;
    if (r.act === "chore") r.stepT += dt;
    if (r.greetCd > 0) r.greetCd -= dt;
    r.nodCd -= dt;
    if (r.quirkCd > 0) r.quirkCd -= dt;
    if (r.wobble > 0) r.wobble -= dt;
    if (r.bold > 0) r.bold -= dt;
    if (!isFlyer) c.a = this.s.terrain.groundAt(c.v);
    this.fall(c);
    day.always?.(c, r, this, pose, dP);
    this.notice(c, r, day, dP, dA);
    this.perform(c, r, day, pose, dP);
    // 걷는 것은 좌우로 뒤뚱, 뛰는 것은 통통
    const isWalking = pose.amt > 0.3 && !isFlyer && !r.isGliding && !W.isGliding;
    if (isWalking) {
      const sway = c.ph * 0.5;
      W.roll += WADDLE * Math.sin(sway);
      if (c.gait === "hop") this.hop(c, 4);
    }
    this.follow(c, r, pose, isFlyer);
  }

  /* ─── 하루가 쓰는 것 ─────────────────────────── */

  /** 두 자리 사이의 거리(m) */
  dist(a: Readonly<THREE.Vector3>, b: Readonly<THREE.Vector3>): number {
    const along = a.dot(b),
      capped = Math.min(1, along);
    return Math.acos(capped) * S.R;
  }

  /** 그쪽을 본다(rate: 도는 빠르기 1/초) */
  turn(c: Creature, to: THREE.Vector3, rate: number) {
    const k = ease(rate, this.dt),
      along = to.dot(c.v);
    // 정반대를 보고 있으면 섞어서는 돌지 못한다(두 방향의 가운데가 0 이다) — 먼저 옆으로 조금 튼다
    turnTo.copy(to).addScaledVector(c.v, -along);
    const isOpposite = turnTo.lengthSq() > 1e-12 && turnTo.normalize().dot(c.f) < OPPOSITE;
    if (isOpposite) c.f.applyAxisAngle(c.v, UNSTICK_TURN);
    face(c, to, k);
  }

  /** 걸어서 간다(남은 거리 m — 다 왔거나 길이 막혀 포기하면 0). 서면 안 되는 자리는 끼고 돈다 */
  walk(c: Creature, r: Resident, to: THREE.Vector3, speed: number, pose: Pose, stride = 4.6) {
    const left = go(c, to, speed, this.dt, stride);
    this.fence(c, r);
    const pace = 0.45 + speed / 4;
    pose.amt = Math.min(1, pace);
    return this.unstick(r, left, speed);
  }

  /** 날아서 간다(alt: 땅에서의 높이 m — 남은 거리 m). 서면 안 되는 자리는 하늘에서도 끼고 돈다 */
  wing(c: Creature, r: Resident, to: THREE.Vector3, alt: number, speed: number, pose: Pose) {
    const left = go(c, to, speed, this.dt, FLAP_STRIDE);
    this.fence(c, r);
    const pace = 0.55 + speed / 9;
    pose.amt = Math.min(1, pace);
    this.W.alt = alt;
    // 날아가는 동안은 가는 쪽을 본다(두리번은 제자리에 떠 있을 때만)
    if (left > 0.6) this.W.isFree = false;
    return this.unstick(r, left, speed);
  }

  /** 나(from)를 보며 뒷걸음으로 물러난다 — 달아나는 것이 아니라 뒤뚱뒤뚱 */
  backOff(c: Creature, from: THREE.Vector3, speed: number, pose: Pose) {
    const along = c.v.dot(from);
    dir.copy(c.v).addScaledVector(from, -along);
    if (dir.lengthSq() < 1e-12) dir.copy(c.f).negate();
    dir.normalize();
    const arc = (speed * this.dt) / S.R,
      stepLen = Math.tan(arc);
    c.v.addScaledVector(dir, stepLen).normalize();
    this.turn(c, from, 8);
    this.upright(c);
    c.ph += speed * this.dt * 4.6;
    pose.amt = 0.9;
    pushOut(c.v, this.avoid, 0);
  }

  /** 땅에 있으면 폴짝(power: 뛰는 세기 m/s) */
  hop(c: Creature, power: number) {
    if (c.hop > 0 || c.hopV > 0) return;
    c.hopV = power;
    c.hop = 0.01;
  }

  /** 다음 단계로(step 을 주면 그 단계로) */
  next(r: Resident, step = -1) {
    r.step = step < 0 ? r.step + 1 : step;
    r.stepT = 0;
    r.stuckT = 0;
  }

  /** 사는 자리 둘레 reach(m) 안의 아무 빈자리(판 영역 안, 서면 안 되는 자리 밖) */
  roam(into: THREE.Vector3, c: Creature, r: Resident, reach: number): THREE.Vector3 {
    for (let k = 0; k < 4; k++) {
      // 난수 순서: 거리 → 방향
      const roll = c.rng.next(),
        far = reach * Math.sqrt(roll),
        bearing = 360 * c.rng.next();
      offsetInto(into, r.seat, far, bearing);
      if (this.dist(into, this.hub) < this.radius - 2) break;
      into.copy(r.seat);
    }
    return this.clear(into, 0.4);
  }

  /** of 에서 gap(m) 떨어진, 내 쪽 자리(서면 안 되는 자리 밖) */
  beside(into: THREE.Vector3, of: THREE.Vector3, c: Creature, gap: number): THREE.Vector3 {
    const along = c.v.dot(of);
    dir.copy(c.v).addScaledVector(of, -along);
    if (dir.lengthSq() < 1e-12) dir.copy(c.f);
    dir.normalize();
    const arc = gap / S.R,
      reach = Math.tan(arc);
    into.copy(of).addScaledVector(dir, reach).normalize();
    return this.clear(into, 0.3);
  }

  /** from 에서 toward(땅과 나란한 방향)로 far(m) 간 자리(서면 안 되는 자리 밖) */
  ahead(into: THREE.Vector3, from: THREE.Vector3, toward: THREE.Vector3, far: number) {
    const arc = far / S.R,
      reach = Math.tan(arc);
    into.copy(from).addScaledVector(toward, reach).normalize();
    return this.clear(into, 0.3);
  }

  /** 자리 하나를 서도 되는 데로 옮긴다(room: 더 두는 여유 m) */
  clear(v: THREE.Vector3, room = 0.3): THREE.Vector3 {
    pushOut(v, this.avoid, room);
    pushOut(v, this.solid, room);
    return v;
  }

  /** c 에게서 reach(m) 안의 가장 가까운 다른 주민 가운데 fits 에 맞는 것(없으면 null) */
  find(
    c: Creature,
    reach: number,
    fits: (other: Creature, self: Creature) => boolean,
  ): Creature | null {
    let best: Creature | null = null,
      least = reach;
    for (const other of this.folk) {
      if (other === c || other.st === "guide" || other.gone) continue;
      const far = this.dist(c.v, other.v);
      if (far >= least || !fits(other, c)) continue;
      least = far;
      best = other;
    }
    return best;
  }

  /** c 에게서 reach(m) 안의 fits 에 맞는 다른 주민 가운데 skip 번째(목록 차례 — 돌아가며 고를 때. 없으면 null) */
  nth(
    c: Creature,
    reach: number,
    skip: number,
    fits: (other: Creature, self: Creature) => boolean,
  ): Creature | null {
    let count = 0;
    for (const other of this.folk) if (this.isIn(c, other, reach) && fits(other, c)) count++;
    if (!count) return null;
    let want = Math.abs(skip) % count;
    for (const other of this.folk) {
      if (!this.isIn(c, other, reach) || !fits(other, c)) continue;
      if (want === 0) return other;
      want--;
    }
    return null;
  }

  /** c 에게서 20m 안의 가장 가까운 그런 곳(없으면 null — 그 일은 건너뛴다) */
  place(c: Creature, kind: PlaceKind): Place | null {
    let best: Place | null = null,
      least = PLACE_REACH;
    for (const place of this.places) {
      if (place.kind !== kind) continue;
      const far = this.dist(c.v, place.v) - place.r;
      if (far >= least) continue;
      least = far;
      best = place;
    }
    return best;
  }

  /** c 둘레에 굴러 내려갈 내리막이 있으면 그 아래 자리를 into 에 담고 true */
  downhill(into: THREE.Vector3, c: Creature): boolean {
    const terrain = this.s.terrain,
      here = terrain.groundAt(c.v);
    let lowest = here - SLOPE_DROP,
      found = false;
    for (let k = 0; k < 8; k++) {
      const bearing = k * 45;
      offsetInto(spot, c.v, SLOPE_REACH, bearing);
      const ground = terrain.groundAt(spot);
      if (ground >= lowest) continue;
      lowest = ground;
      into.copy(spot);
      found = true;
    }
    if (found) this.clear(into, 0.3);
    return found;
  }

  /** 그 자리의 땅 높이(m) */
  groundAt(v: THREE.Vector3): number {
    return this.s.terrain.groundAt(v);
  }

  /** 제자리에서 한 바퀴 돈다(k: 0..1 — 다 돌면 처음 방향 그대로라 이음매가 없다) */
  spinOnce(c: Creature, k: number) {
    const capped = Math.max(0, k),
      turn = capped >= 1 ? 0 : capped * Math.PI * 2;
    c.yaw = turn;
    this.W.yaw = turn;
    this.W.isFree = false;
  }

  /** 내 머리 높이를 c 가 선 땅에서 잰 값(m) — 내 둘레를 도는 하늘 생물이 맞춰 뜬다 */
  myHeight(c: Creature): number {
    const mine = this.s.player.P.length() - S.R;
    return mine - this.s.terrain.groundAt(c.v);
  }

  /** 효과 하나: c 의 몸 가운데에서 위로 up(m)·앞으로 forward(m) 자리에서 */
  puff(kind: PuffKind, c: Creature, up: number, forward = 0) {
    if (!c.visible) return;
    at.copy(c.pos).addScaledVector(c.v, up).addScaledVector(c.f, forward);
    this.puffs.emit(kind, at, c.v);
  }

  /** 체리 하나가 c 의 머리에서 앞으로 톡 떨어져 땅에 남는다 */
  dropBerry(c: Creature) {
    if (!c.visible) return;
    const top = c.batch.hh * 0.9,
      floor = S.R + c.a + 0.25;
    at.copy(c.pos).addScaledVector(c.v, top);
    shove.copy(c.f).multiplyScalar(1.6);
    this.puffs.emit("berry", at, c.v, shove, floor);
  }

  /** 다른 주민을 내 무리 일에 끼워도 되나(제 하루를 사는 중이고, 제 일을 막 시작한 것이 아니다) */
  isFree(m: Creature): boolean {
    const r = m.res;
    return r !== null && m.st !== "guide" && canJoin(r, STAGE.npc.choreSeconds[0]);
  }

  /** 다른 주민을 내 무리 일에 끼운다(끼워도 될 때만): chore 번째 일을 seconds 초, 차례 slot. 끼웠으면 true */
  enlist(m: Creature, lead: Creature, chore: number, slot: number, seconds: number): boolean {
    const r = m.res;
    if (!r || !this.isFree(m)) return false;
    r.chore = chore;
    r.choreT = seconds;
    r.choreAge = 0;
    r.lead = lead;
    r.mate = null;
    r.slot = slot;
    r.n = 0;
    r.isGliding = false;
    r.isPerching = false;
    this.next(r, 0);
    return true;
  }

  /** 다른 주민이 반응하게 한다(한가할 때만): 폴짝 좋아하기(joy)·쳐다보기(look). 했으면 true */
  cue(m: Creature, act: "joy" | "look", seconds: number, toward: THREE.Vector3): boolean {
    const r = m.res;
    if (!r || m.st === "guide" || (r.act !== "chore" && r.act !== "yield")) return false;
    this.act(r, act, seconds, toward);
    return true;
  }

  /** c 둘레 reach(m) 안의 주민이 한 번씩 그쪽을 쳐다본다(종소리) */
  callEyes(c: Creature, reach: number) {
    for (const other of this.folk) {
      if (other === c || this.dist(c.v, other.v) > reach) continue;
      this.cue(other, "look", 1.1, c.v);
    }
  }

  /** 버릇 몸짓을 시작한다(seconds: 0 이면 버릇이 스스로 끝낸다) */
  quirk(r: Resident, seconds: number, toward: THREE.Vector3) {
    this.act(r, "quirk", seconds, toward);
  }

  /** 하루의 일을 여기서 끝낸다(다음 프레임에 다른 일을 고른다) */
  finish(r: Resident) {
    r.choreT = 0;
  }

  /** 지금 "꼭꼭 숨어라"(등 돌리기)나 모이기 중인가 — 그동안은 버릇을 부리지 않는다 */
  get isBusy(): boolean {
    return this.isAway || this.isGathering;
  }

  /** 내가 c 쪽을 보고 있나(화면 가운데 쪽에 c 가 있다) */
  isWatched(c: Creature): boolean {
    dir.copy(c.pos).sub(this.s.camera.camera.position).normalize();
    return dir.dot(view) > LOOKING_COS;
  }

  /* ─── 내부 ─────────────────────────── */

  // 지금 하는 것을 바꾼다. 인사·반응·버릇은 제 값(act…)만 쓴다 — 하던 일의 값은 그대로 남아 끝나면 거기서 이어 간다
  private act(r: Resident, act: Act, seconds: number, toward: THREE.Vector3 | null) {
    r.act = act;
    r.actT = 0;
    r.actFor = seconds;
    r.late = 0;
    r.actU = 0;
    r.actStep = 0;
    r.actClock = 0;
    if (toward) r.actAim.copy(toward);
  }

  // 반응할 수 있나(숨바꼭질이 맡아 옮기는 중이거나 모이는 중이 아니다)
  private isOpen(c: Creature, r: Resident): boolean {
    return c.st !== "guide" && !c.gone && r.act !== "gather" && r.act !== "away";
  }

  // other 가 c 에게서 reach(m) 안의, 지금 판에 있는 다른 주민인가
  private isIn(c: Creature, other: Creature, reach: number): boolean {
    if (other === c || other.st === "guide" || other.gone) return false;
    return this.dist(c.v, other.v) < reach;
  }

  // 폴짝 뛴 것은 떨어진다(하늘 생물도 제 높이에서 폴짝했다가 돌아온다)
  private fall(c: Creature) {
    if (c.hop <= 0 && c.hopV <= 0) return;
    c.hop += c.hopV * this.dt;
    c.hopV -= 22 * this.dt;
    if (c.hop <= 0) {
      c.hop = 0;
      c.hopV = 0;
    }
  }

  // 판에서 일어난 일과 나를 알아보기: 모이기 → 등 돌리기 → 인사 → 비켜 주기 → 날아가는 상자 쫓기 → 힐끗거리기
  private notice(c: Creature, r: Resident, day: Day, dP: number, dA: number) {
    const N = STAGE.npc;
    if (this.isGathering) {
      if (r.act !== "gather") this.act(r, "gather", 0, this.gatherAt);
      return;
    }
    if (this.isAway && this.dist(c.v, this.hub) < AWAY_REACH) {
      if (r.act !== "away") this.act(r, "away", 0, this.p);
      return;
    }
    const isIdle = r.act === "chore" || r.act === "yield" || r.act === "look";
    if (!isIdle) return;
    if (shouldGreet(dP, dA, r.greetCd, N.greetReach)) {
      this.greetTogether(c, r, day);
      return;
    }
    if (r.act !== "chore") return;
    const isClose = dP < N.yieldReach && Math.abs(dA) < 4;
    if (isClose && !day.isRooted && r.bold <= 0) {
      this.act(r, "yield", 0, this.p);
      return;
    }
    if (this.box && this.dist(c.v, this.boxOver) < WATCH_REACH) {
      this.act(r, "look", 0, this.boxOver);
      r.actStep = TRACKING;
      return;
    }
    this.peekSoon(c, r);
  }

  // 숨은 상자 곁(npc.peekReach)에 있는 동안 npc.peekEvery 초에 한 번 힐끗거린다.
  // 기다리는 시간은 곁에 있는 동안만 준다(멀리 있을 때는 멈춘다) — 판이 시작되자마자 다 같이 힐끗거리지 않고, 첫 힐끗도 그만큼 기다린다.
  // 한 상자를 둘이 한꺼번에 보지도 않는다
  private peekSoon(c: Creature, r: Resident) {
    const at = this.hidingN ? this.nearHiding(c) : -1;
    if (at < 0) return;
    r.peekWait -= this.dt;
    if (r.peekWait > 0) return;
    if (this.time < this.peekFreeAt[at]) {
      r.peekWait = c.rng.range(PEEK_TURN_MIN, PEEK_TURN_MAX);
      return;
    }
    const seconds = STAGE.npc.peekSeconds;
    r.peekWait = this.nextPeek(c);
    this.peekFreeAt[at] = this.time + seconds + PEEK_APART;
    this.act(r, "peek", seconds, this.hiding[at]);
  }

  // 다음 힐끗까지(초): npc.peekEvery 사이 아무 때
  private nextPeek(c: Creature): number {
    const every = STAGE.npc.peekEvery;
    return c.rng.range(every[0], every[1]);
  }

  // 날아가는 상자를 따라간다. 상자가 한동안 움직이지 않으면(내려앉았는데 그만하라는 말이 안 왔다) 쫓기를 그만둔다
  private followBox() {
    const box = this.box;
    if (!box) return;
    if (box.distanceTo(this.boxLast) > BOX_MOVED) {
      this.boxLast.copy(box);
      this.boxStill = 0;
    } else this.boxStill += this.dt;
    if (this.boxStill > WATCH_TIMEOUT) {
      this.box = null;
      return;
    }
    this.boxOver.copy(box).normalize();
  }

  // 인사를 시작한다. 무리로 움직이는 종(병정)은 곁의 제 무리도 같이 차렷한다(맨 끝은 반 박자 늦게)
  private greetTogether(c: Creature, r: Resident, day: Day) {
    this.act(r, "greet", 0, this.p);
    if (!day.isDrilled || !r.squad) return;
    for (const m of this.folk) {
      const q = m.res!;
      if (m === c || q.squad !== r.squad || m.st === "guide") continue;
      const isIdle = q.act === "chore" || q.act === "yield" || q.act === "look";
      if (!isIdle || this.dist(c.v, m.v) > DRILL_REACH) continue;
      this.act(q, "greet", 0, this.p);
    }
  }

  // 지금 하는 것을 한다
  private perform(c: Creature, r: Resident, day: Day, pose: Pose, dP: number) {
    const N = STAGE.npc,
      W = this.W,
      isFlyer = c.role === "flock",
      isOver = r.actFor > 0 && r.actT >= r.actFor + r.late;
    switch (r.act) {
      case "chore":
        this.chore(c, r, day, pose);
        return;
      case "greet": {
        if (!day.isOwnGreet) this.turn(c, this.p, 6);
        pose.head = 0.6;
        W.isFree = false;
        if (!day.greet(c, r, this, pose)) return;
        r.greetCd = N.greetCooldown;
        if (this.isReactive) this.links.meet(c);
        this.rest(r);
        day.afterGreet?.(c, r, this);
        return;
      }
      case "yield": {
        // 달아나는 것이 아니라 한 걸음 옆으로 — 내가 가는 길 밖으로 비스듬히 물러선다
        this.aside(c);
        if (isFlyer) this.wing(c, r, spot, r.alt, YIELD_SPEED, pose);
        else this.walk(c, r, spot, YIELD_SPEED, pose);
        if (dP > N.yieldReach + YIELD_EXTRA) this.rest(r);
        return;
      }
      case "nod": {
        this.turn(c, r.actAim, 7);
        const dip = between(r.actT, 0.45, 0.85);
        W.pitch = -0.4 * arch(dip);
        W.isFree = false;
        if (isOver) this.rest(r);
        return;
      }
      case "peek": {
        // 몸은 두고 고개만: 보고 → 딴 데 보고 → 다시 본다
        const isAside = r.actT > 0.75 && r.actT < 1.1,
          toward = this.bearingTo(c, r.actAim),
          glance = clampTo(toward, 1.1);
        W.yaw = isAside ? -0.4 * Math.sign(glance) : glance;
        W.pitch = isAside ? 0 : -0.14;
        W.rate = SNAPPY * 0.5;
        W.isFree = false;
        pose.head = 0.7;
        if (dP < N.caughtReach && this.isWatched(c)) {
          this.act(r, "caught", CAUGHT_SECONDS, r.actAim);
          this.hop(c, 3);
        } else if (isOver) this.rest(r);
        return;
      }
      case "caught": {
        // 깜짝 놀라 반대쪽을 보며 딴청: 하늘을 보고 몸을 흔들흔들
        const toward = this.bearingTo(c, r.actAim),
          awayTurn = toward > 0 ? toward - Math.PI : toward + Math.PI,
          swayPhase = this.time * 5;
        W.yaw = clampTo(awayTurn, 2.2);
        W.pitch = 0.22;
        W.roll = 0.12 * Math.sin(swayPhase);
        W.squash = r.actT < 0.25 ? 1.12 : 1;
        W.rate = SNAPPY * 0.5;
        W.isFree = false;
        if (isOver) this.rest(r);
        return;
      }
      case "cheer": {
        if (r.actT < r.late) return;
        this.turn(c, r.actAim, 9);
        pose.head = 0.8;
        W.isFree = false;
        const k = (r.actT - r.late) / CHEER_SECONDS;
        if (isFlyer) {
          // 하늘 생물은 한 바퀴 돈다(종은 딸랑딸랑 흔들며)
          const swing = this.time * 17;
          this.spinOnce(c, k);
          pose.amt = 1;
          W.alt = r.alt + 1.2;
          if (day.isCrier) W.roll = 0.55 * Math.sin(swing);
        } else {
          this.hop(c, CHEER_HOP);
          W.squash = c.hop > 0.15 ? 1.1 : 0.95;
        }
        if (isOver) this.rest(r);
        return;
      }
      case "puzzle": {
        if (r.actT < r.late) return;
        const toward = this.bearingTo(c, r.actAim);
        W.yaw = clampTo(toward, 1.2);
        W.roll = 0.34 * r.actU;
        W.isFree = false;
        pose.head = 0.6;
        if (isOver) this.rest(r);
        return;
      }
      case "giggle": {
        // 뒤로 돌아 어깨를 들썩인다
        const shake = this.time * 30;
        at.copy(c.v).multiplyScalar(2).sub(r.actAim).normalize();
        this.turn(c, at, 8);
        W.squash = 1 + 0.05 * Math.sin(shake);
        W.pitch = -0.18;
        W.rate = SNAPPY;
        W.isFree = false;
        if (isOver) this.rest(r);
        return;
      }
      case "look": {
        // 날아가는 상자를 쫓는 중이면 상자가 내려앉을 때까지 고개가 따라 돈다(몸도 천천히 그쪽으로)
        const isTracking = r.actStep === TRACKING && r.actFor === 0;
        if (isTracking && this.box) r.actAim.copy(this.boxOver);
        if (isTracking) this.turn(c, r.actAim, 2.5);
        const toward = this.bearingTo(c, r.actAim);
        W.yaw = clampTo(toward, 1.5);
        W.pitch = 0.2;
        W.rate = SMOOTH * 1.4;
        W.isFree = false;
        pose.head = 0.9;
        if (isOver || (isTracking && !this.box)) this.rest(r);
        return;
      }
      case "joy": {
        const isDone = day.joy ? day.joy(c, r, this, pose) : this.hopForJoy(c, r);
        if (isDone) this.rest(r);
        return;
      }
      case "away":
        this.hideEyes(c, r);
        return;
      case "gather":
        this.circle(c, r, day, pose, isFlyer);
        return;
      case "quirk": {
        W.isFree = false;
        const isDone = day.quirk ? day.quirk(c, r, this, pose) : true;
        if (isDone || isOver) this.rest(r);
        return;
      }
    }
  }

  // 하던 하루로 돌아간다
  private rest(r: Resident) {
    r.act = "chore";
    r.actT = 0;
    r.actFor = 0;
    r.late = 0;
    r.stuckT = 0;
  }

  // 하루: 한 가지를 8~20초 하고 다음으로. 무리로 움직이는 종은 맨 앞이 고르고 나머지는 따라 한다
  private chore(c: Creature, r: Resident, day: Day, pose: Pose) {
    const lead = r.lead;
    if (lead && (lead.st === "guide" || !lead.res || lead.res.chore !== r.chore)) r.choreT = 0;
    if (r.chore < 0 || r.choreT <= 0) this.pick(c, r, day);
    r.choreT -= this.dt;
    r.choreAge += this.dt;
    if (r.chore >= 0) day.chores[r.chore].run(c, r, this, pose);
  }

  // 다음 일을 고른다: 자리·짝이 20m 안에 없는 일은 건너뛴다
  private pick(c: Creature, r: Resident, day: Day) {
    const last = r.chore;
    r.lead = null;
    r.mate = null;
    r.isGliding = false;
    r.isPerching = false;
    r.choreAge = 0;
    r.n = 0;
    r.mark = 0;
    r.clock = 0;
    this.next(r, 0);
    // 무리로 움직이는 종은 맨 앞이 하는 일을 같이 한다(맨 앞이 아직 못 골랐으면 기다린다, 맨 앞이 없으면 저마다)
    const leader = day.isDrilled && r.slot > 0 ? this.leaderOf(c, r) : null;
    if (leader) {
      const q = leader.res!;
      r.chore = -1;
      r.choreT = 0;
      if (q.chore >= 0 && q.act === "chore") this.enlist(c, leader, q.chore, r.slot, q.choreT);
      return;
    }
    const can = this.can;
    for (let i = 0; i < can.length; i++) {
      const chore = day.chores[i];
      can[i] = chore.can ? chore.can(c, r, this) : true;
    }
    const roll = c.rng.next(),
      seconds = STAGE.npc.choreSeconds;
    r.chore = pickChore(can, last, roll);
    r.choreT = c.rng.range(seconds[0], seconds[1]);
    if (r.chore < 0) return;
    day.chores[r.chore].begin?.(c, r, this);
    if (!day.isDrilled || !r.squad) return;
    for (const m of this.folk) {
      const q = m.res!;
      if (m === c || q.squad !== r.squad) continue;
      this.enlist(m, c, r.chore, q.slot, r.choreT);
    }
  }

  // 내 무리의 맨 앞(가까이 있고 숨바꼭질이 데려가지 않았을 때만)
  private leaderOf(c: Creature, r: Resident): Creature | null {
    for (const m of this.folk) {
      const q = m.res!;
      if (q.squad !== r.squad || q.slot !== 0 || m === c) continue;
      const isAround = m.st !== "guide" && this.dist(c.v, m.v) < PLACE_REACH;
      return isAround ? m : null;
    }
    return null;
  }

  // 반가워 폴짝폴짝(배달을 받았을 때·차를 받았을 때)
  private hopForJoy(c: Creature, r: Resident): boolean {
    this.turn(c, r.actAim, 6);
    this.hop(c, 3.4);
    this.W.squash = c.hop > 0.15 ? 1.08 : 0.96;
    this.W.isFree = false;
    return r.actT >= r.actFor;
  }

  // "꼭꼭 숨어라": 눈을 가리듯 등을 돌리고 고개를 숙인다. 끝나면 폴짝 돌아선다
  private hideEyes(c: Creature, r: Resident) {
    const W = this.W;
    W.isFree = false;
    if (this.isAway) {
      const peekPhase = this.time * 2.2 + c.an.x;
      at.copy(c.v).multiplyScalar(2).sub(this.p).normalize();
      this.turn(c, at, 7);
      W.pitch = -0.36;
      W.squash = 0.93;
      W.sink = 0.06 + 0.05 * Math.sin(peekPhase);
      r.actU = 0;
      return;
    }
    if (r.actU === 0) this.hop(c, 2.6);
    r.actU += this.dt;
    this.turn(c, this.p, 9);
    if (r.actU > TURN_BACK) this.rest(r);
  }

  // 다 찾았다: 금색 상자가 떨어지는 자리를 둘러서서 들썩인다(자리를 옮기지 않는 것은 그쪽을 보기만)
  private circle(c: Creature, r: Resident, day: Day, pose: Pose, isFlyer: boolean) {
    if (!this.isGathering) {
      this.rest(r);
      return;
    }
    const W = this.W,
      count = this.folk.length,
      index = this.folk.indexOf(c),
      // 두 겹으로 선다(한 겹이면 서른이 다 못 선다)
      isOuter = index % 2 === 1,
      radius = isOuter ? GATHER_RING + GATHER_ROW : GATHER_RING;
    // 제 자리가 막혔으면(소원 나무·리본 달린 물건·내가 선 자리) 옆 자리로 — 나무 뒤로 밀려나 혼자 서지 않게
    for (let shift = 0; shift < count; shift++) {
      const place = index + shift;
      ringSpot(spot, this.gatherAt, radius, place, count);
      if (!this.isBlocked(spot)) break;
    }
    W.isFree = false;
    if (day.isRooted) {
      this.turn(c, this.gatherAt, 4);
      return;
    }
    if (this.dist(c.v, spot) > 0.7) {
      if (isFlyer) this.wing(c, r, spot, GATHER_ALT, GATHER_FLIGHT, pose);
      else this.walk(c, r, spot, GATHER_SPEED, pose, 3);
      return;
    }
    this.turn(c, this.gatherAt, 6);
    pose.head = 0.8;
    W.alt = GATHER_ALT;
    if (isFlyer) return;
    // 두근두근 기다리며 가끔 폴짝
    r.actBeat -= this.dt;
    if (r.actBeat > 0) return;
    r.actBeat = c.rng.range(0.7, 1.6);
    this.hop(c, 2.6);
  }

  // 그 자리에 설 수 없나: 서면 안 되는 자리 안이거나 내가 서 있다
  private isBlocked(v: THREE.Vector3): boolean {
    if (clearance(v, this.avoid) < 0 || clearance(v, this.solid) < 0) return true;
    return this.dist(v, this.p) < GATHER_ME;
  }

  // 내가 가는 길 옆으로 비켜설 자리를 spot 에
  private aside(c: Creature) {
    const pl = this.s.player,
      along = c.v.dot(this.p);
    dir.copy(c.v).addScaledVector(this.p, -along);
    if (dir.lengthSq() < 1e-12) dir.copy(c.f);
    dir.normalize();
    // 내가 가는 쪽의 옆(내 오른쪽·왼쪽 가운데 이 생물이 있는 쪽)
    side.crossVectors(this.p, pl.h).normalize();
    const which = side.dot(dir) < 0 ? -0.9 : 0.9;
    dir.addScaledVector(side, which).normalize();
    this.ahead(spot, c.v, dir, YIELD_STEP);
  }

  // 서면 안 되는 자리에서 밀어내고, 그 자리를 끼고 돌게 몸을 돌린다.
  // 도는 쪽(왼쪽·오른쪽)은 처음 닿았을 때 정해 한동안 지킨다 — 붙어 있는 물건 사이의 오목한 데서 이리저리 튕기며 갇히지 않게
  private fence(c: Creature, r: Resident) {
    if (r.handT > 0) r.handT -= this.dt;
    const isProp = pushOut(c.v, this.avoid, 0, side),
      isSolid = !isProp && !r.isPerching && pushOut(c.v, this.solid, 0, side);
    if (!isProp && !isSolid) return;
    if (r.handT <= 0) r.hand = side.dot(c.f) < 0 ? -1 : 1;
    r.handT = HAND_SECONDS;
    side.multiplyScalar(r.hand);
    c.f.lerp(side, 0.7);
    this.upright(c);
  }

  // 길이 막혀 나아가지 못하면 다 온 것으로 친다(그 일의 다음 단계로 넘어간다)
  private unstick(r: Resident, left: number, speed: number): number {
    const gained = r.lastD - left,
      least = speed * this.dt * 0.25,
      isSlow = gained < least && left > 0.3;
    r.lastD = left;
    const eased = r.stuckT - this.dt;
    r.stuckT = isSlow ? r.stuckT + this.dt : Math.max(0, eased);
    if (r.stuckT < STUCK_SECONDS) return left;
    r.stuckT = 0;
    return 0;
  }

  // c 가 보는 쪽에서 to 까지 돌아야 하는 각(rad, 왼쪽이 +)
  private bearingTo(c: Creature, to: THREE.Vector3): number {
    const along = to.dot(c.v);
    dir.copy(to).addScaledVector(c.v, -along);
    if (dir.lengthSq() < 1e-12) return 0;
    dir.normalize();
    side.crossVectors(c.v, c.f);
    const forward = dir.dot(c.f),
      left = dir.dot(side);
    return Math.atan2(left, forward);
  }

  // 곁(npc.peekReach)에 상자가 숨어 있는 물건이 있으면 그 차례(없으면 -1)
  private nearHiding(c: Creature): number {
    let best = -1,
      least = STAGE.npc.peekReach;
    for (let i = 0; i < this.hidingN; i++) {
      const far = this.dist(c.v, this.hiding[i]);
      if (far >= least) continue;
      least = far;
      best = i;
    }
    return best;
  }

  // 바란 몸짓으로 부드럽게 넘어간다. 서 있을 때는 두리번거리고, 하늘 생물은 바란 높이에서 둥실 날갯짓한다
  private follow(c: Creature, r: Resident, pose: Pose, isFlyer: boolean) {
    const W = this.W,
      k = ease(W.rate, this.dt),
      isStanding = pose.amt < 0.3 || isFlyer;
    if (W.isFree && isStanding) {
      const sweep = (this.time * 6.283) / LOOK_SECONDS + c.an.x;
      W.yaw += LOOK_SWING * Math.sin(sweep);
    }
    const leanStep = (W.pitch - r.lean) * k,
      rollStep = (W.roll - c.roll) * k,
      yawStep = (W.yaw - c.yaw) * k,
      squashStep = (W.squash - c.squash) * k,
      swellStep = (W.swell - c.swell) * k,
      sinkStep = (W.sink - c.sink) * k,
      turned = Math.abs(leanStep) + Math.abs(rollStep) + Math.abs(yawStep),
      reshaped = Math.abs(squashStep) + Math.abs(swellStep) + Math.abs(sinkStep),
      stirred = turned + reshaped;
    r.lean += leanStep;
    c.pitch = r.lean + W.tumble;
    c.roll += rollStep;
    c.yaw += yawStep;
    c.squash += squashStep;
    c.swell += swellStep;
    c.sink += sinkStep;
    r.lift += (W.lift - r.lift) * k;
    if (!isFlyer) {
      c.a += r.lift;
      this.fidget(c, r, stirred);
      return;
    }
    const ground = this.s.terrain.groundAt(c.v),
      bobPhase = this.time * 1.7 + c.an.x,
      want = ground + W.alt + 0.18 * Math.sin(bobPhase),
      rise = ease(3.4, this.dt);
    c.a += (want - c.a) * rise;
    if (!W.isCalm && pose.amt < 0.45) pose.amt = 0.45;
    c.ph += this.dt * (9 + 6 * c.amt);
  }

  // 어떤 일을 하든 npc.stillMax 초 넘게 멈춰 있지 않는다: 숨쉬기 말고 아무 움직임(자리·몸짓)이 없은 시간을 세어, 닿기 전에 작게 폴짝한다.
  // 하늘 생물은 늘 둥실거리니 세지 않는다. stirred: 이번 프레임에 몸짓이 바뀐 만큼
  private fidget(c: Creature, r: Resident, stirred: number) {
    const isMoving = r.lastAt.distanceToSquared(c.v) > MOVED_SQ,
      isStirring = stirred > STIR_RATE * this.dt || c.hop > 0 || isMoving;
    r.lastAt.copy(c.v);
    r.stillT = isStirring ? 0 : r.stillT + this.dt;
    if (r.stillT < STAGE.npc.stillMax * STILL_SHARE) return;
    r.stillT = 0;
    this.hop(c, FIDGET_HOP);
  }

  // 주민끼리: 겹쳐 서지 않고, 마주치면 까딱하고, 장미는 누가 다가오면 붉어진다
  private pairs() {
    const folk = this.folk,
      N = STAGE.npc;
    for (let i = 0; i < folk.length; i++) {
      const a = folk[i],
        ra = a.res!;
      if (a.st === "guide" || a.gone) continue;
      for (let j = i + 1; j < folk.length; j++) {
        const b = folk[j];
        if (a.v.dot(b.v) < NEAR_COS || b.st === "guide" || b.gone) continue;
        const rb = b.res!,
          far = this.dist(a.v, b.v),
          heightGap = a.a - b.a,
          isLevel = Math.abs(heightGap) < 2.5;
        if (isLevel) this.spread(a, b, far);
        this.blush(a, ra, b, far);
        this.blush(b, rb, a, far);
        if (far > N.nodReach || !isLevel || this.isBusy || !canNod(a, b)) continue;
        const isSame = ra.nodWith === b && rb.nodWith === a;
        if (isSame && ra.nodCd > -NOD_SAME_AGAIN) continue;
        this.act(ra, "nod", NOD_SECONDS, b.v);
        this.act(rb, "nod", NOD_SECONDS, a.v);
        ra.nodCd = rb.nodCd = NOD_COOLDOWN;
        ra.nodWith = b;
        rb.nodWith = a;
      }
    }
  }

  // 둘이 겹쳐 서지 않게 살짝 밀어낸다(같이 하는 일의 짝은 붙어 있어도 된다 — 머리 위의 모자·둘러앉은 컵케이크)
  private spread(a: Creature, b: Creature, far: number) {
    const ra = a.res!,
      rb = b.res!,
      isAir = a.role === "flock" || b.role === "flock",
      isPair = ra.mate === b || rb.mate === a,
      rootedA = DAYS[a.k].isRooted === true,
      rootedB = DAYS[b.k].isRooted === true,
      // 금색 상자를 둘러설 때는 어깨를 맞대고 선다(옆 자리로 비켜 선 것이 이웃과 밀치락달치락하지 않게)
      apart = this.isGathering ? APART_CROWD : APART,
      least = rootedA || rootedB ? APART_ROOTED : apart;
    if (isAir || isPair || far >= least || (rootedA && rootedB)) return;
    const along = a.v.dot(b.v);
    dir.copy(a.v).addScaledVector(b.v, -along);
    if (dir.lengthSq() < 1e-14) dir.copy(a.f);
    dir.normalize();
    // 자리를 옮기지 않는 것 곁에서는 다른 쪽이 다 비킨다
    const gap = (least - far) * 0.5,
      shareA = rootedA ? 0 : rootedB ? 2 : 1,
      shareB = rootedB ? 0 : rootedA ? 2 : 1,
      arcA = (gap * shareA) / S.R,
      arcB = (gap * shareB) / S.R,
      stepA = Math.tan(arcA),
      stepB = Math.tan(arcB);
    a.v.addScaledVector(dir, stepA).normalize();
    b.v.addScaledVector(dir, -stepB).normalize();
    this.upright(a);
    this.upright(b);
  }

  // 보는 쪽을 땅과 나란하게 다시 세운다(자리를 밀어 옮긴 뒤)
  private upright(c: Creature) {
    const up = c.f.dot(c.v);
    c.f.addScaledVector(c.v, -up).normalize();
  }

  // 수줍음이 많은 종(장미)은 다른 생물이 가까이 오면 살짝 붉어진다
  private blush(c: Creature, r: Resident, other: Creature, far: number) {
    if (!DAYS[c.k].isShy || far > BLUSH_REACH || r.quirkCd > 0) return;
    if (DAYS[other.k].isShy) return;
    const cheek = c.batch.hh * 0.5;
    r.quirkCd = BLUSH_AGAIN;
    r.wobble = 0.5;
    this.puff("blush", c, cheek);
  }

  // 찾아갈 곳을 한 번 찾아 둔다: 판 영역과 그 둘레에 놓인 케이크·벤치·큰 꽃·랜드마크·우체통
  private findPlaces() {
    if (this.hasPlaces) return;
    this.hasPlaces = true;
    const reach = this.radius + PLACE_BEYOND;
    for (const placed of this.s.models.placements()) {
      const kind = PLACE_MODELS[placed.key];
      if (!kind || this.dist(placed.v, this.hub) > reach) continue;
      const keepOut = kind[1] + PLACE_ROOM;
      this.places.push({ kind: kind[0], v: placed.v, r: kind[1], top: kind[2] });
      this.solid.push({ v: placed.v, r: keepOut });
    }
  }
}

/* ─── 내부 ─────────────────────────── */

function clampTo(x: number, most: number): number {
  const capped = Math.min(most, x);
  return Math.max(-most, capped);
}
