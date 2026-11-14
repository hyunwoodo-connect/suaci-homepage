import * as THREE from "three";

import { ease } from "../core/frame";
import { FLIGHT, S } from "../settings";
import { clamp, offset, START } from "../world/sphere";
import type { Terrain } from "../world/terrain";

// 나(몸)의 상태와 움직임. 다른 모듈은 이 상태를 직접 바꾸지 않고 아래의 좁은 요청으로만 부탁한다:
//   튕겨 올리기(bounce·lift·raise·hop·easeLift) · 빨라지기(boost·boostAtLeast) · 잠깐 방향 안 먹기(stun) ·
//   방향 틀기(turnTo·lookTo·kick) · 길에 실어 가기(glide·keepOnLine) · 막히기(block·blockBody) · 느려지기(slowDown) ·
//   붙잡기(grab → 붙잡은 쪽만 몸을 옮기는 손잡이, release) · 날개(giveWings·flap) · 풍선에 매달리기(hang·letGo).
// 끌기·방향키로 가고, 곧게 오래 날수록 조금씩 빨라지고, 내리막에서 빨라진다. 떠오르면 천천히 활공해 내려온다

/** 끌기 방향(fx 옆, fy 앞)과 세기(m). dragFx 는 손가락으로 끄는 옆 방향만(방향키 빼고 — 몸 기울기가 쓴다) */
export interface Intent {
  fx: number;
  fy: number;
  m: number;
  dragFx: number;
}

/** 나를 붙잡는 놀이기구(대포·회오리·고래…) */
export interface Holder {
  /** 붙잡혀 있는 동안 중력을 멈춘다(고래 등·혜성) */
  readonly freezesGravity?: boolean;
  /** 대포 안에서처럼 몸이 작아진다(1 이 그대로) */
  readonly bodyScale?: number;
  /** 붙잡혀 있는 동안 카메라가 하는 일: spin 회오리·깔때기(화면이 같이 돌지 않게), ride 고래·혜성(뒤로 물러난다) */
  readonly cameraMode?: "spin" | "ride";
}

/** 붙잡은 놀이기구만 받는 손잡이: 이걸로만 몸을 옮긴다 */
export interface HeldBody {
  readonly p: THREE.Vector3;
  readonly h: THREE.Vector3;
  readonly vel: THREE.Vector3;
  air: number;
  vy: number;
  /** 다른 자리로 순간 이동했다(카메라를 바로 붙이고 발밑 높이를 새로 잰다) */
  teleported(): void;
}

/** 놓을 때 한꺼번에 주는 것 */
export interface Release {
  vel?: THREE.Vector3;
  boost?: number;
  vy?: number;
  stun?: number;
  /** 놓는 순간 몸을 땅에서 띄운다(air = 0.01) */
  hop?: boolean;
}

const d = new THREE.Vector3(),
  right = new THREE.Vector3(),
  axis = new THREE.Vector3(),
  tmp = new THREE.Vector3(),
  sn = new THREE.Vector3(),
  bt = new THREE.Vector3();

/** 나 */
export class Player {
  // ---- 몸(밖에서는 읽기만) ----
  private readonly _p = new THREE.Vector3();
  private readonly _h = new THREE.Vector3();
  private readonly _vel = new THREE.Vector3();
  private readonly _P = new THREE.Vector3();
  private _spd = 0;
  private _boost = 0;
  private _air = 0;
  private _vy = 0;
  private sl = 0;
  private cruise = 0;
  private _stun = 0;
  private gh = 0;
  private _alt = 0;
  private _tot = 0;
  private _gNow = 0;
  private _snap = true;
  private dt = 0;
  // ---- 이번 프레임 입력 ----
  private _fx = 0;
  private _fy = 0;
  private _m = 0;
  private _m0 = 0;
  private _dragFx = 0;
  // ---- 붙잡힘·날개·풍선 ----
  private holder: Holder | null = null;
  private hanger: object | null = null;
  private _held = false;
  private wingT = 0;
  private _jumps = 0;
  private readonly body: HeldBody;

