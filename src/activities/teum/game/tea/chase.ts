import * as THREE from "three";

import type { Random } from "../core/random";
import type { GameEvents } from "../events";
import type { OpenFx } from "../hideseek/openFx";
import { STAGE, splitAt } from "../hideseek/openTuning";
import type { HideOverlay } from "../hideseek/overlay";
import type { ModelLibrary } from "../models/library";
import type { TeaBody } from "./body";
import type { BoxRoute, Router } from "./boxRoute";
import type { EdgeDust } from "./edgeDust";
import type { TeaProp, TeaProps } from "./props";
import type { Puffs } from "./puffs";
import type { StandShape } from "./stand";
import type { StandMesh } from "./standMesh";
import { TeaBox } from "./teaBox";
import type { TeaTuning } from "./teaTuning";

// 상자와 술래(기획서 v3.1 3·4·5·7장). 상자 상태 넷: 숨음 → (내가 안 볼 때) 몰래 이동 → (들키면) 도망 → 잡힘 / 찜.
// 숨은 상자는 리본 물건 속에서 귀 끝만 내밀고 까딱인다. 내가 안 보고(화면 밖·가려짐), 찜 기둥에서 멀고, 8~14초가 지나면 한 칸 위 빈 물건으로 옮긴다.
// 옮기는 중에 0.2초 넘게 보이면 화들짝 → 꼭대기로 전력 질주. 달리는 상자를 톡 하면 잡히고, 꼭대기에 닿으면 찜.
// 단서: 키득(가까울수록 잦게·그쪽에서) + 물건 흔들림(소리가 꺼져도) · 몰래 이동의 발소리 + 화면 가장자리 먼지 · 숨은 상자의 귀 까딱

/** 상자 상태 */
export type HiderState = "hidden" | "sneaking" | "startled" | "fleeing" | "caught" | "claimed";

/** 상자 하나 */
export interface Hider {
  box: TeaBox;
  state: HiderState;
  /** 숨어 있는 물건(숨음) · 가는 물건(몰래 이동, 꼭대기면 null) */
  prop: TeaProp | null;
  /** 이번 판에서 처음 숨었던 물건(아깝게 진 것 보여 주기) */
  origin: TeaProp | null;
  route: BoxRoute | null;
  /** 길에서 간 거리(m) */
  s: number;
  /** 숨음: 다음 이동까지(초) */
  wait: number;
  /** 몰래 이동 중 보인 시간(초) */
  seenFor: number;
  /** 지금 상태가 된 뒤 흐른 시간(초) */
  t: number;
  /** 발소리·먼지·귀 까딱·뒤돌아보기까지 남은 시간 */
  stepT: number;
  wiggleT: number;
  lookBackT: number;
  /** 줄에 선 차례(잡힘) */
  lineAt: number;
}

/** 판에서 잰 값(기획서 13장 "측정") */
export interface ChaseStats {
  caught: number;
  claimed: number;
  opened: number;
  duds: number;
  fleeCaught: number;
  fleeTapMissed: number;
  firstFoundAt: number | null;
}

/** 이 상자가 판 끝(잡힘·찜)에 이르렀을 때 */
export type Settled = (h: Hider) => void;

/** 몰래 이동·도망 발소리 간격(초) */
const STEP = { sneak: 0.35, flee: 0.22 } as const;
/** 달릴 때 발밑 먼지 간격(초) */
const RUN_DUST = 0.14;
/** 숨은 상자의 귀 까딱 간격(초) */
const WIGGLE = [4, 7] as const;
/** 들켜 화들짝(초) */
const STARTLE_SECONDS = 0.3;
/** 잡았다 연출의 때(초, 톡한 때부터): 멈춤 끝·팡·큰 글자·줄로 */
const CATCH = { freeze: 0.15, pop: 0.3, text: 0.8, join: 1.2 } as const;
/** 줄에 선 상자 크기·내 뒤에서 첫 상자까지(m) */
const LINE = { size: 0.4, first: 1.3 } as const;
/** 숨은 상자가 물건 위로 내미는 몫(키의) */
const PEEK = 0.22;
/** 화면 기준 높이(px) — 잡기 판정 최소 반지름이 이 높이에서 60px */
const REF_HEIGHT = 844;
/** 리본 물건 판정: 사방 여유(px)·최소 크기(px) */
const PROP_PAD = 24,
  PROP_HALF_MIN = 96 / 2;

