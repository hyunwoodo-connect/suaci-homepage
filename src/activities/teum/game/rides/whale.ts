import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { HeldBody, Holder } from "../player/player";
import type { Services } from "../services";
import { S } from "../settings";
import type { HasHeights, Height } from "../world/tall";
import {
  bodyReach,
  heightOver,
  isOverBack,
  offerHeight,
  settleStep,
  wantsBack,
} from "./whaleBoarding";
import type { WhaleRoute } from "./whaleRoute";
import { grandTour, islandLoop } from "./whaleRoute";

// 고래 등 — 고래는 한자리를 돌지 않는다. 정해진 길(whaleRoute — 온 행성이 뭍이면 여섯 마을을 지나는 큰 바퀴, 섬이면 섬 일주)을
// 따라 마을 하늘을 차례로 지난다. 높이는 길 아래 가장 높은 것 + 16m 를 미리 재 둔 표(빈 들판 위에서는 낮게 내려온다).
// 내가 가까이(220m 안) 있으면 천천히 가서 따라잡을 수 있고, 등에 타면 빨리 간다.
// 타는 법(whaleBoarding.ts): 끌어 올리지 않는다. 내가 하늘로 올라가 곁에 오면 고래가 등을 내 발밑으로 낮춰 주고,
// 등 위에 오면 사뿐히 내려앉힌다. 태운 뒤에는 제 높이로 돌아간다

/** 높이 표: 바퀴마다 나눈 칸 수, 길 아래를 보는 폭(코사인), 가장 낮게·꼭대기 위로 띄우는 높이·가장 높게 */
const PROFILE_N = 240,
  PROFILE_COS = 0.9985,
  PROFILE_FLOOR = 44,
  PROFILE_CLEAR = 16,
  PROFILE_CAP = 112;
/** 표를 고르는 폭: 높은 것 곁(±3칸)을 같이 넘고, ±4칸을 고르게 펴서 오르내림이 완만하다 */
const DILATE = 3,
  SMOOTH = 4;
/** 빠르기: 멀리 있을 때 1, 내가 220m 안이면 0.3, 등을 내주거나 내려앉히는 동안 0.12(거의 서서 기다린다), 등에 타면 1.7 */
const NEAR_SLOW = 220,
  SLOW_RATE = 0.3,
  MEET_RATE = 0.12,
  RIDE_RATE = 1.7;
/** 등을 내주려 낮출 때 길 아래 가장 높은 것 위로 배를 띄우는 높이(m) · 그 곁(앞뒤 7칸, 약 67m)의 것도 같이 넘는다 */
const LOW_CLEAR = 5,
  LOW_DILATE = DILATE + SMOOTH;
/** 등을 내주러 내려오고 다시 제 높이로 돌아갈 때 높이를 바꾸는 가장 빠른 빠르기(m/s) — 수십 m 를 오르내려도 천천히 */
const HEIGHT_SPEED = 9;
/**
 * 등을 내주느라 평소 높이보다 이만큼(m) 넘게 내려와 있으면 '낮춘 채'로 본다. 평소 높이 가까이 돌아올 때까지는 천천히 간다 —
 * 낮은 채로 빨리 가면 앞의 높은 것(관람차)을 넘기 전에 닿는다
 */
const LOW_MARGIN = 4;
/** 내가 고래 몸 아래에 있다고 보는 옆 거리(m, 몸 길이의 절반 남짓) */
const BODY_ASIDE = 36;
/** 내려앉히기가 이보다 오래(초) 걸리면 그만두고 놓는다(닿지 못하는 일이 생겨도 붙잡힌 채로 두지 않는다) */
const LAND_MAX = 12;
/**
 * 내려앉히는 걸음(남은 거리 × 배수의 빠르기, 초당 느리게~빠르게 m): 옆으로 · 아래로 · (등보다 낮으면) 위로.
 * 가장 느린 빠르기는 기다리는 고래가 나아가는 빠르기(초당 1.8m)와 출렁임(초당 0.7m)보다 커야 끝에서 닿는다
 */
const SIDE_GAIN = 1.6,
  SIDE_SLOW = 4.5,
  SIDE_FAST = 16,
  DOWN_GAIN = 1.4,
  DOWN_SLOW = 2.5,
  DOWN_FAST = 14,
  UP_GAIN = 3,
  UP_SLOW = 2,
  UP_FAST = 12;
