import * as THREE from "three";

import { ease } from "../core/frame";
import type { Intent } from "../player/player";
import { S } from "../settings";
import type { FloorHit, StandShape } from "./stand";
import type { TeaTuning } from "./teaTuning";

// 티타임 행성의 내 몸(기획서 v3.1 1장 "중력과 조작"). 서서 걷고 떨어진다.
// 걷는 셈(끌기로 방향 틀기·빨라지기·순항)은 지금 게임의 Player 와 같은 값(S.speed·S.turn)을 쓴다.
// 위 방향은 자리마다 다르다(스탠드 둘레는 축 위, 멀리는 별 바깥 — StandShape.upAt). 발밑의 가장 가까운 면(별 또는 접시 윗면)에 붙어 걷고,
// 발밑이 꺼지면 둥실 떨어진다(떨어지는 중에도 끌기가 조금 먹는다). 높이 떨어졌다 내려앉으면 작은 폴짝. 놀이기구는 몸을 길에 실어 간다

/** 몸을 실어 가는 길(버섯·바람 기둥·대포·미끄럼틀) */
export interface Carrier {
  /** 길을 다 가는 시간(초) */
  readonly seconds: number;
  /** 길의 t(0~1) 자리(세계 좌표, 발)를 out 에 */
  at(t: number, out: THREE.Vector3): THREE.Vector3;
  /** 다 갔을 때 */
  arrived?(): void;
}

/** 못 지나가는 꾸밈(케이크·찻잔…): 바닥에 닿는 가운데 · 그 자리의 위 · 반지름 · 키 */
export interface Blocker {
  base: THREE.Vector3;
  up: THREE.Vector3;
  radius: number;
  height: number;
}

/** 순항: 곧게 오래 갈수록 조금씩 더 빨라진다(지금 게임과 같은 값) */
const CRUISE = { max: 0.9, rise: 0.22, fall: 1.2, straight: 0.35, firm: 0.8 } as const;
/** 이만큼(m) 넘게 떨어졌다 내려앉으면 작은 폴짝과 먼지 */
const HOP_FROM = 1.2;
/** 떠 있는 높이를 잴 때 아래로 볼 거리(m) · 발에서 조금 위에서 잰다(m) */
const LOOK_DOWN = 80;
const PROBE_LIFT = 0.05;

const right = new THREE.Vector3(),
  want = new THREE.Vector3(),
  step = new THREE.Vector3(),
  next = new THREE.Vector3(),
  probe = new THREE.Vector3(),
  side = new THREE.Vector3(),
  ahead = new THREE.Vector3();

/** 나 */
export class TeaBody {
  /** 발 자리(세계) */
  readonly foot = new THREE.Vector3();
  /** 위(아바타·카메라가 이 쪽을 위로 본다 — 지금 게임의 Player.p 자리) */
  readonly p = new THREE.Vector3(0, 1, 0);
  /** 보는 쪽(위에 수직) */
  readonly h = new THREE.Vector3(0, 0, 1);
  /** 나아가는 쪽(위에 수직) */
  readonly vel = new THREE.Vector3(0, 0, 1);
  /** 아바타 몸 자리(발 위로 떠 있는 높이만큼, 둥실 흔들림까지) */
  readonly P = new THREE.Vector3();
  /** 발밑 바닥(그림자 자리)과 그 면의 바깥쪽 */
  readonly ground = new THREE.Vector3();
  readonly groundNormal = new THREE.Vector3(0, 1, 0);
  /** 발밑 바닥의 층(0 땅, 1~3 접시) */
  tier = 0;
  /** 바닥에서 떠 있는 높이 */
  air = 0;
  /** 위 방향 빠르기(m/s) */
  vy = 0;
  /** 이번 프레임 빠르기 배수(아바타 몸짓이 읽는다) */
  tot = 0;
  /** 끄는 옆 방향(몸 기울기) */
  dragFx = 0;
  /** 순간 이동·놀이기구 내림 횟수(카메라가 바로 붙는다) */
  jumps = 0;
  /** 못 지나가는 꾸밈 */
  readonly blockers: Blocker[] = [];
  /** 높이 떨어졌다 내려앉았을 때(소리·먼지) — 떨어진 높이(m) */
  onLanded: ((drop: number) => void) | null = null;
  private grounded = true;
  private fallFrom = 0;
  /** 떨어지기 시작한 층(접시에서 떨어질 때만 한 단 아래가 받는다 — 하늘에서 내려올 때는 땅까지) */
  private fellFrom = 0;
  private spd = 0;
  private boost = 0;
  private cruise = 0;
  private fx = 0;
  private fy = 0;
  private m = 0;
  private dt = 0;
  private carrier: Carrier | null = null;
  private carriedT = 0;
  private snap = true;

