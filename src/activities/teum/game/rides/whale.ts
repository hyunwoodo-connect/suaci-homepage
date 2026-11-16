import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Holder } from "../player/player";
import type { Services } from "../services";
import { S } from "../settings";
import { fromInto } from "../world/sphere";
import type { HasHeights, Height } from "../world/tall";

// 고래 등 — 고래는 한자리를 돌지 않는다. 출발 마을에서 떠나 행성을 한 바퀴 크게 돌고, 바퀴마다 방향을 90도씩 바꿔
// 여섯 마을 하늘을 차례로 지난다. 높이는 길 아래 가장 높은 것 + 10m 를 미리 재 둔 표(빈 들판 위에서는 낮게 내려온다).
// 내가 가까이(220m 안) 있으면 천천히 가서 따라잡을 수 있고, 등에 타면 빨리 간다. 아래에서 뛰어오르기만 하면 등으로 끌어 올린다

/** 한 바퀴의 길이(자리표 거리 — 행성 둘레)와 빠르기(자리표 거리/초) */
const LAP = 1485.2,
  SPEED = 6.8;
/** 출발 마을에서 조금 떨어진 곳에서 떠난다(바퀴의 몫) */
const LAP_START = 0.02;
/** 바퀴의 끝 몫(TURN_FROM 뒤 TURN_SPAN 동안 다음 방향으로 부드럽게 돈다) */
const TURN_FROM = 0.94,
  TURN_SPAN = 0.06;
/** 높이 표: 바퀴마다 나눈 칸 수, 길 아래를 보는 폭(코사인), 가장 낮게·꼭대기 위로 띄우는 높이·가장 높게 */
const PROFILE_N = 240,
  PROFILE_COS = 0.9985,
  PROFILE_FLOOR = 44,
  PROFILE_CLEAR = 16,
  PROFILE_CAP = 112;
/** 표를 고르는 폭: 높은 것 곁(±3칸)을 같이 넘고, ±4칸을 고르게 펴서 오르내림이 완만하다 */
const DILATE = 3,
  SMOOTH = 4;
/** 빠르기: 멀리 있을 때 1, 내가 220m 안이면 0.3, 등에 타면 1.7 */
const NEAR_SLOW = 220,
  SLOW_RATE = 0.3,
  RIDE_RATE = 1.7;
/** 등으로 끌어 올리는 범위: 46m 안에서 떠 있거나(18m 안이면 땅에서도), 고래 등 21m 아래까지 */
const PICK_REACH = 46,
  PICK_GROUND = 18,
  PICK_BELOW = 21;
/** 등에 탄 채로 가장 오래(초) */
const RIDE_MAX = 90;
/** 내린 뒤 다시 태우려면 땅에 내려앉거나 이만큼(m) 멀어져야 한다 — 고래는 내 곁에서 느려져서, 떨어지는 동안 다시 끌려 올라갔다 */
const REARM_AWAY = 90,
  REARM_LANDED = 0.3;
/** 고래가 지나간다는 안내(220m 안으로 오면 한 번, 320m 밖으로 멀어지면 다시) · 소리(240m) */
const HINT_IN = 220,
  HINT_OUT = 320,
  NEAR_SOUND = 240;

/** 한 번 지나가기(언박싱의 고래): 내 앞 이만큼(m)에서 와서 내 위를 지나 이만큼 더 가고, 땅에서 이 높이(m)로 이 빠르기(m/s), 큰 바퀴로 돌아가는 시간(초) */
const VISIT_LEAD = 160,
  VISIT_TAIL = 160,
  VISIT_LIFT = 24,
  VISIT_SPEED = 7,
  VISIT_BACK = 6;

const backQ = new THREE.Quaternion(),
  stepQ = new THREE.Quaternion();
const bx = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  ahead = new THREE.Vector3(),
  tv = new THREE.Vector3();

