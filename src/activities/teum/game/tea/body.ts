import * as THREE from "three";

import { ease } from "../core/frame";
import type { Intent } from "../player/player";
import { S } from "../settings";
import type { StandShape } from "./stand";
import type { TeaTuning } from "./teaTuning";

// 티타임 행성의 내 몸. 걷는 셈(끌기로 방향 틀기·빨라지기·순항)은 지금 게임의 Player 와 같은 값(S.speed·S.turn)을 쓰고,
// 다른 것은 셋: ① 별이 작아 한 걸음의 각을 지금 높이의 반지름으로 나눈다(어느 층에서도 초속 7m)
// ② 발밑이 땅만이 아니라 접시 셋이다(가장자리 밖으로 나가면 둥실 떨어지고, 받는 접시를 벗어나지 않는다)
// ③ 놀이기구는 몸을 길에 실어 간다(실력이 필요한 이동은 없다 — 타는 동안 끌기는 먹지 않는다)

/** 몸을 실어 가는 길(버섯·바람 기둥·대포·미끄럼틀) */
export interface Carrier {
  /** 길을 다 가는 시간(초) */
  readonly seconds: number;
  /** 길의 t(0~1) 자리(세계 좌표, 발 높이)를 out 에 */
  at(t: number, out: THREE.Vector3): THREE.Vector3;
  /** 다 갔을 때 */
  arrived?(): void;
}

/** 못 지나가는 꾸밈(케이크·찻잔…): 별 위 자리 · 선 바닥 높이 · 반지름 · 키 */
export interface Blocker {
  v: THREE.Vector3;
  floor: number;
  radius: number;
  height: number;
}

/** 순항: 곧게 오래 갈수록 조금씩 더 빨라진다(지금 게임과 같은 값) */
const CRUISE = { max: 0.9, rise: 0.22, fall: 1.2, straight: 0.35, firm: 0.8 } as const;

const right = new THREE.Vector3(),
  want = new THREE.Vector3(),
  axis = new THREE.Vector3(),
  before = new THREE.Vector3(),
  spot = new THREE.Vector3(),
  ahead = new THREE.Vector3();

/** 나 */
export class TeaBody {
  /** 별 위 자리(단위 벡터) */
  readonly p = new THREE.Vector3(0, 1, 0);
  /** 보는 쪽(접선) */
  readonly h = new THREE.Vector3(0, 0, 1);
  /** 나아가는 쪽(접선) */
  readonly vel = new THREE.Vector3(0, 0, 1);
  /** 세계 자리(둥실 떠 있는 몸 가운데) */
  readonly P = new THREE.Vector3();
  /** 발 높이(땅에서 m) */
  alt = 0;
  /** 발밑 바닥 높이 */
  floor = 0;
  /** 바닥에서 떠 있는 높이 */
  air = 0;
  /** 위아래 빠르기(m/s) */
  vy = 0;
  /** 이번 프레임 빠르기 배수(아바타 몸짓이 읽는다) */
  tot = 0;
  /** 끄는 옆 방향(몸 기울기) */
  dragFx = 0;
  /** 순간 이동·놀이기구 내림 횟수(카메라가 바로 붙는다) */
  jumps = 0;
  private spd = 0;
  private boost = 0;
  private cruise = 0;
  private fx = 0;
  private fy = 0;
  private m = 0;
  private dt = 0;
  /** 못 지나가는 꾸밈 */
  readonly blockers: Blocker[] = [];
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

  /** 몸 크기(지금 게임의 대포 안처럼 작아지는 일은 없다) */
  get bodyScale(): number {
    return 1;
  }

  /**
   * 아바타가 그림자를 놓는 높이: 아바타는 (지금 게임의 별 반지름 S.R + 이 값)에 그림자를 둔다.
   * 이 작은 별에서는 그 합이 발밑 바닥(땅 또는 접시)의 반지름이 되게 맞춘다
   */
  get gNow(): number {
    return this.stand.R + this.floor - S.R;
  }

  /** 카메라가 바로 붙어야 하면 true(한 번 읽으면 지운다) */
  takeSnap(): boolean {
    const s = this.snap;
    this.snap = false;
    return s;
  }

  /** dir 자리·높이 alt 에 heading 쪽을 보고 선다 */
  teleport(dir: THREE.Vector3, heading: THREE.Vector3, alt: number) {
    this.p.copy(dir).normalize();
    this.lookAlong(heading);
    this.alt = alt;
    this.floor = this.stand.floorBelow(this.p, alt);
    this.air = alt - this.floor;
    this.vy = 0;
    this.spd = 0;
    this.boost = 0;
    this.carrier = null;
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
    this.walk();
    this.fall();
  }

  /** 세계 자리를 정한다(둥실 흔들림까지) */
  place(time: number) {
    const bobPhase = time * 1.7,
      bob = Math.sin(bobPhase) * 0.08;
    const radius = this.stand.R + this.alt + S.hover + bob;
    this.P.copy(this.p).multiplyScalar(radius);
  }