  constructor(
    private readonly stand: StandShape,
    private readonly t: TeaTuning,
  ) {}

  /** 놀이기구에 실려 가는 중 */
  get isHeld(): boolean {
    return this.carrier !== null;
  }

  /** 바닥에 서 있나 */
  get isGrounded(): boolean {
    return this.grounded && !this.carrier;
  }

  /** 몸 크기(지금 게임의 대포 안처럼 작아지는 일은 없다) */
  get bodyScale(): number {
    return 1;
  }

  /** 아바타 그림자 높이 값(그림자는 이 씬이 따로 놓는다 — 아바타의 셈에 쓰일 뿐이다) */
  get gNow(): number {
    return 0;
  }

  /** 카메라가 바로 붙어야 하면 true(한 번 읽으면 지운다) */
  takeSnap(): boolean {
    const s = this.snap;
    this.snap = false;
    return s;
  }

  /** 발을 at 에 두고 heading 쪽을 본다(바닥에 붙지 않는다 — 공중이면 떨어진다) */
  teleport(at: THREE.Vector3, heading: THREE.Vector3) {
    this.foot.copy(at);
    this.stand.upAt(at, this.p);
    this.lookAlong(heading);
    this.vy = 0;
    this.spd = 0;
    this.boost = 0;
    this.carrier = null;
    // 순간 이동은 어느 접시에서 떨어진 것이 아니다(공중이면 땅까지 떨어진다)
    this.grounded = false;
    this.settle(0.05);
    this.snap = true;
    this.jumps++;
  }

  /** 길에 실어 간다(다 가면 길 끝에 내려 준다) */
  carry(c: Carrier) {
    this.carrier = c;
    this.carriedT = 0;
    this.vy = 0;
    this.spd = 0;
  }

  /** 이번 프레임의 입력. 실려 가는 동안은 끌어도 움직이지 않는다 */
  begin(dt: number, intent: Intent) {
    this.dt = dt;
    this.fx = intent.fx;
    this.fy = intent.fy;
    this.dragFx = intent.dragFx;
    this.m = this.carrier ? 0 : intent.m;
  }

  /** 나아가기, 그리고 떨어지기·내려앉기 */
  move() {
    if (this.carrier) {
      this.ride();
      return;
    }
    this.steer();
    if (this.grounded) this.walk();
    else this.fall();
    this.measureAir();
  }

  /** 아바타 몸 자리를 정한다(둥실 흔들림까지) */
  place(time: number) {
    const bobPhase = time * 1.7,
      bob = Math.sin(bobPhase) * 0.04;
    const lift = this.t.walk.hover + bob;
    this.P.copy(this.foot).addScaledVector(this.p, lift);
  }

  // 끌기로 방향을 틀고 빨라진다(지금 게임의 Player.move 와 같은 셈, 비탈 없음)
  private steer() {
    const { p, h, vel, dt, fx, m } = this;
    if (m > 0) {
      right.crossVectors(h, p).normalize();
      want.copy(h).multiplyScalar(this.fy).addScaledVector(right, fx).normalize();
      const turnAngle = -S.turn * dt * fx * m;
      h.applyAxisAngle(p, turnAngle);
      const steerK = ease(6, dt);
      vel.lerp(want, steerK).normalize();
    }
    const spdRate = m > this.spd ? 2.2 : 1.1;
    this.spd += (m - this.spd) * ease(spdRate, dt);
    const boostDecay = -0.85 * dt;
    this.boost *= Math.exp(boostDecay);
    const isCruising = m > CRUISE.firm && Math.abs(fx) < CRUISE.straight;
    const cruiseTarget = isCruising ? CRUISE.max : 0;
    const cruiseRate = isCruising ? CRUISE.rise : CRUISE.fall;
    this.cruise += (cruiseTarget - this.cruise) * ease(cruiseRate, dt);
    this.tot = this.spd * (1 + this.cruise) + this.boost;
  }

