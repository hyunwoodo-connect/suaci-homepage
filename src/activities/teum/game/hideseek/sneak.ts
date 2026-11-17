import * as THREE from "three";

import type { Services } from "../services";
import { S } from "../settings";
import type { HideFx } from "./effects";
import type { HideOverlay } from "./overlay";
import type { Seeker } from "./seeker";
import type { BehindSpot } from "./tuning";
import { HIDE } from "./tuning";

// 상자는 내가 안 볼 때만 움직인다("무궁화 꽃이 피었습니다"). 숨바꼭질의 재미를 '어디 있나'에서 '눈치 싸움'으로 옮긴다.
// 움직이는 상자는 판 시작 때 하는 짓 하나를 받는다:
//   relocate — sneak.moveEvery 초마다 가까운 다른 숨는 자리로 종종걸음(탁 트인 데를 가로지른다)
//   follow   — 내 등 뒤 sneak.followGap(m)를 몰래 따라온다. 내가 멈추면 같이 멈춘다
// 컵케이크 냄새에 끌린 상자(lure)도 같은 규칙으로 다가온다.
// 화면에 잡히면 그 자세 그대로 굳는다. 오래 보고 있으면 부들부들 떨며 땀을 흘린다. 화면에서 벗어나고 잠깐 뒤 다시 움직인다.
// 움직이다 화면에 잡힌 적이 있는 상자는 가장 가까운 숨는 자리로 가서 그 판에는 더 안 움직인다(계속 도망 다니지 않게).
// 화면 밖에서 움직이면 그쪽 화면 가장자리에 먼지가 퐁퐁 오르고 발소리가 난다(화살표가 아니라 "저쪽에서 뭐가 지나갔다" 정도)

/** 하는 짓 */
type SneakMode = "relocate" | "follow";

/** 움직이는 상자 하나 */
interface Mover {
  k: Seeker;
  mode: SneakMode;
  /** 다음에 자리를 옮길 때까지(초) · 따라붙는 거리(m) */
  wait: number;
  gap: number;
  /** 가는 곳(없으면 서 있다)과 그곳이 숨는 자리면 그 자리 */
  goal: THREE.Vector3 | null;
  goalSpot: BehindSpot | null;
  /** 화면 밖에 나간 지(초) · 화면에 잡혀 있은 지(초) · 다음 먼지까지(초) */
  offT: number;
  watchedT: number;
  puffT: number;
  /** 움직이다 들켰다 → 가까운 숨는 자리에 가서 머문다 */
  wasSpotted: boolean;
  isSettled: boolean;
}

/** 숨는 자리를 다루는 법(숨는 장면이 쓰는 것과 같다): 상자를 그 자리에 숨기기 · 그 자리의 땅 위 자리(단위 벡터) */
export interface SpotHands {
  place(k: Seeker, spot: BehindSpot): void;
  ground(spot: BehindSpot): THREE.Vector3;
}

/** 걸음 빠르기의 위(m/s — 따라붙을 때 멀어졌으면 이만큼까지 서두른다) · 다 온 것으로 치는 거리(m) · 먼지 간격(초) · 땀방울 간격(초)·색 · 미끼 앞에서 멈추는 거리(m) */
const CATCH_UP = 16,
  ARRIVE = 0.4,
  PUFF_EVERY = 0.7,
  SWEAT_EVERY = 0.35,
  SWEAT_COLOR = 0x8fd8ff,
  LURE_STOP = 3;
/** 자리를 옮길 때 고르는 숨는 자리의 거리(m) */
const RELOCATE_REACH = 70;

const tmp = new THREE.Vector3(),
  at = new THREE.Vector3();

/** 안 볼 때만 움직이는 상자들 */
export class Sneak {
  private movers: Mover[] = [];
  private readonly lureAt = new THREE.Vector3();
  private lured: Mover | null = null;
  /** 움직이다 들킨 수(잰 값) */
  spotted = 0;

  constructor(
    private readonly s: Services,
    private readonly fx: HideFx,
    private readonly overlay: HideOverlay,
    private readonly spots: SpotHands,
    private readonly rand: () => number,
  ) {}