  constructor(private readonly terrain: Terrain) {
    // 붙잡은 쪽이 쓰는 손잡이: 몸의 벡터는 그대로 건네고, 높이·위아래 속도는 이 몸의 값을 읽고 쓴다
    const body = {
      p: this._p,
      h: this._h,
      vel: this._vel,
      teleported: () => {
        this._snap = true;
        this.gh = this.terrain.groundAt(this._p);
        this._jumps++;
      },
    } as HeldBody;
    Object.defineProperty(body, "air", {
      get: () => this._air,
      set: (a: number) => {
        this._air = a;
      },
    });
    Object.defineProperty(body, "vy", {
      get: () => this._vy,
      set: (v: number) => {
        this._vy = v;
      },
    });
    this.body = body;
  }

  // ---- 읽기 ----
  /** 행성 위 자리(단위 벡터) */
  get p(): Readonly<THREE.Vector3> {
    return this._p;
  }
  /** 보는 쪽 */
  get h(): Readonly<THREE.Vector3> {
    return this._h;
  }
  /** 나아가는 쪽 */
  get vel(): Readonly<THREE.Vector3> {
    return this._vel;
  }
  /** 세계 자리(이번 프레임 몸을 놓은 뒤) */
  get P(): Readonly<THREE.Vector3> {
    return this._P;
  }
  /** 땅 위로 솟은 높이 */
  get air(): number {
    return this._air;
  }
  /** 위아래 속도 */
  get vy(): number {
    return this._vy;
  }
  /** 지금 높이(땅 + 떠 있는 높이 + 솟은 높이) */
  get alt(): number {
    return this._alt;
  }
  /** 이번 프레임 빠르기(배수) */
  get tot(): number {
    return this._tot;
  }
  /** 끄는 세기로 따라가는 빠르기 */
  get spd(): number {
    return this._spd;
  }
  get boostNow(): number {
    return this._boost;
  }
  /** 발밑 땅 높이 */
  get gNow(): number {
    return this._gNow;
  }
  /** 부드럽게 따라가는 발밑 높이(놀이기구가 몸 높이를 맞출 때 바닥으로 쓴다) */
  get floor(): number {
    const settled = this._gNow - 0.4;
    return Math.max(this.gh, settled);
  }
  /** 끌기 방향·세기(놀이기구에 실려 있으면 세기는 0) */
  get fx(): number {
    return this._fx;
  }
  get fy(): number {
    return this._fy;
  }
  get m(): number {
    return this._m;
  }
  /** 손가락으로 끄는 옆 방향(방향키는 빼고) — 몸을 옆으로 기울이는 데 쓴다 */
  get dragFx(): number {
    return this._dragFx;
  }
  /** 실려 있어도 손가락이 끄는 세기(고래에서 내릴 때) */
  get m0(): number {
    return this._m0;
  }
  /** 이번 프레임을 시작할 때 놀이기구에 붙잡혀 있었다(프레임 도중에 붙잡혀도 이 값은 그대로다) */
  get held(): boolean {
    return this._held;
  }
  /** 지금 무엇엔가 붙잡혀 있다 */
  get isHeld(): boolean {
    return this.holder !== null;
  }
  /** 순간 이동한 횟수(꼬리 리본이 끊어 다시 그린다) */
  get jumps(): number {
    return this._jumps;
  }
  /** 이 놀이기구가 붙잡고 있나 */
  isHeldBy(h: Holder): boolean {
    return this.holder === h;
  }
  /** 날개를 달고 있다(남은 시간) */
  get wingsLeft(): number {
    return this.wingT;
  }
  /** 풍선 줄에 매달려 있다 */
  get isHanging(): boolean {
    return this.hanger !== null;
  }
  /** 지금 붙잡은 놀이기구가 카메라에 바라는 것(없으면 null) */
  get holderCamera(): "spin" | "ride" | null {
    return this.holder?.cameraMode ?? null;
  }
  /** 몸 크기(대포 안에서 작아진다) */
  get bodyScale(): number {
    return this.holder?.bodyScale ?? 1;
  }
  /** 다음 카메라를 바로 붙인다(한 번 읽으면 꺼진다) */
  takeSnap(): boolean {
    const s = this._snap;
    this._snap = false;
    return s;
  }

  // ---- 프레임 ----
  /** 출발점으로: 광장 곁에서 광장을 보고 선다 */
  goHome() {
    const home = offset(START, 20, 200);
    this._p.copy(home);
    this._h.copy(START).sub(this._p);
    const hRadial = this._h.dot(this._p);
    this._h.addScaledVector(this._p, -hRadial).normalize();
    this._vel.copy(this._h);
    this._spd = 0;
    this._boost = 0;
    this._air = 0;
    this._vy = 0;
    this._snap = true;
    this.holder = null;
    this.hanger = null;
    this.wingT = 0;
    this._jumps++;
  }