const tmpA = new THREE.Vector3(),
  tmpB = new THREE.Vector3(),
  tmpUp = new THREE.Vector3(),
  face = new THREE.Vector3(),
  ndc = new THREE.Vector3(),
  right = new THREE.Vector3();

/** 상자와 술래 */
export class Chase {
  readonly hiders: Hider[] = [];
  readonly stats: ChaseStats = {
    caught: 0,
    claimed: 0,
    opened: 0,
    duds: 0,
    fleeCaught: 0,
    fleeTapMissed: 0,
    firstFoundAt: null,
  };
  /** 판 시간(초) — 판이 시작되고 흐른 시간(배속 포함) */
  now = 0;
  /** 잡은 상자 수(칸을 채우는 차례) */
  private found = 0;
  private giggleT = 0;
  private giggleN = 0;
  /** 판 시간으로 미뤄 둔 일 */
  private timers: { at: number; run: () => void }[] = [];
  private readonly rand: () => number;

  constructor(
    private readonly t: TeaTuning,
    private readonly stand: StandShape,
    private readonly standMesh: StandMesh,
    private readonly props: TeaProps,
    private readonly router: Router,
    private readonly body: TeaBody,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly events: GameEvents,
    private readonly overlay: HideOverlay,
    private readonly openFx: OpenFx,
    private readonly puffs: Puffs,
    private readonly edgeDust: EdgeDust,
    private readonly onHitStop: (seconds: number) => void,
    private readonly onSettled: Settled,
    rng: Random,
  ) {
    const fork = rng.fork("chase");
    this.rand = () => fork.next();
  }

  /** 상자 하나를 만들어 prop 속에 숨긴다 */
  addHider(models: ModelLibrary, scene: THREE.Scene, prop: TeaProp): Hider {
    const box = new TeaBox(models, scene, this.rand);
    const h: Hider = {
      box,
      state: "hidden",
      prop,
      origin: prop,
      route: null,
      s: 0,
      wait: this.rollWait(),
      seenFor: 0,
      t: 0,
      stepT: 0,
      wiggleT: this.rollWiggle(),
      lookBackT: 2,
      lineAt: -1,
    };
    this.hideIn(h, prop);
    this.hiders.push(h);
    return h;
  }

  /** 상자를 prop 속에 다시 숨긴다(새 판) */
  rehide(h: Hider, prop: TeaProp) {
    h.state = "hidden";
    h.origin = prop;
    h.route = null;
    h.s = 0;
    h.wait = this.rollWait();
    h.seenFor = 0;
    h.t = 0;
    h.lineAt = -1;
    h.box.box.setSize(1, true);
    this.hideIn(h, prop);
  }

  /** 판을 처음부터(잡은 수·잰 값) */
  resetRound() {
    this.found = 0;
    this.now = 0;
    Object.assign(this.stats, {
      caught: 0,
      claimed: 0,
      opened: 0,
      duds: 0,
      fleeCaught: 0,
      fleeTapMissed: 0,
      firstFoundAt: null,
    });
  }

  /** 한 프레임(dt 는 판 시간 — 배속 포함) */
  update(dt: number, time: number) {
    this.now += dt;
    for (const h of this.hiders) {
      h.t += dt;
      if (h.state === "hidden") this.hiding(h, dt);
      else if (h.state === "sneaking") this.sneaking(h, dt);
      else if (h.state === "startled") this.startled(h);
      else if (h.state === "fleeing") this.fleeing(h, dt);
      else if (h.state === "caught") this.following(h, dt);
      h.box.update(dt, time);
    }
    this.giggle(dt);
  }

  /** 톡: 도망(·몰래 이동) 중인 상자가 먼저, 그다음 리본 물건. 무엇에 닿았으면 true */
  tap(x: number, y: number): boolean {
    const runner = this.runnerAt(x, y);
    const anyRunning = this.hiders.some((h) => h.state === "fleeing");
    if (runner) {
      this.catchRunner(runner);
      return true;
    }
    if (anyRunning) this.stats.fleeTapMissed++;
    const prop = this.propAt(x, y);
    if (!prop) return false;
    const dist = this.body.foot.distanceTo(prop.center);
    if (dist > this.t.open.reach) {
      this.props.flick(prop);
      return true;
    }
    this.openProp(prop);
    return true;
  }