/** 고래(나를 등에 태운다) */
export class Whale implements Thing, Holder {
  readonly rideName = "whale";
  /** 등에 타 있는 동안 카메라가 뒤로 물러나고, 중력이 멈춘다 */
  readonly cameraMode = "ride";
  readonly freezesGravity = true;
  /** 자리(그룹)와 모양(도형 또는 에셋)을 나눈다 */
  readonly g = new THREE.Group();
  readonly prim: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  /** 지금 자리와 나아가는 쪽 */
  readonly v = new THREE.Vector3();
  readonly f = new THREE.Vector3();
  /** 지금 떠 있는 높이 — 높이 표를 천천히 따라간다 */
  WH = 70;
  /** 높이 표: 방향 0 도 바퀴와 90 도 바퀴(180·270 도 바퀴는 같은 길을 거꾸로 간다). 풍경을 다 놓은 뒤 choosePath 가 채운다 */
  profile: Float32Array[] | null = null;
  /** 고래의 시계(초 — 빠르기만큼 간다) */
  clock = 0;
  /** 등에 탔을 때 내 몸이 떠 있는 높이 — 고래 모델이 오면 그 등 높이로 */
  rideH = 5.6;
  /** 고래가 출렁이는 높이(등에 탄 몸도 같이) */
  wbob = 0;
  /** 큰 바퀴를 도는 것(프레임 처음, 내가 움직이기 전) */
  readonly mover: Thing;
  private rate = 1;
  private on = false;
  private t = 0;
  private cool = 0;
  /** 태울 수 있나(내린 뒤에는 땅에 닿거나 멀어질 때까지 아니다) */
  private armed = true;
  private hinted = false;
  private near = false;
  /** 한 번 지나가기: 흐른 시간(초, 안 하면 -1)·출발 자리·도는 축·끝난 자리 */
  private visitT = -1;
  private readonly visitFrom = new THREE.Vector3();
  private readonly visitAxis = new THREE.Vector3();
  private readonly visitEnd = new THREE.Vector3();
  /** 한 번이라도 움직였나(처음 프레임에는 고래 자리를 아직 모르는 것으로 쳐서 제 빠르기로 떠난다 — 시제품과 같은 첫 빠르기) */
  private moved = false;

  constructor(
    private readonly s: Services,
    private readonly whirls: Holder,
  ) {
    const primGeo = new THREE.SphereGeometry(1, 28, 18);
    const primMat = new THREE.MeshBasicMaterial({ color: 0xd7dad9 });
    this.prim = new THREE.Mesh(primGeo, primMat);
    this.prim.scale.set(16, 5, 6.5);
    this.g.add(this.prim);
    s.scene.add(this.g);
    this.mover = { update: (f) => this.move(f), dispose: () => {} };
  }

  /**
   * 높이 표를 만든다(나무·꽃·조형물·랜드마크를 다 놓은 뒤): 바퀴마다 240 칸, 칸마다 길 아래(코사인 0.9985 안) 가장 높은 것(적어도 44m) + 16m.
   * 높은 것 곁도 같이 넘게 넓히고(±3칸), 고르게 편다(±4칸). 112m 를 넘지 않는다
   */
  choosePath(sources: readonly HasHeights[]) {
    const all: Height[] = [];
    for (const src of sources) src.pushHeights(all);
    this.profile = [0, 90].map((bear) => {
      const raw = new Float32Array(PROFILE_N),
        wide = new Float32Array(PROFILE_N),
        out = new Float32Array(PROFILE_N);
      for (let i = 0; i < PROFILE_N; i++) {
        const dist = (LAP * (i + 0.5)) / PROFILE_N;
        fromInto(tv, dist, bear);
        let top = PROFILE_FLOOR;
        for (const [ov, H] of all) if (ov.dot(tv) > PROFILE_COS && H > top) top = H;
        raw[i] = top + PROFILE_CLEAR;
      }
      for (let i = 0; i < PROFILE_N; i++) {
        let m = 0;
        for (let j = -DILATE; j <= DILATE; j++) {
          const near = i + j;
          const at = wrap(near);
          m = Math.max(m, raw[at]);
        }
        wide[i] = m;
      }
      for (let i = 0; i < PROFILE_N; i++) {
        let a = 0;
        for (let j = -SMOOTH; j <= SMOOTH; j++) {
          const near = i + j;
          const at = wrap(near);
          a += wide[at];
        }
        const mean = a / (2 * SMOOTH + 1);
        out[i] = Math.min(PROFILE_CAP, mean);
      }
      return out;
    });
  }

  /** 고래 모델: 머리가 +z 라서 나아가는 방향(+x)으로 돌려 놓는다. 오면 도형 고래를 숨기고 등 높이를 모델 키에 맞춘다 */
  fitModels() {
    const models = this.s.models;
    if (!models.has("whale")) return;
    const W = models.fit("whale", 64, "z");
    W.rotation.y = Math.PI / 2;
    this.g.add(W);
    // 등 높이를 맞추지 않으면 등에 타도 고래 몸속에 있다
    const backH = W.userData.hh + 0.9;
    models.when("whale", () => {
      this.rideH = backH;
    });
    models.swapWhenReady("whale", [this.prim]);
  }