  /** 이번 프레임의 입력. 붙잡혀 있으면 끌어도 움직이지 않는다 */
  begin(dt: number, intent: Intent) {
    this.dt = dt;
    this._held = this.holder !== null;
    this._fx = intent.fx;
    this._dragFx = intent.dragFx;
    this._fy = intent.fy;
    this._m0 = intent.m;
    this._m = this._held ? 0 : intent.m;
    if (this._stun > 0) this._stun -= dt;
  }

  /** 나아가기: 방향 틀기·빠르기·순항·비탈. 그리고 떠오름과 내려앉음 */
  move() {
    const p = this._p,
      h = this._h,
      vel = this._vel,
      dt = this.dt,
      fx = this._fx,
      m = this._m;
    if (m > 0) {
      right.crossVectors(h, p).normalize();
      d.copy(h).multiplyScalar(this._fy).addScaledVector(right, fx).normalize();
      const turnAngle = -S.turn * dt * fx * m;
      h.applyAxisAngle(p, turnAngle);
      // 튕기거나 쏘아진 직후에는 잠깐 방향이 안 먹는다
      if (this._stun <= 0) {
        const steer = ease(6, dt);
        vel.lerp(d, steer).normalize();
      }
    }
    // 빨라질 때는 빨리, 느려질 때는 천천히 따라간다
    const spdRate = m > this._spd ? 2.2 : 1.1;
    this._spd += (m - this._spd) * ease(spdRate, dt);
    const boostDecay = -0.85 * dt;
    this._boost *= Math.exp(boostDecay);
    const gNow = this.terrain.groundAt(p);
    this._gNow = gNow;
    // 순항: 곧게 오래 날수록 조금씩 더 빨라진다. 꺾거나 멈추면 풀린다
    const isCruising = m > 0.8 && Math.abs(fx) < 0.35;
    const cruiseTarget = isCruising ? 0.9 : 0;
    const cruiseRate = isCruising ? 0.22 : 1.2;
    this.cruise += (cruiseTarget - this.cruise) * ease(cruiseRate, dt);
    const balloonMul = this.hanger ? 0.6 : 1;
    const wingMul = this.wingT > 0 && this._air > 1 ? 1.35 : 1;
    const tot = this._held
      ? 0
      : (this._spd * (1 + this.sl + this.cruise) + this._boost) * balloonMul * wingMul;
    this._tot = tot;
    const slDecay = -3 * dt;
    if (tot > 0.002) {
      const velRadial = vel.dot(p);
      vel.addScaledVector(p, -velRadial).normalize();
      axis.crossVectors(p, vel).normalize();
      // 비탈: 내리막이면 빨라지고 오르막이면 느려진다
      const lookAhead = 1.5 / S.R;
      tmp.copy(p).applyAxisAngle(axis, lookAhead);
      const slope = this._air < 0.6 ? (this.terrain.groundAt(tmp) - gNow) / 1.5 : 0;
      const slopePush = -slope * 1.6;
      const slTarget = clamp(slopePush, -0.35, 1.0);
      const slEase = 1 - Math.exp(slDecay);
      this.sl += (slTarget - this.sl) * slEase;
      const stepAngle = (S.speed / S.R) * tot * dt;
      p.applyAxisAngle(axis, stepAngle).normalize();
      const hRadial = h.dot(p);
      h.addScaledVector(p, -hRadial).normalize();
    } else this.sl *= Math.exp(slDecay);
    // 떠오름과 내려앉음 — 천천히 활공해 내려온다(날개가 있으면 더 천천히)
    if (this.wingT > 0) this.wingT -= dt;
    const winged = this.wingT > 0;
    const G = winged ? FLIGHT.wingGravity : FLIGHT.gravity,
      VT = winged ? FLIGHT.wingFallLimit : FLIGHT.fallLimit;
    const frozen = this.holder?.freezesGravity === true;
    if (!frozen && (this._air > 0 || this._vy > 0)) {
      this._vy -= G * dt;
      if (this._vy < VT) this._vy = VT;
      this._air += this._vy * FLIGHT.vertical * dt;
      if (this._air <= 0) {
        this._air = 0;
        this._vy = 0;
      }
    }
    this.gh += (gNow - this.gh) * ease(5, dt);
    this.updateAlt();
  }