  /** 판 시작: 움직일 상자를 고르고 하는 짓을 준다(첫 판은 따라붙기 하나, 그다음부터 sneak.later 개). candidates 는 숨은(뒤·높이) 상자 */
  begin(candidates: readonly Seeker[], first: boolean) {
    this.stop();
    this.spotted = 0;
    const N = HIDE.sneak,
      count = first ? N.firstRound : N.later,
      pool = [...candidates];
    for (let i = 0; i < count && pool.length; i++) {
      const roll = this.rand() * pool.length,
        pickAt = Math.floor(roll),
        [k] = pool.splice(pickAt, 1),
        isFollow = first || this.rand() < 0.5,
        mode: SneakMode = isFollow ? "follow" : "relocate";
      const mover = this.newMover(k, mode);
      this.movers.push(mover);
    }
  }

  /** k 가 at(단위 벡터) 쪽으로 다가온다(컵케이크 냄새). null 이면 그친다 */
  lure(k: Seeker | null, at: THREE.Vector3 | null) {
    const was = this.lured;
    if (was && !this.movers.includes(was)) was.k.box.setFrozen(false);
    // 냄새가 그치면 컵케이크로 가던 걸음을 멈춘다(움직이는 상자는 하던 짓으로 돌아간다)
    if (was && was.goal === this.lureAt) was.goal = null;
    this.lured = null;
    if (!k || !at) return;
    this.lureAt.copy(at);
    this.lured = this.movers.find((m) => m.k === k) ?? this.newMover(k, "relocate");
  }

  /** 지금 움직이는(또는 굳은) 상자인가 — 숨은 자리에서 빼꼼하지 않는다 */
  isMoving(k: Seeker): boolean {
    const m = this.find(k);
    return m !== null && m.goal !== null;
  }

  /** 한 프레임(찾는 중 — k.seen 은 이번 프레임 화면 안인가) */
  update(dt: number, occupied: (spot: BehindSpot) => boolean) {
    const list =
      this.lured && !this.movers.includes(this.lured) ? [...this.movers, this.lured] : this.movers;
    for (const m of list) {
      if (m.k.state !== "hidden") continue;
      if (m.k.seen) this.watched(m, dt);
      else this.unwatched(m, dt, occupied);
    }
  }

  /** 거둔다(판이 끝났다·상자를 찾았다): 굳은 것을 푼다 */
  stop() {
    for (const m of this.movers) m.k.box.setFrozen(false);
    this.lured?.k.box.setFrozen(false);
    this.movers = [];
    this.lured = null;
  }

  /* ─── 내부 ─────────────────────────── */

  private newMover(k: Seeker, mode: SneakMode): Mover {
    const N = HIDE.sneak,
      span = N.moveEvery[1] - N.moveEvery[0],
      wait = N.moveEvery[0] + this.rand() * span,
      gapSpan = N.followGap[1] - N.followGap[0],
      gap = N.followGap[0] + this.rand() * gapSpan;
    return {
      k,
      mode,
      wait,
      gap,
      goal: null,
      goalSpot: null,
      offT: 0,
      watchedT: 0,
      puffT: 0,
      wasSpotted: false,
      isSettled: false,
    };
  }

  private find(k: Seeker): Mover | null {
    if (this.lured?.k === k) return this.lured;
    return this.movers.find((m) => m.k === k) ?? null;
  }

  // 화면에 잡혔다: 움직이던 중이면 그 자세 그대로 굳는다(들킨 것). 오래 보면 부들부들 땀
  private watched(m: Mover, dt: number) {
    const b = m.k.box;
    m.offT = 0;
    if (!m.goal) return;
    if (!m.wasSpotted) {
      m.wasSpotted = true;
      this.spotted++;
    }
    b.setFrozen(true);
    m.watchedT += dt;
    const isSweating = m.watchedT >= HIDE.sneak.sweatAfter;
    b.setSweat(isSweating);
    if (!isSweating) return;
    m.puffT -= dt;
    if (m.puffT > 0) return;
    m.puffT = SWEAT_EVERY;
    const top = b.hh * 2 * b.size,
      brow = top * 0.4;
    b.center(at).addScaledVector(b.v, brow);
    this.fx.dot(at, 0.35, 0.6, SWEAT_COLOR);
  }