  /**
   * 한 번 지나가기: 내 앞쪽 하늘에서 와서 over 위를 dir 쪽으로 천천히(땅에서 24m) 지나간다 — 아래에 서 있거나 뛰어오르면 올라탈 수 있다.
   * 다 지나가면 큰 바퀴로 돌아간다. 이미 지나가는 중이면 그대로 간다(처음으로 되돌아가 보이지 않게)
   */
  flyBy(over: THREE.Vector3, dir: THREE.Vector3) {
    if (this.visitT >= 0) return;
    this.visitAxis.crossVectors(over, dir).normalize();
    const back = -VISIT_LEAD / S.R;
    this.visitFrom.copy(over).normalize().applyAxisAngle(this.visitAxis, back);
    this.visitT = 0;
  }

  /** 이번 프레임에는 나를 태우지 않는다(언박싱처럼 내가 멈춰 있는 동안) */
  keepOff() {
    this.cool = Math.max(this.cool, 0.2);
  }

  /** 아래에서 뛰어오르면 등으로 끌어 올리고, 끌면 내린다. 가까이 오면 한 번 알려 준다 */
  update(f: Frame) {
    const { player, hud, camera, events } = this.s,
      dt = f.dt;
    if (this.cool > 0) this.cool -= dt;
    const d = player.p.angleTo(this.v) * S.R;
    if (!this.armed && !this.on && (player.air < REARM_LANDED || d > REARM_AWAY)) this.armed = true;
    // 다른 놀이기구에 실려 가는 중에도 올라탈 수 있다(시제품). 회오리에 실려 있을 때만은 아니다
    if (
      !this.on &&
      this.armed &&
      this.cool <= 0 &&
      !player.isHeldBy(this.whirls) &&
      (player.air > 0.2 || d < PICK_GROUND) &&
      d < PICK_REACH &&
      player.alt < this.WH + PICK_BELOW &&
      player.grab(this)
    ) {
      this.on = true;
      this.t = 0;
      hud.say("고래 등 — 끌면 내립니다");
    }
    const body = player.bodyFor(this);
    if (this.on && body) {
      this.t += dt;
      const k = ease(6, dt);
      body.p.lerp(this.v, k).normalize();
      body.h.lerp(this.f, k);
      const hUp = body.h.dot(body.p);
      body.h.addScaledVector(body.p, -hUp).normalize();
      body.vel.copy(body.h);
      body.vy = 0;
      const rideAir = this.WH + this.rideH + this.wbob - player.floor - S.hover;
      const targetAir = Math.max(0.01, rideAir);
      body.air += (targetAir - body.air) * k;
      if ((this.t > 1.2 && player.m0 > 0.6) || this.t > RIDE_MAX) {
        this.on = false;
        this.armed = false;
        this.cool = 4;
        player.release(this, { vy: 4.5, boost: 0.9 });
      }
    }
    // 고래·혜성에 탄 동안 카메라가 뒤로 물러난다
    const riding = player.heldWithCamera("ride");
    const rideTarget = riding ? 1 : 0;
    const blendPull = ease(3, dt);
    camera.easeRide(rideTarget, blendPull);
    // 가까이 왔다는 안내와 소리
    const wd = player.p.angleTo(this.v) * S.R;
    if (wd < HINT_IN && !this.hinted) {
      this.hinted = true;
      hud.say("고래가 지나갑니다 — 그 아래에서 뛰어오르면 태워 줍니다", 5.5);
    } else if (wd > HINT_OUT) this.hinted = false;
    const isNear = wd < NEAR_SOUND;
    if (isNear && !this.near) events.emit("whaleNear", {});
    this.near = isNear;
  }

  /** 치운다 */
  dispose() {
    this.g.removeFromParent();
    this.prim.geometry.dispose();
    this.prim.material.dispose();
  }