  /** 지금 높이를 다시 잰다(놀이기구가 몸을 옮긴 뒤) */
  updateAlt() {
    const settledGround = this._gNow - 0.4;
    this._alt = Math.max(this.gh, settledGround) + S.hover + this._air;
  }

  /** 몸을 이번 프레임 자리에 놓는다(둥실 흔들림까지) — 세계 자리 P 가 정해진다 */
  place(time: number) {
    const bobPhase = time * 1.7,
      bob = Math.sin(bobPhase) * 0.08,
      radius = S.R + this._alt + bob;
    this._P.copy(this._p).multiplyScalar(radius);
  }

  // ---- 요청: 튕겨 올리기 ----
  /** 정한 세기로 튕겨 올린다 */
  bounce(vy: number) {
    this._vy = vy;
    this.takeOff();
  }
  /** 적어도 이만큼 튕겨 올린다 */
  lift(vy: number) {
    this._vy = Math.max(this._vy, vy);
    this.takeOff();
  }
  /** 적어도 이만큼 올린다(땅에 붙은 채면 다음 프레임에 뜬다) */
  raise(vy: number) {
    this._vy = Math.max(this._vy, vy);
  }
  /** 정한 세기로, 떠 있어도 땅에서 막 뛰는 것처럼 */
  hop(vy: number) {
    this._vy = vy;
    this._air = 0.01;
  }
  /** 위로 미는 바람: 정한 세기로 서서히 */
  easeLift(target: number, k: number) {
    this._vy += (target - this._vy) * k;
    this.takeOff();
  }

  // ---- 요청: 빠르기 ----
  /** 정한 만큼 빨라진다 */
  boost(k: number) {
    this._boost = k;
  }
  /** 적어도 이만큼 빨라진다 */
  boostAtLeast(k: number) {
    this._boost = Math.max(this._boost, k);
  }
  /** 잠깐 방향이 안 먹는다 */
  stun(t: number) {
    this._stun = t;
  }
  /** 저절로 느려진다(쉬는 곳·부딪힘): 빠르기에 exp(-rate·dt) */
  slowDown(rate: number) {
    const decay = -rate * this.dt;
    this._spd *= Math.exp(decay);
  }

  // ---- 요청: 방향 ----
  /** 나아가는 쪽을 dir 쪽으로 k 만큼 */
  turnTo(dir: THREE.Vector3, k: number) {
    this._vel.lerp(dir, k).normalize();
  }
  /** 보는 쪽을 dir 쪽으로 k 만큼(땅에 붙인 채) */
  lookTo(dir: THREE.Vector3, k: number) {
    const h = this._h,
      p = this._p;
    h.lerp(dir, k);
    const hUp = h.dot(p);
    h.addScaledVector(p, -hUp).normalize();
  }
  /** 나아가는 쪽에 n 방향으로 k 만큼 더한다(벽에 튕길 때) */
  kick(n: THREE.Vector3, k: number) {
    this._vel.addScaledVector(n, k).normalize();
  }

  // ---- 요청: 길에 실어 가기 ----
  /** 오르내림을 멈추고 높이를 target 쪽으로 k 만큼(레일·바람길·다리) */
  glide(targetAir: number, k: number) {
    this._vy = 0;
    this._air += (targetAir - this._air) * k;
  }
  /** o 를 지나는 d 방향 줄 위에 몸을 붙인다(옆으로 밀려나지 않게) */
  keepOnLine(o: THREE.Vector3, d: THREE.Vector3) {
    tmp.copy(this._p).sub(o);
    const along = tmp.dot(d);
    this._p.copy(o).addScaledVector(d, along).normalize();
  }