  /** 이 자리가 보이나(화면 가운데 몫 안 + 카메라에서 40m 안 + 별·접시·기둥에 안 가림) */
  isSeen(point: THREE.Vector3): boolean {
    const cam = this.camera;
    if (cam.position.distanceTo(point) > this.t.flee.spotReach) return false;
    ndc.copy(point).project(cam);
    const share = this.t.flee.spotShare;
    const isInside = Math.abs(ndc.x) <= share && Math.abs(ndc.y) <= share && ndc.z < 1;
    if (!isInside) return false;
    return !this.stand.segmentBlocked(cam.position, point, 0.6);
  }

  /** 치운다 */
  dispose() {
    for (const h of this.hiders) h.box.dispose();
  }

  // ---- 숨음 ----

  private hiding(h: Hider, dt: number) {
    const prop = h.prop!;
    h.wiggleT -= dt;
    if (h.wiggleT <= 0) {
      h.wiggleT = this.rollWiggle();
      h.box.box.wave();
    }
    if (prop.openT >= 0) return;
    h.wait -= dt;
    if (h.wait > 0) return;
    const center = h.box.center(tmpA);
    const isWatched = this.isSeen(center);
    const nearTop = this.body.foot.distanceTo(this.standMesh.topPoint) < this.t.sneak.homeGuard;
    const someoneMoving = this.hiders.some((o) => o !== h && o.state === "sneaking");
    if (isWatched || nearTop || someoneMoving) return;
    const next = this.nextProp(h);
    if (next === undefined) {
      // 위 칸에 빈 자리가 없다: 이번엔 쉰다
      h.wait = this.rollWait();
      return;
    }
    this.startSneak(h, next);
  }

  // 한 칸 위의 빈 물건(3단이면 꼭대기 = null). 없으면 undefined
  private nextProp(h: Hider): TeaProp | null | undefined {
    const tier = h.prop!.spot.tier;
    if (tier >= this.stand.plates.length) return null;
    const taken = new Set(this.hiders.map((o) => o.prop));
    const free = this.props.list.filter(
      (p) => p.spot.tier === tier + 1 && !taken.has(p) && this.props.isFree(p, this.now),
    );
    if (free.length === 0) return undefined;
    const roll = this.rand() * free.length;
    const pick = Math.floor(roll);
    return free[pick];
  }

  private startSneak(h: Hider, to: TeaProp | null) {
    const from = h.prop!;
    const target = to ? to.spot : null;
    h.route = this.router.between(from.spot, target);
    h.prop = to;
    h.s = 0;
    h.seenFor = 0;
    h.stepT = 0;
    this.setState(h, "sneaking");
    h.box.box.setLongEars(false);
    h.box.box.setScurry(1);
  }

  // ---- 몰래 이동 ----

  private sneaking(h: Hider, dt: number) {
    const route = h.route!;
    h.s += this.t.sneak.speed * dt;
    this.followRoute(h);
    const center = h.box.center(tmpA);
    if (this.isSeen(center)) h.seenFor += dt;
    else h.seenFor = 0;
    if (h.seenFor >= this.t.flee.spotSeconds) {
      this.startle(h);
      return;
    }
    h.stepT -= dt;
    if (h.stepT <= 0) {
      h.stepT = STEP.sneak;
      this.step(h, false);
      this.dustAtEdge(center);
    }
    if (h.s < route.length) return;
    if (h.prop) {
      this.hideIn(h, h.prop);
      h.state = "hidden";
      h.t = 0;
      h.wait = this.rollWait();
    } else this.claim(h);
  }

  // ---- 들킴 → 도망 ----

  private startle(h: Hider) {
    this.setState(h, "startled");
    h.box.box.setScurry(0);
    h.box.box.startle();
    const pan = this.panOf(h);
    this.events.emit("teaStartled", { pan });
  }

  private startled(h: Hider) {
    if (h.t < STARTLE_SECONDS) return;
    h.route = this.router.fleeFrom(h.route!, h.s);
    h.prop = null;
    h.s = 0;
    h.stepT = 0;
    h.lookBackT = 1.2;
    this.setState(h, "fleeing");
    h.box.box.setScurry(1);
  }

  private fleeing(h: Hider, dt: number) {
    const route = h.route!;
    h.s += this.t.flee.speed * dt;
    this.followRoute(h);
    // 가끔 뒤돌아본다(0.2초)
    h.lookBackT -= dt;
    if (h.lookBackT < 0) {
      h.box.face.negate();
      if (h.lookBackT < -0.2) h.lookBackT = 1.5 + this.rand() * 1.5;
    }
    h.stepT -= dt;
    if (h.stepT <= 0) {
      h.stepT = STEP.flee;
      this.step(h, true);
    }
    const dustEvery = RUN_DUST;
    if (h.t % dustEvery < dt) this.puffs.burst(h.box.foot, h.box.up, 2, 0.45);
    if (h.s >= route.length) this.claim(h);
  }