  // 화면 밖: 잠깐 뒤 다시 움직인다
  private unwatched(m: Mover, dt: number, occupied: (spot: BehindSpot) => boolean) {
    const b = m.k.box;
    m.watchedT = 0;
    m.offT += dt;
    if (m.offT < HIDE.sneak.resumeAfter) return;
    b.setFrozen(false);
    if (m.isSettled) return;
    this.pickGoal(m, dt, occupied);
    if (m.goal) this.walk(m, dt);
  }

  // 갈 곳: 들켰으면 가장 가까운 숨는 자리, 미끼면 컵케이크 앞, 따라붙기면 내 등 뒤, 자리 옮기기면 때가 됐을 때 다른 숨는 자리
  private pickGoal(m: Mover, dt: number, occupied: (spot: BehindSpot) => boolean) {
    const { player } = this.s;
    if (m.wasSpotted && !m.goalSpot) {
      m.goalSpot = this.coverNear(m.k.box.v, occupied, null);
      m.goal = m.goalSpot ? this.spotGround(m.goalSpot) : null;
      if (!m.goal) m.isSettled = true;
      return;
    }
    if (m.wasSpotted) return;
    if (m === this.lured) {
      const left = m.k.box.v.angleTo(this.lureAt) * S.R;
      m.goal = left > LURE_STOP ? this.lureAt : null;
      return;
    }
    if (m.mode === "follow") {
      const isMoving = player.tot > 0.15,
        back = -m.gap / S.R;
      tmp.copy(player.p).addScaledVector(player.h, back).normalize();
      const behind = m.k.box.v.angleTo(tmp) * S.R;
      m.goal = isMoving || behind > m.gap ? tmp.clone() : null;
      return;
    }
    if (m.goal) return;
    m.wait -= dt;
    if (m.wait > 0) return;
    const spot = this.coverNear(m.k.box.v, occupied, m.k.spot.id);
    const N = HIDE.sneak,
      span = N.moveEvery[1] - N.moveEvery[0];
    m.wait = N.moveEvery[0] + this.rand() * span;
    if (!spot) return;
    m.goalSpot = spot;
    m.goal = this.spotGround(spot);
  }

  // 한 걸음: 종종걸음으로 가고, 그쪽 화면 가장자리에 먼지 퐁퐁. 숨는 자리에 닿으면 그 자리에 숨는다
  private walk(m: Mover, dt: number) {
    const b = m.k.box,
      goal = m.goal!,
      terrain = this.s.terrain,
      far = b.v.angleTo(goal) * S.R,
      hurry = far * 1.5,
      capped = Math.min(CATCH_UP, hurry),
      speed = Math.max(HIDE.sneak.speed, capped);
    b.setPeek(null);
    const left = b.stepToward(goal, speed, dt);
    b.a = terrain.groundAt(b.v);
    b.setScurry(1);
    this.s.events.emit("hideBoxSneaked", {});
    m.puffT -= dt;
    if (m.puffT <= 0) {
      m.puffT = PUFF_EVERY;
      this.overlay.puff((out) => b.center(out));
    }
    if (left > ARRIVE) return;
    b.setScurry(0);
    const spot = m.goalSpot;
    m.goal = null;
    m.goalSpot = null;
    if (!spot) return;
    m.k.spot = spot;
    this.spots.place(m.k, spot);
    if (m.wasSpotted) m.isSettled = true;
  }

  // 가장 가까운 비어 있는 뒤에 숨는 자리(skip 자리는 빼고, RELOCATE_REACH 안)
  private coverNear(
    v: THREE.Vector3,
    occupied: (spot: BehindSpot) => boolean,
    skip: string | null,
  ): BehindSpot | null {
    let best: BehindSpot | null = null,
      bestD = Infinity;
    for (const spot of HIDE.spots) {
      if (spot.kind !== "behind" || spot.id === skip || occupied(spot)) continue;
      // 다른 상자가 가고 있는 자리는 빼서 둘이 한 자리에 겹치지 않게
      if (this.movers.some((m) => m.goalSpot === spot)) continue;
      const ground = this.spotGround(spot),
        d = v.angleTo(ground) * S.R;
      if (d > RELOCATE_REACH || d >= bestD) continue;
      bestD = d;
      best = spot;
    }
    return best;
  }

  // 숨는 자리(가린 것 뒤)의 땅 위 자리
  private spotGround(spot: BehindSpot): THREE.Vector3 {
    return this.spots.ground(spot);
  }
}