  // 끌기로 방향을 틀고 나아간다(지금 게임의 Player.move 와 같은 셈, 비탈 없음)
  private walk() {
    const { p, h, vel, dt, fx, m } = this;
    if (m > 0) {
      right.crossVectors(h, p).normalize();
      want.copy(h).multiplyScalar(this.fy).addScaledVector(right, fx).normalize();
      const turnAngle = -S.turn * dt * fx * m;
      h.applyAxisAngle(p, turnAngle);
      const steer = ease(6, dt);
      vel.lerp(want, steer).normalize();
    }
    const spdRate = m > this.spd ? 2.2 : 1.1;
    this.spd += (m - this.spd) * ease(spdRate, dt);
    const boostDecay = -0.85 * dt;
    this.boost *= Math.exp(boostDecay);
    const isCruising = m > CRUISE.firm && Math.abs(fx) < CRUISE.straight;
    const cruiseTarget = isCruising ? CRUISE.max : 0;
    const cruiseRate = isCruising ? CRUISE.rise : CRUISE.fall;
    this.cruise += (cruiseTarget - this.cruise) * ease(cruiseRate, dt);
    const tot = this.spd * (1 + this.cruise) + this.boost;
    this.tot = tot;
    if (tot <= 0.002) return;
    const velUp = vel.dot(p);
    vel.addScaledVector(p, -velUp).normalize();
    axis.crossVectors(p, vel).normalize();
    // 어느 층에서도 같은 빠르기: 지금 높이의 반지름으로 나눈 각만큼
    const radius = this.stand.R + this.alt;
    const stepAngle = (S.speed * tot * dt) / radius;
    before.copy(p);
    p.applyAxisAngle(axis, stepAngle).normalize();
    if (this.hitsPlateSide()) p.copy(before);
    this.stand.pushOutOfColumn(p, this.alt, this.t.walk.bodyHalf);
    this.pushOutOfBlockers();
    const hUp = h.dot(p);
    h.addScaledVector(p, -hUp).normalize();
  }

  // 꾸밈 속으로는 못 들어간다: 둘레로 밀어낸다(같은 층에 서 있고 그 키 아래일 때만)
  private pushOutOfBlockers() {
    const { p } = this;
    const radius = this.stand.R + this.alt;
    for (const b of this.blockers) {
      const isBeside = this.alt >= b.floor - 0.3 && this.alt < b.floor + b.height;
      if (!isBeside) continue;
      const reach = (b.radius + this.t.walk.bodyHalf) / radius;
      const now = p.angleTo(b.v);
      if (now >= reach) continue;
      axis.crossVectors(b.v, p);
      if (axis.lengthSq() < 1e-12) axis.crossVectors(b.v, this.h);
      axis.normalize();
      p.copy(b.v).applyAxisAngle(axis, reach).normalize();
    }
  }

  // 접시 옆면으로는 못 들어간다(윗면 바로 아래까지는 올라선다 — floorBelow 의 step)
  private hitsPlateSide(): boolean {
    const { stand } = this;
    const head = this.alt + S.hover + this.t.walk.bodyTop;
    const was = stand.angleOf(before),
      now = stand.angleOf(this.p);
    for (const plate of stand.plates) {
      const isEntering = now < plate.ang && was >= plate.ang;
      const isBeside = head > plate.bottom && this.alt < plate.h - 0.3;
      if (isEntering && isBeside) return true;
    }
    return false;
  }

  // 발밑이 꺼지면 둥실 떨어지고, 떨어지는 동안 받는 접시를 벗어나지 않는다
  private fall() {
    const { stand, dt } = this;
    const { fallGravity, fallLimit, catchMargin, bodyTop } = this.t.walk;
    this.floor = stand.floorBelow(this.p, this.alt);
    const isAirborne = this.alt > this.floor + 1e-4 || this.vy > 0;
    if (isAirborne) {
      const pulled = this.vy - fallGravity * dt;
      this.vy = Math.max(pulled, -fallLimit);
      this.alt += this.vy * dt;
      if (this.vy <= 0) stand.keepOverCatcher(this.p, this.alt, catchMargin);
      const ceiling = stand.ceilingAbove(this.p, this.floor);
      const headroom = S.hover + bodyTop;
      if (this.alt + headroom > ceiling) {
        this.alt = ceiling - headroom;
        this.vy = Math.min(this.vy, 0);
      }
      if (this.alt <= this.floor) {
        // 내려앉으면 미끄러지던 기세를 줄인다(받은 접시에서 또 굴러떨어지지 않게)
        this.alt = this.floor;
        this.vy = 0;
        this.spd *= this.t.walk.landKeep;
        this.cruise = 0;
      }
    } else this.alt = this.floor;
    this.air = this.alt - this.floor;
  }

  // 길에 실려 간다: 길의 자리에서 몸 방향·높이를 읽고, 나아가는 쪽을 길 쪽으로
  private ride() {
    const c = this.carrier!;
    const step = this.dt / c.seconds;
    const reached = this.carriedT + step;
    this.carriedT = Math.min(1, reached);
    c.at(this.carriedT, spot);
    const radius = spot.length();
    const peek = this.carriedT + 0.02;
    const nextT = Math.min(1, peek);
    c.at(nextT, ahead);
    this.p.copy(spot).normalize();
    this.alt = radius - this.stand.R;
    ahead.normalize().sub(this.p);
    const along = ahead.lengthSq() > 1e-10;
    if (along) this.lookAlong(ahead);
    this.tot = 1;
    this.floor = this.stand.floorBelow(this.p, this.alt);
    this.air = this.alt - this.floor;
    if (this.carriedT < 1) return;
    this.carrier = null;
    this.alt = this.floor;
    this.air = 0;
    this.spd = 0.6;
    this.jumps++;
    c.arrived?.();
  }

  // 보는 쪽·나아가는 쪽을 dir 의 접선 성분으로
  private lookAlong(dir: THREE.Vector3) {
    const up = dir.dot(this.p);
    this.h.copy(dir).addScaledVector(this.p, -up);
    if (this.h.lengthSq() < 1e-10) return;
    this.h.normalize();
    this.vel.copy(this.h);
  }
}