  // 큰 바퀴를 간다: 빠르기(가까우면 느리게·타면 빠르게)와 높이(표를 3초 앞서 본다)를 천천히 맞춘다
  private move(f: Frame) {
    const dt = f.dt,
      p = this.s.player.p;
    const near = this.moved && p.angleTo(this.v) * S.R < NEAR_SLOW;
    if (dt > 0) this.moved = true;
    const want = this.on ? RIDE_RATE : near ? SLOW_RATE : 1;
    // 시제품은 프레임마다 3%·2% 씩 다가간다 — 1/60 초 프레임에서 같고, 프레임이 달라도 빠르기는 같게
    const rateEase = perFrame(0.03, dt),
      heightEase = perFrame(0.02, dt);
    this.rate += (want - this.rate) * rateEase;
    this.clock += dt * this.rate;
    const bobPhase = f.time * 0.6;
    this.wbob = Math.sin(bobPhase) * 1.2;
    const lookAhead = this.clock + 3;
    let top = this.topAt(lookAhead);
    pointAt(this.clock, this.v);
    const aheadT = this.clock + 0.4;
    pointAt(aheadT, ahead);
    if (this.visitT >= 0) top = this.visit(dt, top);
    this.WH += (top - this.WH) * (this.visitT >= 0 ? perFrame(0.05, dt) : heightEase);
    this.f.copy(ahead).sub(this.v);
    const fUp = this.f.dot(this.v);
    this.f.addScaledVector(this.v, -fUp).normalize();
    const whaleRadius = S.R + this.WH + this.wbob;
    this.g.position.copy(this.v).multiplyScalar(whaleRadius);
    bx.crossVectors(this.v, this.f).normalize().negate();
    m4.makeBasis(this.f, this.v, bx);
    this.g.quaternion.setFromRotationMatrix(m4);
  }

  // 한 번 지나가기: 큰 바퀴 자리(v·ahead) 대신 지나가는 길 위에 놓고 그 높이를 돌려준다. 다 지나면 큰 바퀴 자리로 천천히 섞어 돌아간다
  private visit(dt: number, loopTop: number): number {
    this.visitT += dt;
    const along = this.visitT * VISIT_SPEED,
      total = VISIT_LEAD + VISIT_TAIL;
    if (along <= total) {
      const arc = along / S.R,
        nextArc = (along + 3) / S.R;
      this.v.copy(this.visitFrom).applyAxisAngle(this.visitAxis, arc);
      ahead.copy(this.visitFrom).applyAxisAngle(this.visitAxis, nextArc);
      this.visitEnd.copy(this.v);
      const ground = this.s.terrain.groundAt(this.v);
      return ground + VISIT_LIFT;
    }
    const back = (along - total) / VISIT_SPEED / VISIT_BACK;
    if (back >= 1) {
      this.visitT = -1;
      return loopTop;
    }
    // 끝난 자리에서 큰 바퀴 자리까지 행성 겉을 따라 돈다 — 그냥 섞으면 행성 속을 지나고, 맞은편이면 0 벡터가 된다
    const k = back * back * (3 - 2 * back),
      nudged = k + 0.02,
      kAhead = Math.min(1, nudged);
    backQ.setFromUnitVectors(this.visitEnd, this.v);
    stepQ.identity().slerp(backQ, k);
    this.v.copy(this.visitEnd).applyQuaternion(stepQ);
    stepQ.identity().slerp(backQ, kAhead);
    ahead.copy(this.visitEnd).applyQuaternion(stepQ);
    return loopTop;
  }

  // 시계 tt 의 높이 표 값(표가 없으면 70m). 180·270 도 바퀴는 같은 길을 거꾸로 간다
  private topAt(tt: number): number {
    const profile = this.profile;
    if (!profile) return 70;
    const l = (tt * SPEED) / LAP + LAP_START,
      lap = Math.floor(l),
      frac = l - lap;
    const table = profile[lap % 2],
      n = table.length;
    const along = lap % 4 < 2 ? frac : 1 - frac;
    const scaled = along * n;
    const raw = Math.floor(scaled);
    const last = n - 1,
      low = Math.max(0, raw);
    const i = Math.min(last, low);
    return table[i];
  }
}

/* ─── 내부 ─────────────────────────── */

// 시계 tt 에서 고래가 있는 자리: 바퀴마다 방향을 90 도씩 바꾸고, 바퀴 끝(0.94 뒤)에서 부드럽게 돈다
function pointAt(tt: number, out: THREE.Vector3): THREE.Vector3 {
  const l = (tt * SPEED) / LAP + LAP_START,
    lap = Math.floor(l),
    frac = l - lap;
  let bear = 90 * lap;
  if (frac > TURN_FROM) {
    const u = (frac - TURN_FROM) / TURN_SPAN;
    bear += 90 * u * u * (3 - 2 * u);
  }
  const dist = LAP * frac;
  return fromInto(out, dist, bear);
}

// 프레임마다 share 씩 다가가는 것을 dt 에 맞춘 몫(1/60 초면 share)
function perFrame(share: number, dt: number): number {
  const frames = dt * 60;
  const stay = 1 - share;
  const keep = Math.pow(stay, frames);
  return 1 - keep;
}

// 표의 칸 번호를 한 바퀴 안으로
function wrap(i: number): number {
  return (i + PROFILE_N) % PROFILE_N;
}