  // ---- 찜 ----

  private claim(h: Hider) {
    this.setState(h, "claimed");
    h.prop = null;
    h.box.box.setScurry(0);
    const top = this.standMesh.topPoint;
    face.set(0, 0, 1);
    h.box.put(top, Y_UP, face);
    h.box.box.dance(1e6);
    this.standMesh.wave();
    this.stats.claimed++;
    this.events.emit("teaClaimed", {});
    const isLooking = this.isSeen(top);
    if (isLooking) this.overlay.showBig("찜!");
    this.onSettled(h);
  }

  // ---- 잡힘 ----

  // 도망(·몰래 이동) 중인 상자를 톡으로 잡았다: 미스트 → 멈춤 → 팡 → "잡았다!" → 줄로
  private catchRunner(h: Hider) {
    const wasFleeing = h.state === "fleeing";
    this.setState(h, "caught");
    h.route = null;
    h.prop = null;
    h.box.box.setScurry(0);
    this.stats.caught++;
    if (wasFleeing) this.stats.fleeCaught++;
    this.markFirstFound();
    this.events.emit("teaCaught", {});
    this.onHitStop(CATCH.freeze);
    const center = new THREE.Vector3();
    h.box.center(center);
    this.later(CATCH.pop, () => {
      this.openFx.flash(center, 2.4, 0.5);
      this.openFx.confetti(center, 24, this.rand);
      h.box.box.topple();
    });
    this.later(CATCH.text, () => {
      this.overlay.showBig("잡았다!");
      this.fillNextSlot();
    });
    this.later(CATCH.join, () => this.joinLine(h));
  }

  // 리본 물건을 열어 본다(두근 0.6초 → 팡/푸슉)
  private openProp(prop: TeaProp) {
    if (prop.openT >= 0) return;
    const h = this.hiders.find((o) => o.state === "hidden" && o.prop === prop) ?? null;
    this.stats.opened++;
    this.props.open(prop, h !== null);
    this.events.emit("findTapped", { far: false });
    const O = STAGE.open;
    const split = splitAt(O);
    const pan = this.panAt(prop.center);
    this.events.emit("openRolled", { pan });
    const top = new THREE.Vector3(0, prop.height, 0);
    prop.holder.localToWorld(top);
    if (!h) {
      this.later(split, () => {
        this.events.emit("openFizzled", { pan });
        this.openFx.steam(top, this.rand);
        this.stats.duds++;
        this.props.setDud(prop, this.now, this.t.dud.cooldown);
      });
      return;
    }
    // 찾았다: 상자가 솟구쳐 공중 한 바퀴 → 착지 → 춤 → "찾았다!" → 줄로
    this.setState(h, "caught");
    h.prop = null;
    this.stats.caught++;
    this.markFirstFound();
    this.later(split, () => {
      this.events.emit("openPopped", { pan });
      const count = this.found + 1;
      this.events.emit("findFound", { count });
      this.openFx.flash(top, 2.6, 0.5);
      this.openFx.confetti(top, 28, this.rand);
      this.props.setDud(prop, this.now, this.t.dud.cooldown);
      h.box.box.setLongEars(false);
      h.box.put(top, prop.spot.up, h.box.face);
      const rise = O.riseHeights * h.box.half * 2;
      h.box.box.hop(rise, true);
    });
    const danceAt = split + O.riseSeconds + O.spinSeconds;
    this.later(danceAt, () => h.box.box.dance(O.danceSeconds));
    const textAt = danceAt + O.danceSeconds;
    this.later(textAt, () => {
      this.overlay.showBig("찾았다!");
      this.fillNextSlot();
    });
    this.later(textAt + 0.4, () => this.joinLine(h));
  }

  // 작아져 내 뒤 줄에 선다
  private joinLine(h: Hider) {
    h.lineAt = this.hiders.filter((o) => o.lineAt >= 0).length;
    h.box.box.setSize(LINE.size);
    h.box.box.hop();
    this.onSettled(h);
  }