  // 서 있을 때: 발밑 면을 따라 나아가고, 새 자리에서 다시 발밑 면에 붙는다(없으면 떨어지기 시작)
  private walk() {
    const { foot, dt } = this;
    const distance = S.speed * this.tot * dt;
    if (distance > 1e-5) {
      const n = this.groundNormal;
      const along = this.vel.dot(n);
      step.copy(this.vel).addScaledVector(n, -along);
      if (step.lengthSq() > 1e-10) step.normalize().multiplyScalar(distance);
      next.copy(foot).add(step);
      this.keepOut(next);
      if (!this.stand.slabAt(next)) foot.copy(next);
    }
    this.stand.upAt(foot, this.p);
    this.reframe();
    const { stepUp, snapDown } = this.t.walk;
    probe.copy(foot).addScaledVector(this.p, stepUp);
    const reach = stepUp + snapDown;
    const hit = this.stand.castDown(probe, this.p, reach);
    if (hit) this.standOn(hit);
    else this.startFalling();
  }

  // 떨어질 때: 위 방향의 반대로 빨라지며 내려가고, 끌기는 조금만 먹는다. 받을 접시를 벗어나지 않는다.
  // 먼저 옆으로 옮기고(기둥·꾸밈·받는 접시 안으로), 이번에 내려갈 만큼 아래에 바닥이 있으면 거기 내려앉는다
  private fall() {
    const { foot, dt } = this;
    const { gravity, limit } = this.t.fall;
    const pulled = this.vy - gravity * dt;
    this.vy = Math.max(pulled, limit);
    const drift = S.speed * this.tot * this.t.walk.airControl * dt;
    const rise = this.vy * dt;
    next.copy(foot).addScaledVector(this.vel, drift);
    this.keepOut(next);
    const isCatching = this.vy <= 0 && this.fellFrom > 0;
    if (isCatching) this.stand.keepOverCatcher(next, this.t.walk.catchMargin);
    const landing = this.landingOn(next, -rise);
    if (landing) {
      const drop = this.fallFrom;
      this.standOn(landing);
      this.land(drop);
      return;
    }
    next.addScaledVector(this.p, rise);
    // 접시 판 속으로(옆이나 밑에서) 들어가면 옆으로는 못 간다
    if (this.stand.slabAt(next)) next.copy(foot).addScaledVector(this.p, rise);
    if (this.stand.slabAt(next)) next.copy(foot);
    foot.copy(next);
    this.stand.upAt(foot, this.p);
    this.reframe();
  }

  // 이번 걸음에 지나갈 바닥(내려가는 중일 때만): at 바로 위에서 dropBy 만큼 아래까지
  private landingOn(at: THREE.Vector3, dropBy: number): FloorHit | null {
    if (dropBy <= 0) return null;
    probe.copy(at).addScaledVector(this.p, 0.05);
    const reach = dropBy + 0.1;
    return this.stand.castDown(probe, this.p, reach);
  }

  // 발밑이 꺼졌다: 그 높이를 기억하고 떨어지기 시작한다
  private startFalling() {
    this.fellFrom = this.grounded ? this.tier : 0;
    this.grounded = false;
    this.fallFrom = this.heightOver();
    this.vy = 0;
  }

  // 바닥 hit 에 선다
  private standOn(hit: FloorHit) {
    this.foot.copy(hit.point);
    this.groundNormal.copy(hit.normal);
    this.tier = hit.tier;
    this.grounded = true;
    if (this.vy < 0) this.vy = 0;
    this.stand.upAt(this.foot, this.p);
    this.reframe();
  }

  // 내려앉았다: 미끄러지던 기세를 줄이고, 높이 떨어졌으면 작은 폴짝
  private land(drop: number) {
    this.spd *= this.t.walk.landKeep;
    this.cruise = 0;
    if (drop < HOP_FROM) return;
    this.grounded = false;
    this.vy = this.t.walk.landHop;
    this.fallFrom = 0;
    this.onLanded?.(drop);
  }