/** 등에 닿았다고 보는 거리(m): 옆으로 · 위아래 */
const TOUCH_ASIDE = 1,
  TOUCH_ABOVE = 0.35;
/** 내려앉는 순간 고래가 눌리는 깊이(m)와 되돌아오는 빠르기 */
const TOUCH_SINK = 1.6,
  SINK_BACK = 2.2;
/** 등을 내주는 동안 등 꼭대기에 두는 빛(여기로 내려앉으라는 표시): 등 위로 띄우는 높이(m) · 크기(m) · 밝기와 그 출렁임 */
const CUE_LIFT = 2,
  CUE_SIZE = 20,
  CUE_GLOW = 0.42,
  CUE_PULSE = 0.2;
/** 등에 탄 채로 가장 오래(초) */
const RIDE_MAX = 90;
/** 내린 뒤 다시 태우려면 땅에 내려앉거나 이만큼(m) 멀어져야 한다 — 고래는 내 곁에서 느려져서, 떨어지는 동안 다시 끌려 올라갔다 */
const REARM_AWAY = 90,
  REARM_LANDED = 0.3;
/** 고래가 지나간다는 안내(220m 안으로 오면 한 번, 320m 밖으로 멀어지면 다시) · 소리(240m) */
const HINT_IN = 220,
  HINT_OUT = 320,
  NEAR_SOUND = 240;

/** 나와 고래 사이: away 따로 · landing 등으로 내려앉는 중 · riding 등에 탔다 */
type Phase = "away" | "landing" | "riding";