  // 줄: 내 뒤 V 자로(가깝게 — follow.gap)
  private following(h: Hider, dt: number) {
    if (h.lineAt < 0) return;
    const { body } = this;
    const pair = h.lineAt / 2;
    const row = Math.floor(pair) + 1,
      side = h.lineAt % 2 === 0 ? 1 : -1;
    right.crossVectors(body.h, body.p).normalize();
    const back = LINE.first + (row - 1) * this.t.follow.gap;
    const aside = side * this.t.follow.gap * 0.6 * row;
    tmpB.copy(body.foot).addScaledVector(body.h, -back).addScaledVector(right, aside);
    const decay = -6 * dt;
    const k = 1 - Math.exp(decay);
    const at = tmpA.copy(h.box.foot).lerp(tmpB, k);
    tmpUp.copy(h.box.up).lerp(body.p, k).normalize();
    h.box.moveTo(at, tmpUp, body.h);
  }

  // ---- 단서 ----

  // 키득: 숨은 상자 중 가장 가까운 것이 거리대마다 정한 간격으로(가까우면 물건이 바스락)
  private giggle(dt: number) {
    let near: Hider | null = null,
      nearDist = Infinity;
    for (const h of this.hiders) {
      if (h.state !== "hidden" || !h.prop) continue;
      const d = this.body.foot.distanceTo(h.prop.center);
      if (d < nearDist) {
        near = h;
        nearDist = d;
      }
    }
    const every = this.giggleEvery(nearDist);
    if (!near || every === null) {
      this.giggleT = 0;
      return;
    }
    this.giggleT -= dt;
    if (this.giggleT > 0) return;
    this.giggleT = every;
    const prop = near.prop!;
    const pan = this.panAt(prop.center);
    const far = this.t.warm.bands[0];
    const closeness = 1 - nearDist / far;
    const volume = 0.3 + 0.7 * Math.max(0, closeness);
    const rate = 0.95 + this.rand() * 0.15;
    this.events.emit("findGiggled", { which: this.giggleN++, pan, volume, rate });
    const near8 = this.t.warm.bands[this.t.warm.bands.length - 1];
    const isClose = nearDist <= near8;
    const strength = isClose ? 1 : 0.45;
    this.props.shake(prop, strength);
    if (isClose) this.events.emit("findRustled", { pan, volume });
  }

  // 거리 → 키득 간격(초). 가장 먼 거리대 밖이면 null
  private giggleEvery(dist: number): number | null {
    const { bands, every } = this.t.warm;
    if (dist > bands[0]) return null;
    let at = 0;
    for (let i = 0; i < bands.length; i++) if (dist <= bands[i]) at = i;
    return every[at];
  }

  // 발소리(그쪽에서, 멀면 작게)
  private step(h: Hider, running: boolean) {
    const center = h.box.center(tmpA);
    const dist = this.body.foot.distanceTo(center);
    const far = this.t.warm.bands[0];
    const closeness = 1 - dist / far;
    if (closeness <= 0) return;
    const pan = this.panAt(center);
    this.events.emit("teaStepped", { pan, volume: closeness, running });
  }

  // 화면 밖에서 움직이면 그쪽 화면 가장자리에 먼지
  private dustAtEdge(center: THREE.Vector3) {
    ndc.copy(center).project(this.camera);
    const isBehind = ndc.z > 1;
    const isOnScreen = !isBehind && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1;
    if (isOnScreen) return;
    const flip = isBehind ? -1 : 1;
    const dx = ndc.x * flip,
      dy = -ndc.y * flip;
    this.edgeDust.puffToward(dx, dy);
  }

  // ---- 판정 ----

  // 톡한 곳의 도망(·몰래 이동) 중인 상자: 투영 원(반지름 × radiusScale, 최소 minPx) 안, 40m 안. 여럿이면 가까운 것
  private runnerAt(x: number, y: number): Hider | null {
    const c = this.t.catch;
    const minPx = (c.minPx * innerHeight) / REF_HEIGHT;
    let best: Hider | null = null,
      bestDist = Infinity;
    for (const h of this.hiders) {
      const isRunning = h.state === "fleeing" || h.state === "sneaking" || h.state === "startled";
      if (!isRunning) continue;
      const center = h.box.center(tmpA);
      const dist = this.body.foot.distanceTo(center);
      if (dist > c.reach) continue;
      const screen = this.toScreen(center);
      if (!screen) continue;
      const radius = this.projectedRadius(center, h.box.half);
      const scaled = radius * c.radiusScale;
      const hit = Math.max(minPx, scaled);
      const dx = screen.x - x,
        dy = screen.y - y;
      const off = Math.hypot(dx, dy);
      if (off <= hit && dist < bestDist) {
        best = h;
        bestDist = dist;
      }
    }
    return best;
  }