  // 기둥·꾸밈 속으로는 못 들어간다
  private keepOut(at: THREE.Vector3) {
    const { bodyHalf } = this.t.walk;
    this.stand.pushOutOfColumn(at, bodyHalf);
    for (const b of this.blockers) pushOutOf(at, b, bodyHalf);
  }

  // 발밑 바닥과 떠 있는 높이(그림자·몸짓) — 발이 바닥에 딱 붙어 있어도 잡히게 조금 위에서 잰다
  private measureAir() {
    probe.copy(this.foot).addScaledVector(this.p, PROBE_LIFT);
    const hit = this.stand.castDown(probe, this.p, LOOK_DOWN);
    if (!hit) {
      this.air = LOOK_DOWN;
      return;
    }
    const below = hit.dist - PROBE_LIFT;
    this.air = Math.max(0, below);
    this.ground.copy(hit.point);
    this.groundNormal.copy(hit.normal);
    if (this.grounded) this.tier = hit.tier;
  }

  // 지금 발에서 아래 바닥까지
  private heightOver(): number {
    probe.copy(this.foot).addScaledVector(this.p, PROBE_LIFT);
    const hit = this.stand.castDown(probe, this.p, LOOK_DOWN);
    return hit ? hit.dist - PROBE_LIFT : 0;
  }

  // 발을 바닥에 붙인다(순간 이동·놀이기구에서 내린 뒤)
  private settle(reach: number) {
    probe.copy(this.foot).addScaledVector(this.p, reach);
    const span = reach * 2;
    const hit = this.stand.castDown(probe, this.p, span);
    if (hit) this.standOn(hit);
    else this.startFalling();
    this.measureAir();
  }

  // 길에 실려 간다: 길의 자리에 발을 두고, 나아가는 쪽을 길 쪽으로
  private ride() {
    const c = this.carrier!;
    const stepT = this.dt / c.seconds;
    const reached = this.carriedT + stepT;
    this.carriedT = Math.min(1, reached);
    c.at(this.carriedT, this.foot);
    const peek = this.carriedT + 0.02;
    const nextT = Math.min(1, peek);
    c.at(nextT, ahead);
    this.stand.upAt(this.foot, this.p);
    ahead.sub(this.foot);
    if (ahead.lengthSq() > 1e-8) this.lookAlong(ahead);
    else this.reframe();
    this.tot = 1;
    this.measureAir();
    if (this.carriedT < 1) return;
    this.carrier = null;
    this.spd = 0.6;
    this.jumps++;
    this.settle(0.6);
    c.arrived?.();
  }

  // 위가 바뀌면 보는 쪽·나아가는 쪽을 새 위에 수직으로
  private reframe() {
    const p = this.p;
    const hUp = this.h.dot(p);
    this.h.addScaledVector(p, -hUp);
    if (this.h.lengthSq() < 1e-10) {
      side.set(1, 0, 0).cross(p);
      this.h.copy(side);
    }
    this.h.normalize();
    const vUp = this.vel.dot(p);
    this.vel.addScaledVector(p, -vUp);
    if (this.vel.lengthSq() < 1e-10) this.vel.copy(this.h);
    this.vel.normalize();
  }

  // 보는 쪽·나아가는 쪽을 dir 의 접선 성분으로
  private lookAlong(dir: THREE.Vector3) {
    const up = dir.dot(this.p);
    this.h.copy(dir).addScaledVector(this.p, -up);
    if (this.h.lengthSq() < 1e-10) {
      this.reframe();
      return;
    }
    this.h.normalize();
    this.vel.copy(this.h);
  }
}

/* ─── 내부 ─────────────────────────── */

const offset = new THREE.Vector3();

// 꾸밈 하나 속으로 들어왔으면 둘레로 밀어낸다(그 꾸밈의 키 안에서만)
function pushOutOf(at: THREE.Vector3, b: Blocker, body: number) {
  offset.subVectors(at, b.base);
  const height = offset.dot(b.up);
  if (height < -0.5 || height > b.height) return;
  offset.addScaledVector(b.up, -height);
  const reach = b.radius + body;
  const now = offset.length();
  if (now >= reach) return;
  if (now < 1e-6) offset.set(1, 0, 0).cross(b.up);
  offset.normalize().multiplyScalar(reach);
  at.copy(b.base).add(offset).addScaledVector(b.up, height);
}