const bx = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  ahead = new THREE.Vector3(),
  tv = new THREE.Vector3(),
  cue = new THREE.Vector3();

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
  /** 높이 표(길의 바퀴마다 하나). 풍경을 다 놓은 뒤 choosePath 가 채운다 */
  profile: Float32Array[] | null = null;
  /** 길 아래 가장 높은 것의 표(곁의 것까지) — 등을 내주러 내려올 때 이 위로는 배를 띄운다 */
  private tops: Float32Array[] | null = null;
  /** 도는 길 */
  private readonly route: WhaleRoute;
  /** 고래의 시계(초 — 빠르기만큼 간다) */
  clock = 0;
  /** 등에 탔을 때 내 몸이 떠 있는 높이 — 고래 모델이 오면 그 등 높이로 */
  rideH = 5.6;
  /** 고래가 출렁이는 높이(등에 탄 몸도 같이) */
  wbob = 0;
  /** 큰 바퀴를 도는 것(프레임 처음, 내가 움직이기 전) */
  readonly mover: Thing;
  private rate = 1;
  private phase: Phase = "away";
  /** 지금 등을 내주고 있나(프레임 처음에 정한다) */
  private isOffering = false;
  /** 나와의 옆 거리(m, 프레임 처음에 잰다) */
  private aside = Infinity;
  /** 등을 내주느라 평소 높이보다 낮춘 채인가(제 높이로 돌아오면 풀린다) */
  private isDipped = false;
  /** 내려앉는 순간 눌린 깊이(m, 서서히 0) */
  private sink = 0;
  private t = 0;
  private cool = 0;
  /** 태울 수 있나(내린 뒤에는 땅에 닿거나 멀어질 때까지 아니다) */
  private armed = true;
  private hinted = false;
  /** 등을 내준다고 알렸나(고래가 멀어지면 다시 알린다) */
  private offered = false;
  private near = false;
  /** 한 번이라도 움직였나(처음 프레임에는 고래 자리를 아직 모르는 것으로 쳐서 제 빠르기로 떠난다) */
  private moved = false;

  constructor(private readonly s: Services) {
    const primGeo = new THREE.SphereGeometry(1, 28, 18);
    const primMat = new THREE.MeshBasicMaterial({ color: 0xd7dad9 });
    this.prim = new THREE.Mesh(primGeo, primMat);
    this.prim.scale.set(16, 5, 6.5);
    this.g.add(this.prim);
    s.scene.add(this.g);
    this.route = s.land.centre ? islandLoop(s.land.centre) : grandTour();
    this.mover = { update: (f) => this.move(f), dispose: () => {} };
  }

  /**
   * 높이 표를 만든다(나무·꽃·조형물·랜드마크를 다 놓은 뒤): 바퀴마다 240 칸, 칸마다 길 아래(코사인 0.9985 안) 가장 높은 것(적어도 44m) + 16m.
   * 높은 것 곁도 같이 넘게 넓히고(±3칸), 고르게 편다(±4칸). 112m 를 넘지 않는다
   */
  choosePath(sources: readonly HasHeights[]) {
    const all: Height[] = [];
    for (const src of sources) src.pushHeights(all);
    const route = this.route;
    const tables = Array.from({ length: route.tables }, (_, table) => table);
    const bare = tables.map(() => new Float32Array(PROFILE_N));
    this.profile = tables.map((table) => {
      const raw = new Float32Array(PROFILE_N),
        wide = new Float32Array(PROFILE_N),
        out = new Float32Array(PROFILE_N);
      for (let i = 0; i < PROFILE_N; i++) {
        route.cell(table, i, PROFILE_N, tv);
        // 길 아래 가장 높은 것: 땅(둔덕)부터, 그 위의 키 큰 것까지
        const ground = this.s.terrain.featGround(tv);
        let highest = Math.max(0, ground);
        for (const [ov, H] of all) if (ov.dot(tv) > PROFILE_COS && H > highest) highest = H;
        bare[table][i] = highest;
        const top = Math.max(PROFILE_FLOOR, highest);
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
    this.tops = bare.map((raw) => {
      const wide = new Float32Array(PROFILE_N);
      for (let i = 0; i < PROFILE_N; i++) {
        let m = 0;
        for (let j = -LOW_DILATE; j <= LOW_DILATE; j++) {
          const near = i + j;
          const at = wrap(near);
          m = Math.max(m, raw[at]);
        }
        wide[i] = m;
      }
      return wide;
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

  /** 등 위로 오면 사뿐히 내려앉히고, 끌면 내린다. 가까이 오면 한 번 알려 준다 */
  update(f: Frame) {
    const { player, hud, camera, events, fx } = this.s,
      dt = f.dt;
    if (this.cool > 0) this.cool -= dt;
    const d = player.p.angleTo(this.v) * S.R;
    if (!this.armed && this.phase === "away" && (player.air < REARM_LANDED || d > REARM_AWAY))
      this.armed = true;
    // 등(꼭대기)의 높이와, 내가 그보다 얼마나 위에 있나
    const back = this.WH + this.rideH + this.wbob - this.sink,
      above = player.alt - back;
    // 다른 놀이기구에 실려 있거나 풍선에 매달려 있을 때는 채 가지 않는다 — 제힘으로 떠서 등 위로 왔을 때만
    if (
      this.phase === "away" &&
      this.armed &&
      this.cool <= 0 &&
      !player.isHeld &&
      !player.isHanging &&
      isOverBack(d, above, player.vy)
    ) {
      player.grab(this);
      this.phase = "landing";
      this.t = 0;
    }
    const body = player.bodyFor(this);
    if (body && this.phase === "landing") this.land(body, back, dt);
    else if (body && this.phase === "riding") this.carry(body, back, dt);
    // 붙잡은 것을 잃었으면(다른 것이 놓게 했다) 따로 있는 것으로 돌아간다
    else if (!body && this.phase !== "away") this.letGo();
    // 몸속으로는 못 들어간다: 배와 등 사이 높이에서 옆구리에 닿으면 둘레로 미끄러진다(등 위로는 넘어올 수 있다).
    // 막 내린 뒤(다시 태울 수 있게 되기 전)에는 막지 않는다 — 등에서 뛰어내리는 몸은 등 꼭대기 바로 아래에 있어, 막으면 옆으로 툭 밀려난다
    if (this.phase === "away" && this.armed && !player.isHeld) {
      const half = this.rideH,
        off = player.alt - (this.WH + this.wbob - this.sink),
        girth = bodyReach(off, half);
      if (girth > 0) player.blockBody(this.v, girth);
    }
    // 등을 내주는 동안과 내려앉히는 동안: 등 꼭대기가 숨 쉬듯 빛난다(여기로 내려앉으라는 표시)
    if (this.isOffering || this.phase === "landing") {
      const cueRadius = S.R + back + CUE_LIFT,
        phase = f.time * 4,
        breath = Math.sin(phase),
        glow = CUE_GLOW + CUE_PULSE * breath;
      cue.copy(this.v).multiplyScalar(cueRadius);
      fx.glow(cue, CUE_SIZE, glow);
    }
    // 고래·혜성에 탄 동안 카메라가 뒤로 물러난다
    const riding = player.heldWithCamera("ride");
    const rideTarget = riding ? 1 : 0;
    const blendPull = ease(3, dt);
    camera.easeRide(rideTarget, blendPull);
    // 가까이 왔다는 안내와 소리
    if (d < HINT_IN && !this.hinted) {
      this.hinted = true;
      hud.say("고래가 지나갑니다 — 하늘로 올라가 등 위에 내려앉아 보세요", 5.5);
    } else if (d > HINT_OUT) {
      this.hinted = false;
      this.offered = false;
    }
    if (this.isOffering && !this.offered) {
      this.offered = true;
      hud.say("고래가 등을 내줍니다 — 등 위로 가면 태워 줍니다", 4.5);
    }
    const isNear = d < NEAR_SOUND;
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
      player = this.s.player;
    const aside = this.moved ? player.p.angleTo(this.v) * S.R : Infinity,
      near = aside < NEAR_SLOW;
    this.aside = aside;
    if (dt > 0) this.moved = true;
    // 등을 내줄 만한가: 따로 있고(막 내린 뒤가 아니고), 내가 제힘으로 하늘에 올라 곁에 와 있다
    // (다른 놀이기구에 실려 있거나 풍선에 매달려 있으면 내려앉히지 않으니 내주지도 않는다)
    this.isOffering =
      this.phase === "away" &&
      this.armed &&
      this.cool <= 0 &&
      !player.isHeld &&
      !player.isHanging &&
      wantsBack(aside, player.air);
    const isMeeting = this.isOffering || this.phase === "landing";
    const lookAhead = this.clock + 3;
    const cruise = this.topAt(lookAhead),
      isLow = this.WH < cruise - LOW_MARGIN;
    if (!isLow) this.isDipped = false;
    else if (isMeeting) this.isDipped = true;
    const free = this.phase === "riding" ? RIDE_RATE : near ? SLOW_RATE : 1,
      paced = this.isDipped ? Math.min(free, SLOW_RATE) : free,
      want = isMeeting ? MEET_RATE : paced;
    // 1/60 초 프레임에서 3%·2% 씩 다가가는 빠르기 — 프레임 길이가 달라도 빠르기는 같게
    const rateEase = perFrame(0.03, dt),
      heightEase = perFrame(0.02, dt);
    this.rate += (want - this.rate) * rateEase;
    this.clock += dt * this.rate;
    const bobPhase = f.time * 0.6;
    this.wbob = Math.sin(bobPhase) * 1.2;
    const target = this.heightFor(lookAhead, cruise);
    // 표를 따라가는 고르기 그대로. 등을 내주러 내려오고 돌아가는 동안만 초당 HEIGHT_SPEED m 를 넘지 않게 한다
    const eased = (target - this.WH) * heightEase,
      isGentle = isMeeting || this.isDipped,
      most = isGentle ? HEIGHT_SPEED * dt : Infinity,
      capped = Math.min(most, eased);
    this.WH += Math.max(-most, capped);
    const sinkBack = ease(SINK_BACK, dt);
    this.sink -= this.sink * sinkBack;
    this.route.at(this.clock, this.v);
    const aheadT = this.clock + 0.4;
    this.route.at(aheadT, ahead);
    this.f.copy(ahead).sub(this.v);
    const fUp = this.f.dot(this.v);
    this.f.addScaledVector(this.v, -fUp).normalize();
    const whaleRadius = S.R + this.WH + this.wbob - this.sink;
    this.g.position.copy(this.v).multiplyScalar(whaleRadius);
    bx.crossVectors(this.v, this.f).normalize().negate();
    m4.makeBasis(this.f, this.v, bx);
    this.g.quaternion.setFromRotationMatrix(m4);
  }

  // 시계 tt 의 높이 표 값(표가 없으면 70m)
  private topAt(tt: number): number {
    const profile = this.profile;
    return profile ? this.cellAt(profile, tt) : 70;
  }

  // 시계 tt 에서 표(바퀴마다 하나)가 가리키는 칸의 값
  private cellAt(tables: Float32Array[], tt: number): number {
    const seat = this.route.tableAt(tt);
    const table = tables[seat.table],
      n = table.length;
    const scaled = seat.along * n;
    const raw = Math.floor(scaled);
    const last = n - 1,
      low = Math.max(0, raw);
    const i = Math.min(last, low);
    return table[i];
  }

  // 지금 맞출 높이: 평소에는 표(cruise). 등을 내줄 때는 등이 내 발밑으로 오게(길 아래 것들 위로 배를 띄울 수 있는 데까지만).
  // 내려앉히는 동안에는 그 높이에 머문다(오르내리면 내려오는 내가 등에 닿지 못하고 따라다닌다) — 길 아래 것에 닿을 만큼만 비킨다
  private heightFor(tt: number, cruise: number): number {
    const isMeeting = this.isOffering || this.phase === "landing";
    if (!isMeeting || !this.tops) return cruise;
    // 배는 고래 높이보다 등 높이(rideH)만큼 아래다(모델의 가운데가 원점) — 배가 길 아래 것들 위로 LOW_CLEAR 는 뜨게
    const low = this.cellAt(this.tops, tt) + this.rideH + LOW_CLEAR,
      lowest = Math.min(cruise, low);
    if (this.phase === "landing") return Math.max(this.WH, lowest);
    const feet = this.s.player.alt,
      belly = this.WH - this.rideH;
    // 내가 고래 배보다 낮게 몸 아래에 있으면 배가 내 위로 뜨는 데까지만 내려온다(등을 내주다 덮치지 않게).
    // 옆구리 곁(배와 등 사이 높이)에 있을 때는 그대로 내려온다 — 몸속으로는 못 들어가니, 등이 내 발밑으로 오면 넘어갈 수 있다
    if (this.aside < BODY_ASIDE && feet < belly) {
      const overMe = heightOver(feet, this.rideH),
        clear = Math.max(lowest, overMe),
        safe = Math.min(cruise, clear);
      return offerHeight(feet, this.rideH, safe, cruise);
    }
    return offerHeight(feet, this.rideH, lowest, cruise);
  }

  // 등으로 사뿐히 내려앉힌다: 옆으로는 등 꼭대기 쪽으로, 아래로는 등 높이까지 — 멀면 빠르게, 닿을 때는 느리게
  private land(body: HeldBody, back: number, dt: number) {
    const { player, hud } = this.s;
    this.t += dt;
    const aside = body.p.angleTo(this.v) * S.R,
      sideStep = settleStep(aside, dt, SIDE_GAIN, SIDE_SLOW, SIDE_FAST),
      share = aside > 1e-6 ? sideStep / aside : 1;
    body.p.lerp(this.v, share).normalize();
    const turn = ease(2, dt);
    this.face(body, turn);
    const seat = back - player.floor - S.hover,
      targetAir = Math.max(0.01, seat),
      drop = body.air - targetAir;
    if (drop > 0) body.air -= settleStep(drop, dt, DOWN_GAIN, DOWN_SLOW, DOWN_FAST);
    else body.air += settleStep(-drop, dt, UP_GAIN, UP_SLOW, UP_FAST);
    const left = aside - sideStep,
      offSeat = body.air - targetAir,
      gap = Math.abs(offSeat);
    if (this.t > LAND_MAX) {
      player.release(this);
      this.letGo();
      return;
    }
    if (left >= TOUCH_ASIDE || gap >= TOUCH_ABOVE) return;
    this.phase = "riding";
    this.t = 0;
    this.sink = TOUCH_SINK;
    hud.say("고래 등 — 끌면 내립니다");
  }

  // 등에 태우고 간다. 끌거나 오래(90초) 타면 내려 준다
  private carry(body: HeldBody, back: number, dt: number) {
    const player = this.s.player;
    this.t += dt;
    const k = ease(6, dt);
    body.p.lerp(this.v, k).normalize();
    this.face(body, k);
    const seat = back - player.floor - S.hover,
      targetAir = Math.max(0.01, seat);
    body.air += (targetAir - body.air) * k;
    if ((this.t <= 1.2 || player.m0 <= 0.6) && this.t <= RIDE_MAX) return;
    this.letGo();
    player.release(this, { vy: 4.5, boost: 0.9 });
  }

  // 따로 있는 것으로 돌아간다. 땅에 닿거나 멀어질 때까지는 다시 태우지 않는다
  private letGo() {
    this.phase = "away";
    this.armed = false;
    this.cool = 4;
  }

  // 몸을 고래가 가는 쪽으로 돌린다(k 만큼). 붙잡힌 몸은 제힘으로 오르내리지 않는다
  private face(body: HeldBody, k: number) {
    body.h.lerp(this.f, k);
    const hUp = body.h.dot(body.p);
    body.h.addScaledVector(body.p, -hUp).normalize();
    body.vel.copy(body.h);
    body.vy = 0;
  }
}

/* ─── 내부 ─────────────────────────── */

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