  // 톡한 곳의 리본 물건: 그려진 영역 + 사방 24px, 최소 96×96px. 여럿이면 가까운 것
  private propAt(x: number, y: number): TeaProp | null {
    let best: TeaProp | null = null,
      bestDist = Infinity;
    for (const p of this.props.list) {
      const screen = this.toScreen(p.center);
      if (!screen) continue;
      const reach = p.height * 0.6;
      const radius = this.projectedRadius(p.center, reach);
      const padded = radius + PROP_PAD;
      const half = Math.max(PROP_HALF_MIN, padded);
      const dx = screen.x - x,
        dy = screen.y - y;
      const isInside = Math.abs(dx) <= half && Math.abs(dy) <= half;
      if (!isInside) continue;
      const dist = this.camera.position.distanceTo(p.center);
      if (dist < bestDist) {
        best = p;
        bestDist = dist;
      }
    }
    return best;
  }

  // 화면 좌표(px). 카메라 뒤면 null
  private toScreen(point: THREE.Vector3): { x: number; y: number } | null {
    ndc.copy(point).project(this.camera);
    if (ndc.z > 1 || ndc.z < -1) return null;
    const x = ((ndc.x + 1) / 2) * innerWidth,
      y = ((1 - ndc.y) / 2) * innerHeight;
    return { x, y };
  }

  // 세계 반지름 radius 인 공의 화면 반지름(px)
  private projectedRadius(point: THREE.Vector3, radius: number): number {
    const dist = this.camera.position.distanceTo(point);
    const halfDeg = this.camera.fov / 2;
    const halfFov = THREE.MathUtils.degToRad(halfDeg);
    const span = Math.tan(halfFov) * dist;
    return (radius / span) * (innerHeight / 2);
  }

  // 그 자리가 화면에서 왼쪽(-1)·오른쪽(+1)
  private panAt(point: THREE.Vector3): number {
    right.setFromMatrixColumn(this.camera.matrixWorld, 0);
    const toward = tmpB.subVectors(point, this.camera.position).normalize();
    const side = toward.dot(right);
    return THREE.MathUtils.clamp(side, -1, 1);
  }

  private panOf(h: Hider): number {
    const center = h.box.center(tmpA);
    return this.panAt(center);
  }

  // ---- 도움 ----

  // 상자를 물건 속에: 귀 끝만 내밀고(길게) 물건 위를 본다
  private hideIn(h: Hider, prop: TeaProp) {
    h.prop = prop;
    const box = h.box;
    box.box.setScurry(0);
    box.box.setLongEars(true);
    const sink = prop.height - box.half * 2 * (1 - PEEK);
    const at = prop.spot.base.clone().addScaledVector(prop.spot.up, sink);
    face.set(1, 0, 0).cross(prop.spot.up);
    if (face.lengthSq() < 1e-6) face.set(0, 0, 1);
    face.normalize();
    box.put(at, prop.spot.up, face);
  }

  // 길을 따라 자리·위·보는 쪽
  private followRoute(h: Hider) {
    const route = h.route!;
    const s = Math.min(h.s, route.length);
    const at = tmpA,
      up = tmpUp;
    route.sample(s, at, up);
    route.heading(s, up, face);
    h.box.moveTo(at, up, face);
  }

  private setState(h: Hider, state: HiderState) {
    h.state = state;
    h.t = 0;
  }

  private fillNextSlot() {
    this.overlay.fillSlot(this.found);
    this.found++;
  }

  private markFirstFound() {
    if (this.stats.firstFoundAt === null) this.stats.firstFoundAt = this.now;
  }

  private rollWait(): number {
    const [low, high] = this.t.sneak.every;
    return low + this.rand() * (high - low);
  }

  private rollWiggle(): number {
    const [low, high] = WIGGLE;
    return low + this.rand() * (high - low);
  }

  // 판 시간으로 seconds 뒤에 한 번
  private later(seconds: number, run: () => void) {
    const at = this.now + seconds;
    this.timers.push({ at, run });
  }

  /** 때가 된 일을 한다(update 전에 부른다) */
  runTimers() {
    const due = this.timers.filter((x) => x.at <= this.now);
    this.timers = this.timers.filter((x) => x.at > this.now);
    for (const x of due) x.run();
  }
}

/* ─── 내부 ─────────────────────────── */

const Y_UP = new THREE.Vector3(0, 1, 0);