  // ---- 요청: 막히기 ----
  /**
   * 속으로는 못 들어간다: v 둘레 core 안(높이 top 아래)에 있으면 둘레로 밀어내고 들어오던 속도는 옆으로 흘린다. 밀어냈으면 true.
   * 정면으로 부딪혀도 서 버리지 않게 안으로 들어가던 속도만 지우고 둘레를 따라 미끄러진다. 정면이라 옆 방향이 없으면 한쪽을 골라 준다
   */
  block(v: THREE.Vector3, core: number, top: number): boolean {
    const p = this._p,
      vel = this._vel;
    if (this._air >= top || p.angleTo(v) * S.R >= core) return false;
    // 밀어낼 방향: v 에서 나를 향하는 접선(딱 겹치면 오던 길 반대로)
    sn.copy(p).sub(v);
    const snAlongV = sn.dot(v);
    sn.addScaledVector(v, -snAlongV);
    if (sn.lengthSq() < 1e-12) sn.copy(vel).negate();
    sn.normalize();
    const coreAngle = core / S.R;
    p.copy(v).addScaledVector(sn, coreAngle).normalize();
    const snAlongP = sn.dot(p);
    sn.addScaledVector(p, -snAlongP).normalize();
    const vn = vel.dot(sn);
    if (vn < 0) {
      vel.addScaledVector(sn, -vn);
      bt.crossVectors(p, sn).normalize();
      const side = vel.dot(bt);
      if (Math.abs(side) < 0.45) {
        // 거의 정면: 옆으로 빠질 쪽이 뚜렷하면 그쪽, 아니면 보고 있는 쪽으로
        let sg: number;
        if (Math.abs(side) > 0.02) sg = Math.sign(side);
        else sg = this._h.dot(bt) >= 0 ? 1 : -1;
        const nudge = sg * 0.6;
        vel.addScaledVector(bt, nudge);
      }
      const velRadial = vel.dot(p);
      vel.addScaledVector(p, -velRadial).normalize();
      // 닿아 있는 동안만 조금씩 느려진다
      this.slowDown(1.2);
    }
    return true;
  }
  /** 높이와 상관없이 막힌다(키 큰 몸통: 나무 갓·조형물·떠 있는 섬) */
  blockBody(v: THREE.Vector3, core: number): boolean {
    const a0 = this._air;
    this._air = 0;
    const hit = this.block(v, core, 1);
    this._air = a0;
    return hit;
  }

  // ---- 요청: 붙잡기 ----
  /** 놀이기구가 나를 붙잡는다. 이미 다른 것에 붙잡혀 있으면 null */
  grab(h: Holder): HeldBody | null {
    if (this.holder) return null;
    this.holder = h;
    return this.body;
  }
  /** 붙잡은 놀이기구가 지금 쓰는 손잡이(붙잡고 있지 않으면 null) */
  bodyFor(h: Holder): HeldBody | null {
    return this.holder === h ? this.body : null;
  }
  /** 놓는다 — 놓으며 줄 것을 한꺼번에 */
  release(h: Holder, r: Release = {}) {
    if (this.holder !== h) return;
    this.holder = null;
    if (r.vel) this._vel.copy(r.vel);
    if (r.boost !== undefined) this._boost = r.boost;
    if (r.vy !== undefined) this._vy = r.vy;
    if (r.hop) this._air = 0.01;
    if (r.stun !== undefined) this._stun = r.stun;
  }

  // ---- 요청: 날개·풍선 ----
  /** 날개를 단다(남은 시간) */
  giveWings(t: number) {
    this.wingT = t;
  }
  /** 날갯짓: 칙 할 때마다 올라간다 */
  flap() {
    const flapVy = Math.max(this._vy, 0) + 5.5;
    this._vy = Math.min(9, flapVy);
    if (this._air <= 0) this._air = 0.01;
  }
  /** 풍선 줄에 매달린다(느리게 간다) */
  hang(by: object) {
    this.hanger = by;
  }
  /** 풍선을 놓는다 */
  letGo(by: object) {
    if (this.hanger === by) this.hanger = null;
  }
  /** 매달린 풍선(없으면 null) */
  get hangingOn(): object | null {
    return this.hanger;
  }

  /** 시험·개발용: 그 자리에 놓는다(높이 air, 보는 쪽 dir) */
  teleport(v: THREE.Vector3, dir: THREE.Vector3 | null, air: number) {
    this._p.copy(v).normalize();
    if (dir) this._h.copy(dir);
    const hUp = this._h.dot(this._p);
    this._h.addScaledVector(this._p, -hUp).normalize();
    this._vel.copy(this._h);
    this._air = air;
    this._vy = 0;
    this._snap = true;
    this._jumps++;
  }

  private takeOff() {
    if (this._air <= 0) this._air = 0.01;
  }
}
