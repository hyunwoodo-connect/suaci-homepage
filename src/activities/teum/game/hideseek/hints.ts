import * as THREE from "three";

import { ease } from "../core/frame";
import type { Creature } from "../creatures/creature";
import type { Services } from "../services";
import { S } from "../settings";
import type { HideFx } from "./effects";
import type { CameraFocus } from "./focus";
import type { Leap } from "./leap";
import { BOX_OUTLINE_PX } from "./limebox";
import type { HideOverlay } from "./overlay";
import type { Pawprints } from "./pawprints";
import type { Seeker } from "./seeker";
import { overBox } from "./seeker";
import type { Timeline } from "./timeline";
import type { HelpKind } from "./tuning";
import { HIDE } from "./tuning";

// 생물마다의 몸짓과 도움. 글자는 없다 — 보이는 몸짓과 소리로만(소리 없이도 뜻이 통하게).
// 누른 순간을 0초로: 0~0.65초는 helpers 가 하는 공통 연출(고리가 터지고, 미스트, 부르르·반짝, 카메라)이고 그 뒤가 여기다.
//   아는 척(noticePose) — 고리가 켜진 동안 되풀이하는 몸짓. 하던 일을 멈추고 나를 본다
//   도움(Hint) — 반응 → 힌트 → 끝. 끝나면 생물은 제 할 일로 돌아간다(토끼는 굴로, 열쇠는 스르르)

/** 도움이 판에 부탁하는 것 */
export interface HelpRound {
  /** 지금 찾는 중인가 · 찾기 시작 뒤 흐른 시간(초) */
  isSeeking(): boolean;
  roundT(): number;
  /** 지금 숨어 있는(눌러 찾을 수 있는) 상자들 · 그중 컵케이크 냄새에 걸어 나올 수 있는 것(물건 뒤에 숨은 것만) */
  hidden(): Seeker[];
  lurable(): Seeker[];
  /** k 상자가 냄새에 홀려 at 쪽으로 seconds 동안 걸어 나왔다가(내가 보고 있어도) 도로 달려가 숨는다(미끼) · 지금 걸어 나와 있나(돌아가는 중까지) */
  walkOut(k: Seeker, at: THREE.Vector3, seconds: number): void;
  isOut(k: Seeker): boolean;
  /** 해를 seconds 초만큼 over 초에 걸쳐 되돌린다 */
  rewind(seconds: number, over: number): void;
  /** 투시: center 둘레 radius(m) 안의 물건을 alpha 몫만 남기고 비춘다(radius 0 이면 끈다) */
  xray(center: THREE.Vector3, radius: number, alpha: number): void;
  /** 조작을 잠그거나 푼다 */
  hold(on: boolean): void;
}

/** 도움이 생물에게 부탁하는 것(Creatures) */
export interface HelpCreatures {
  invite(species: string, count: number): Creature[];
  seat(
    group: readonly Creature[],
    at: THREE.Vector3,
    orbit: number | null,
    alt: number | null,
    row: boolean,
  ): void;
  escort(c: Creature, run?: boolean): void;
  dismiss(c: Creature): void;
}

/** 도움을 주는 데 쓰는 것 */
export interface HintCtx {
  s: Services;
  creatures: HelpCreatures;
  round: HelpRound;
  fx: HideFx;
  overlay: HideOverlay;
  timeline: Timeline;
  focus: CameraFocus;
  prints: Pawprints;
  leap: Leap;
}

/** 도움 하나: 프레임마다 돌고 끝나면 false. 힌트가 가리키는 곳(카메라가 같이 담는다, 없으면 false) */
export interface Hint {
  update(dt: number): boolean;
  stop(): void;
  aim(out: THREE.Vector3): boolean;
}

/** 아는 척: 토끼가 상자 쪽을 힐끗하는 간격(초)·그 시간(초) */
const GLANCE_EVERY = 2,
  GLANCE_FOR = 0.45;
/** 토끼: 내 앞에 와서 서는 거리(m) · 뛰어오는 빠르기(m/s) · 둘러보는 시간·굴 파는 시간(초) · 기다리다 그만두는 시간(초)·거리(waitGap 의 배) */
const RABBIT_AHEAD = 4,
  RABBIT_COME = 11,
  LOOK_AROUND = 1,
  BURROW = 0.6,
  GIVE_UP_SECONDS = 8,
  GIVE_UP_GAP = 2;
/** 버섯: 갓이 꺼지는 시간·쏘아 올리는 시간·내려오는 시간(초) · 꼭대기에서 떠 있는 동안 처지는 몫 */
const SQUASH = 0.15,
  LAUNCH = 0.8,
  DESCEND = 2,
  HANG_SAG = 0.08;
/** 열쇠: 날아오는 시간·꽂는 시간·돌리는 시간(초) · 내 앞 거리(m)·땅에서 높이(m) · 파동이 퍼지는 시간(초) · 깜빡이는 수 · 원래대로 돌아오는 시간(초) */
const KEY_FLY = 0.25,
  KEY_PUSH = 0.15,
  KEY_TURN = 0.4,
  KEY_AHEAD = 3,
  KEY_AIR = 2.4,
  RIPPLE = 0.6,
  BLINKS = 2,
  KEY_RESTORE = 0.3;
/** 병정: 차렷·창 찍기(초) · 점호 시작(초) · 대답한 뒤 눈 가리기까지·가리는 시간(초) */
const ATTENTION = 0.15,
  ROLL_FROM = 0.35,
  COVER_AFTER = 0.6,
  COVER_FOR = 0.5;
/** 컵케이크: 몸 꼬기·풀썩(초) · 김 줄기가 흘러가는 빠르기(m/s)·가는 거리(m)·색 */
const TWIST = 0.4,
  PLOP = 0.15,
  PLUME_SPEED = 4,
  PLUME_REACH = 10,
  STEAM_COLOR = 0xff9ad2;
/** 회중시계: 하늘의 큰 시계가 떠 있는 시간(초) */
const SKY_CLOCK = 1.6;
/** 회중시계: 바늘이 거꾸로 도는 시간(초)·바퀴 · 뚜껑을 닫고 인사하는 시간(초) */
const HANDS = 0.8,
  HANDS_TURNS = 2,
  BOW = 0.6;

const tmp = new THREE.Vector3(),
  at = new THREE.Vector3(),
  side = new THREE.Vector3(),
  turn = new THREE.Vector3(),
  fwd = new THREE.Vector3();

/* ─── 아는 척 ─────────────────────────── */

/** 아는 척 한 프레임: 나를 보고, 종마다의 몸짓을 되풀이한다. base: 시작할 때의 높이(m)·자리, t: 아는 척을 한 지(초) */
export function noticePose(
  kind: HelpKind,
  members: readonly Creature[],
  base: readonly { a: number; v: THREE.Vector3 }[],
  t: number,
  ctx: HintCtx,
  boxAt: THREE.Vector3 | null,
) {
  const me = ctx.s.player.p as THREE.Vector3,
    half = members.length / 2,
    mid = Math.floor(half);
  members.forEach((c, i) => {
    const b = base[i];
    c.v.copy(b.v);
    c.a = b.a;
    c.hop = 0;
    c.sink = 0;
    c.pitch = 0;
    c.roll = 0;
    faceToward(c, me);
    if (kind === "rabbit") rabbitNotice(c, t, boxAt);
    else if (kind === "mushroom") mushroomNotice(c, t);
    else if (kind === "key") keyNotice(c, t);
    else if (kind === "soldier" && i === mid) c.pitch = -0.15;
    else if (kind === "cupcake") cupcakeNotice(c, t, ctx);
    else if (kind === "watch") watchNotice(c, t);
  });
}

// 토끼: 제자리에서 발을 동동, 2초마다 상자 쪽을 힐끗
function rabbitNotice(c: Creature, t: number, boxAt: THREE.Vector3 | null) {
  const drum = t * Math.PI * 5;
  const beat = Math.sin(drum);
  c.hop = 0.12 * Math.abs(beat);
  const cycle = t % GLANCE_EVERY;
  if (boxAt && cycle > GLANCE_EVERY - GLANCE_FOR) faceToward(c, boxAt);
}

// 버섯: 갓이 납작해졌다 부풀기(트램펄린), 제자리에서 통통
function mushroomNotice(c: Creature, t: number) {
  const phase = t * Math.PI * 2.8,
    squish = 0.5 + 0.5 * Math.sin(phase),
    flipped = phase + Math.PI,
    bounce = Math.sin(flipped);
  c.sink = 0.06 + 0.12 * squish;
  c.hop = 0.3 * Math.max(0, bounce);
}

// 열쇠: 빙글빙글 돌다 멈춰 이쪽저쪽 구멍을 찾는 시늉(앞으로 콕콕)
function keyNotice(c: Creature, t: number) {
  const cycle = t % 2.4;
  if (cycle < 0.9) {
    const spin = cycle * Math.PI * 4;
    c.f.applyAxisAngle(c.v, spin);
    return;
  }
  const poke = cycle - 0.9,
    halves = poke / 0.5,
    which = Math.floor(halves),
    sideways = which % 2 === 0 ? 0.6 : -0.6,
    jabPhase = (poke % 0.5) * Math.PI * 2,
    jabWave = Math.sin(jabPhase),
    jab = 0.25 * Math.max(0, jabWave);
  c.f.applyAxisAngle(c.v, sideways);
  const arc = jab / S.R;
  c.v.addScaledVector(c.f, arc).normalize();
}

// 컵케이크: 꼭대기 체리를 까딱까딱(몸을 흔들어), 옅은 분홍 김 한 가닥
function cupcakeNotice(c: Creature, t: number, ctx: HintCtx) {
  const rock = t * Math.PI * 3.2;
  c.roll = 0.12 * Math.sin(rock);
  const puff = t % 0.6 < 0.02;
  if (!puff) return;
  const rise = c.batch.hh * 2 + 0.4;
  at.copy(c.pos).addScaledVector(c.v, rise);
  ctx.fx.dot(at, 0.6, 1.2, STEAM_COLOR);
}

// 회중시계: 추처럼 좌우로 흔들흔들, 뚜껑이 살짝 열렸다 닫혔다
function watchNotice(c: Creature, t: number) {
  const sway = t * Math.PI * 1.4;
  c.roll = 0.3 * Math.sin(sway);
  const lid = t % 1.4;
  if (lid < 0.15) c.pitch = -0.2;
}

/* ─── 공통: 부르르·반짝 ─────────────────────────── */

/** 미스트를 맞고 부르르 떤 뒤 몸이 한 번 반짝(0.3초) */
export class Shiver implements Hint {
  private t = 0;

  constructor(
    private readonly ctx: HintCtx,
    private readonly members: readonly Creature[],
  ) {
    for (const c of members) {
      const lift = c.batch.hh;
      at.copy(c.pos).addScaledVector(c.v, lift);
      const size = c.batch.hh * 3.2;
      ctx.fx.dot(at, size, 0.15, 0xffffff);
    }
  }

  update(dt: number): boolean {
    this.t += dt;
    const u = this.t / 0.3,
      rest = 1 - u,
      fade = Math.max(0, rest),
      shake = this.t * 55;
    for (const c of this.members) c.roll = 0.16 * Math.sin(shake) * fade;
    if (u < 1) return true;
    this.stop();
    return false;
  }

  stop() {
    for (const c of this.members) c.roll = 0;
  }

  aim(): boolean {
    return false;
  }
}

/* ─── 토끼 ─────────────────────────── */

type RabbitStep = "startle" | "come" | "nod" | "run" | "wait" | "look" | "burrow" | "done";

/** 토끼(길): 깜짝 뛰었다가 내 앞에 와서 고갯짓 → 가장 가까운 숨은 상자 쪽으로 rabbit.run 만큼만 뛰며 라임 발자국(방향만 알려 준다 — 상자가 더 가까우면 그 앞에서) → 두리번 → 굴로 쏙 */
export class RabbitHint implements Hint {
  private step: RabbitStep = "startle";
  private t = 0;
  private stepT = 0;
  private walked = 0;
  /** 뛴 거리(m — rabbit.run 을 넘으면 거기서 굴로: 방향만 알려 준다) */
  private ran = 0;
  private readonly burrowAt: number;
  private readonly lookFrom = new THREE.Vector3();

  constructor(
    private readonly ctx: HintCtx,
    private readonly c: Creature,
    private readonly box: Seeker,
  ) {
    ctx.creatures.escort(c, false);
    const start = c.v.angleTo(box.box.v) * S.R,
      half = start * 0.5;
    this.burrowAt = Math.min(HIDE.rabbit.stop, half);
    ctx.s.events.emit("hideHelpUsed", { kind: "rabbit" });
  }

  aim(out: THREE.Vector3): boolean {
    out.copy(this.box.box.v).multiplyScalar(S.R);
    return true;
  }

  update(dt: number): boolean {
    this.t += dt;
    this.stepT += dt;
    const c = this.c,
      { player, terrain } = this.ctx.s,
      me = player.p as THREE.Vector3,
      R = HIDE.rabbit;
    const ground = terrain.groundAt(c.v);
    c.a = ground;
    const isOver = this.box.state !== "hidden" || !this.ctx.round.isSeeking();
    if (isOver && this.step !== "look" && this.step !== "burrow" && this.step !== "done")
      this.goLook();
    if (this.step === "startle") {
      const u = progress(this.stepT, 0.35),
        arc = bump(u);
      c.hop = 1.0 * arc;
      if (u >= 1) this.goTo("come");
      return true;
    }
    if (this.step === "come") {
      aheadOf(this.ctx.s, RABBIT_AHEAD, tmp);
      const left = c.v.angleTo(tmp) * S.R;
      c.isRunning = left > 0.3;
      if (c.isRunning) moveToward(c, tmp, RABBIT_COME, dt);
      else {
        faceToward(c, me);
        this.goTo("nod");
      }
      return true;
    }
    if (this.step === "nod") {
      const u = progress(this.stepT, 0.3),
        dip = bump(u);
      c.pitch = 0.35 * dip;
      if (u >= 1 && this.t >= 0.55) this.goTo("run");
      return true;
    }
    if (this.step === "run" || this.step === "wait") {
      const gap = c.v.angleTo(me) * S.R,
        isSeen = this.isOnScreen();
      // 나와 벌어지면 기다린다. 화면 밖으로 나가는 것은 내가 다른 쪽으로 끌고 있을 때뿐이다(가만히 있으면 카메라가 토끼를 따라 돈다)
      const isSteering = player.m0 > 0.1,
        isLost = !isSeen && isSteering;
      if (this.step === "run" && (gap > R.waitGap || isLost)) this.goTo("wait");
      else if (this.step === "wait" && gap < R.resumeGap && isSeen) this.goTo("run");
      // 내가 멀리 가 버리면(오래 안 오거나 아주 멀어지면) 그 자리에 굴을 파고 들어간다 — 나를 계속 돌려세우지 않게
      const giveUpGap = R.waitGap * GIVE_UP_GAP,
        isGone = gap > giveUpGap || this.stepT > GIVE_UP_SECONDS;
      if (this.step === "wait" && isGone) {
        this.goLook();
        return true;
      }
      if (this.step === "wait" && !isSteering) this.keepInView(dt);
      if (this.step === "wait") {
        c.isRunning = false;
        faceToward(c, me);
        const drum = this.stepT * Math.PI * 5;
        const beat = Math.sin(drum);
        c.hop = 0.12 * Math.abs(beat);
        return true;
      }
      c.hop = 0;
      c.isRunning = true;
      this.keepInView(dt);
      const speed = S.speed * R.speedShare,
        stride = speed * dt;
      moveToward(c, this.box.box.v, speed, dt);
      this.walked += stride;
      this.ran += stride;
      if (this.ran >= R.run) {
        this.goLook();
        return true;
      }
      if (this.walked >= R.stepGap) {
        this.walked = 0;
        this.ctx.prints.stamp(c.v, ground, c.f, R.trailSeconds);
      }
      const toBox = c.v.angleTo(this.box.box.v) * S.R;
      if (toBox <= this.burrowAt) this.goLook();
      return true;
    }
    if (this.step === "look") {
      c.isRunning = false;
      c.hop = 0;
      const sway = wave(this.stepT, 2) * 1.1;
      c.f.copy(this.lookFrom).applyAxisAngle(c.v, sway);
      if (this.stepT >= LOOK_AROUND) this.goTo("burrow");
      return true;
    }
    if (this.step === "burrow") {
      const dug = this.stepT / BURROW;
      const sunk = dug * 1.5;
      c.sink = Math.min(1.5, sunk);
      if (this.stepT < 0.05) this.dirt();
      if (dug < 1) return true;
      this.hide();
      return false;
    }
    return false;
  }

  stop() {
    if (this.step === "done") return;
    this.hide();
  }

  private goTo(step: RabbitStep) {
    this.step = step;
    this.stepT = 0;
  }

  // 상자 앞에 다 왔다(또는 판이 끝났다): 마지막 발자국 셋을 크고 밝게 하고 두리번
  private goLook() {
    this.ctx.prints.markLast(3);
    this.lookFrom.copy(this.c.f);
    this.goTo("look");
  }

  // 굴을 판다: 흙이 퐁
  private dirt() {
    const c = this.c,
      ground = this.ctx.s.terrain.groundAt(c.v);
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      side.crossVectors(c.v, c.f).normalize();
      const cos = Math.cos(angle),
        sin = Math.sin(angle);
      tmp.copy(c.f).multiplyScalar(cos).addScaledVector(side, sin);
      const lift = S.R + ground + 0.3,
        arc = 0.6 / S.R;
      at.copy(c.v).addScaledVector(tmp, arc).normalize().multiplyScalar(lift);
      this.ctx.fx.dot(at, 0.7, 0.6, 0xb89b72);
    }
  }

  // 굴로 쏙 — 이 판에서는 다시 안 나온다(판이 시작할 때 돌아온다). 땅속에 든 채 바로 지운다(다시 솟아 보이지 않게)
  private hide() {
    const c = this.c;
    this.step = "done";
    c.want = 0;
    c.vis = 0;
    c.isRunning = false;
    this.ctx.creatures.dismiss(c);
  }

  // 내가 끌지 않는 동안은 토끼 쪽으로 천천히 돌아선다(카메라가 따라 돌아 토끼가 늘 화면 안에 있다)
  private keepInView(dt: number) {
    const { player } = this.ctx.s;
    const c = this.c,
      p = player.p as THREE.Vector3,
      gap = c.v.angleTo(p) * S.R,
      reach = HIDE.rabbit.waitGap * GIVE_UP_GAP;
    if (player.m0 > 0.1 || gap > reach) return;
    tmp.copy(c.v).sub(p);
    const up = tmp.dot(p);
    tmp.addScaledVector(p, -up);
    if (tmp.lengthSq() < 1e-12) return;
    tmp.normalize();
    const k = ease(2.5, dt);
    player.lookTo(tmp, k);
  }

  private isOnScreen(): boolean {
    const c = this.c;
    const lift = c.batch.hh;
    at.copy(c.pos).addScaledVector(c.v, lift).project(this.ctx.s.camera.camera);
    return at.z < 1 && Math.abs(at.x) < 0.92 && Math.abs(at.y) < 0.92;
  }
}

/* ─── 버섯 ─────────────────────────── */

type MushroomStep = "board" | "squash" | "launch" | "hang" | "descend";

/** 버섯(높이): 아바타가 폴짝 올라타고 → 갓이 푹 꺼졌다 쏘아 올린다(18m) → 꼭대기에 떠서 광장을 내려다본다(멀리 보이는 상자도 눌러 찾는다) → 천천히 내려온다 */
export class MushroomHint implements Hint {
  private step: MushroomStep;
  private stepT = 0;
  private top = 0;

  /** walkedIn: 걸어 들어와서 이미 버섯 위다(올라타지 않는다) */
  constructor(
    private readonly ctx: HintCtx,
    private readonly c: Creature,
    walkedIn: boolean,
  ) {
    ctx.creatures.escort(c, false);
    const height = c.batch.hh * 2,
      isBoarding = !walkedIn && ctx.leap.start(c.v, height);
    this.step = isBoarding ? "board" : "squash";
    if (!isBoarding) this.squashNow();
  }

  /** 꼭대기에서 멀리 보이는 상자도 눌러 찾는 중인가 */
  get isHigh(): boolean {
    return this.step === "launch" || this.step === "hang";
  }

  aim(): boolean {
    return false;
  }

  update(dt: number): boolean {
    this.stepT += dt;
    const M = HIDE.mushroom,
      c = this.c,
      { player } = this.ctx.s;
    if (this.step === "board") {
      if (this.ctx.leap.update(dt)) this.squashNow();
      return true;
    }
    // 상자를 눌러 뛰어가거나 전설에 실리면 떠 있기를 그친다
    if (player.isHeld) {
      this.stop();
      return false;
    }
    if (this.step === "squash") {
      const u = progress(this.stepT, SQUASH);
      c.sink = 0.45 * u;
      player.glide(this.top, 1);
      if (u >= 1) this.launch();
      return true;
    }
    if (this.step === "launch") {
      const u = progress(this.stepT, LAUNCH),
        back = 1 - u,
        risen = 1 - back * back * back,
        air = this.top + (M.height - this.top) * risen,
        springAngle = u * Math.PI * 3,
        spring = Math.sin(springAngle) * (1 - u),
        quick = u * 6,
        squashed = 1 - Math.min(1, quick);
      c.sink = 0.45 * squashed - 0.1 * spring;
      player.glide(air, 1);
      if (u >= 1) this.goTo("hang");
      return true;
    }
    if (this.step === "hang") {
      c.sink = 0;
      const u = progress(this.stepT, M.hang),
        sag = M.height * (1 - HANG_SAG * u),
        k = ease(4, dt);
      player.glide(sag, k);
      if (u >= 1) {
        BOX_OUTLINE_PX.value = HIDE.box.outlinePx;
        this.goTo("descend");
      }
      return true;
    }
    const u = progress(this.stepT, DESCEND),
      from = M.height * (1 - HANG_SAG),
      air = from * (1 - u),
      k = ease(8, dt);
    player.glide(air, k);
    if (u < 1) return true;
    this.stop();
    return false;
  }

  stop() {
    BOX_OUTLINE_PX.value = HIDE.box.outlinePx;
    this.c.sink = 0;
    this.ctx.leap.stop();
    // 내려다보던 카메라만 돌려준다(전설이 내려오는 것 같은 다른 보기를 끊지 않는다)
    this.ctx.focus.endDown();
    this.ctx.creatures.dismiss(this.c);
  }

  private goTo(step: MushroomStep) {
    this.step = step;
    this.stepT = 0;
  }

  // 올라탔다: 갓이 푹 꺼진다. 카메라는 쏘아 올리는 동안과 꼭대기에서 아래로 숙인다
  private squashNow() {
    const { player } = this.ctx.s;
    this.top = player.air;
    const M = HIDE.mushroom,
      looking = SQUASH + LAUNCH + M.hang;
    this.ctx.focus.down(looking);
    this.goTo("squash");
  }

  private launch() {
    BOX_OUTLINE_PX.value = HIDE.box.outlineHighPx;
    this.ctx.s.events.emit("hideHelpUsed", { kind: "mushroom" });
    const ground = this.ctx.s.terrain.groundAt(this.c.v);
    this.ctx.fx.sonar(this.c.v, ground, 4, 0.5);
    this.goTo("launch");
  }
}

/* ─── 열쇠 ─────────────────────────── */

/** 열쇠(투시): 내 앞 허공으로 날아와 보이지 않는 구멍에 꽂혀 찰칵 → 둥근 파동이 퍼지며 가리는 물건이 유리가 된다 → 끝나기 전 두 번 깜빡 → 원래대로 */
export class KeyHint implements Hint {
  private t = 0;
  private readonly from = new THREE.Vector3();
  private readonly fromA: number;
  private readonly to = new THREE.Vector3();
  private readonly toA: number;
  private readonly center = new THREE.Vector3();
  private fidgetT = 0;
  private hasTurned = false;

  constructor(
    private readonly ctx: HintCtx,
    private readonly c: Creature,
  ) {
    const { s } = ctx;
    ctx.creatures.escort(c, false);
    this.from.copy(c.v);
    this.fromA = c.a;
    aheadOf(s, KEY_AHEAD, this.to);
    this.toA = s.terrain.groundAt(this.to) + KEY_AIR;
  }

  aim(): boolean {
    return false;
  }

  update(dt: number): boolean {
    this.t += dt;
    const c = this.c,
      K = HIDE.key,
      { player } = this.ctx.s,
      t = this.t,
      glassFrom = KEY_FLY + KEY_PUSH,
      end = glassFrom + K.seconds;
    if (t < KEY_FLY) {
      const u = t / KEY_FLY;
      c.v.copy(this.from).lerp(this.to, u).normalize();
      c.a = this.fromA + (this.toA - this.fromA) * u;
      c.f.copy(player.h);
    } else if (t < glassFrom) {
      const u = (t - KEY_FLY) / KEY_PUSH,
        arc = (0.3 * u) / S.R;
      c.v.copy(this.to).addScaledVector(player.h, arc).normalize();
    } else if (t < glassFrom + KEY_TURN) {
      if (!this.hasTurned) this.turnNow();
      const u = (t - glassFrom) / KEY_TURN;
      c.roll = (Math.PI / 2) * u;
    }
    if (t >= glassFrom + KEY_TURN) c.want = 0;
    const since = t - glassFrom,
      left = end - t;
    if (t >= glassFrom) this.glass(since, left, dt);
    if (t < end) return true;
    this.stop();
    return false;
  }

  stop() {
    this.ctx.round.xray(this.center, 0, 1);
    this.ctx.creatures.dismiss(this.c);
  }

  // 꽂힌 자리에서 찰칵: 둥근 파동
  private turnNow() {
    this.hasTurned = true;
    const c = this.c;
    const radius = S.R + c.a;
    this.center.copy(c.v).multiplyScalar(radius);
    const ground = this.ctx.s.terrain.groundAt(c.v);
    this.ctx.fx.wave(c.v, ground, HIDE.key.reach, RIPPLE, 0xffffff);
    this.ctx.s.events.emit("hideHelpUsed", { kind: "key" });
  }

  // 유리: 파동이 지나간 만큼 비치고, 끝나기 전 두 번 깜빡이고, 0.3초에 원래대로. 그동안 둘레 숨은 상자는 들킨 줄 모르고 딴짓
  private glass(since: number, left: number, dt: number) {
    const K = HIDE.key,
      spread = progress(since, RIPPLE),
      radius = K.reach * spread;
    let alpha = K.alpha;
    if (left <= KEY_RESTORE) {
      const back = 1 - left / KEY_RESTORE;
      alpha = K.alpha + (1 - K.alpha) * back;
    } else if (left <= K.warnSeconds) {
      const blinkSpan = (K.warnSeconds - KEY_RESTORE) / BLINKS,
        into = (K.warnSeconds - left) % blinkSpan;
      if (into < blinkSpan * 0.45) alpha = 1;
    }
    this.ctx.round.xray(this.center, radius, alpha);
    this.fidgetT -= dt;
    if (this.fidgetT > 0) return;
    this.fidgetT = 0.7;
    for (const k of this.ctx.round.hidden()) {
      const d = k.box.center(at).distanceTo(this.center);
      if (d > radius) continue;
      const roll = Math.random();
      if (roll < 0.35) k.box.jiggle();
      else if (roll < 0.6) k.box.wave();
    }
  }
}

/* ─── 카드 병정 ─────────────────────────── */

/** 카드 병정(점호): 착 차렷하고 가운데 병정이 창을 쿵 → 숨은 상자가 모두 가까운 것부터 귀를 번쩍 들고 "1" "2" … → 아차 눈 가림. 가리키지는 않는다(소리 나는 쪽을 보는 것은 내 몫) */
export class SoldierHint implements Hint {
  private t = 0;
  private readonly boxes: Seeker[];
  private readonly front: Creature;
  private readonly end: number;

  constructor(
    private readonly ctx: HintCtx,
    private readonly members: readonly Creature[],
  ) {
    const { overlay, round, timeline, s } = ctx,
      L = HIDE.soldier,
      p = s.player.p;
    for (const c of members) ctx.creatures.escort(c, false);
    const half = members.length / 2,
      mid = Math.floor(half);
    this.front = members[mid];
    s.events.emit("hideHelpUsed", { kind: "soldier" });
    this.boxes = round.hidden().sort((a, b) => {
      const da = a.box.v.angleTo(p),
        db = b.box.v.angleTo(p);
      return da - db;
    });
    this.boxes.forEach((k, i) => {
      const callAt = ROLL_FROM + i * L.gap,
        text = HIDE.copy.counts[i] ?? HIDE.copy.counts[0];
      timeline.after(callAt, () => {
        if (!round.isSeeking() || k.state !== "hidden") return;
        k.box.startle();
        k.box.hop(0.6);
        overlay.bubble(text, (out) => overBox(k, out), 1.4);
        s.events.emit("hideBoxAnswered", {});
      });
      timeline.after(callAt + COVER_AFTER, () => {
        if (!round.isSeeking() || k.state !== "hidden") return;
        k.box.coverEyes(true);
      });
      timeline.after(callAt + COVER_AFTER + COVER_FOR, () => {
        if (k.state === "hidden") k.box.coverEyes(false);
      });
    });
    const answered = ROLL_FROM + this.boxes.length * L.gap;
    this.end = answered + COVER_AFTER + COVER_FOR;
  }

  aim(): boolean {
    return false;
  }

  update(dt: number): boolean {
    this.t += dt;
    const t = this.t,
      me = this.ctx.s.player.p as THREE.Vector3;
    for (const c of this.members) {
      c.hop = t < ATTENTION ? 0.25 : 0;
      c.pitch = 0;
      faceToward(c, me);
    }
    // 가운데 병정이 창을 땅에 쿵
    if (t >= ATTENTION && t < ATTENTION + 0.15) this.front.pitch = 0.35;
    if (t < this.end) return true;
    this.stop();
    return false;
  }

  stop() {
    for (const c of this.members) {
      c.pitch = 0;
      c.hop = 0;
      this.ctx.creatures.dismiss(c);
    }
  }
}

/* ─── 컵케이크 ─────────────────────────── */

/** 컵케이크(미끼): 부끄러워 몸을 꼬다 풀썩 앉는다 → 분홍 김 한 줄기가 가장 가까운 숨은 상자 쪽으로 흘러가고, 그 상자가 냄새에 홀려
 * 내가 보고 있어도 뒤뚱뒤뚱 걸어 나온다(cupcake.walkSeconds) — 그동안 누르면 찾는다. 정신 차리면 도로 달려가 숨는다. 다 끝나면 일어나 꾸벅 하고 간다 */
export class CupcakeHint implements Hint {
  private t = 0;
  private puffT = 0;
  private readonly lured: Seeker | null;
  private readonly dir = new THREE.Vector3();
  private endT = -1;

  constructor(
    private readonly ctx: HintCtx,
    private readonly c: Creature,
  ) {
    ctx.creatures.escort(c, false);
    const lurable = ctx.round.lurable(),
      near = nearestTo(lurable, c.v),
      far = near ? near.box.v.angleTo(c.v) * S.R : Infinity;
    this.lured = near && far <= HIDE.cupcake.reach ? near : null;
  }

  aim(out: THREE.Vector3): boolean {
    if (!this.lured) return false;
    out.copy(this.lured.box.v).multiplyScalar(S.R);
    return true;
  }

  update(dt: number): boolean {
    this.t += dt;
    const c = this.c,
      t = this.t,
      me = this.ctx.s.player.p as THREE.Vector3;
    if (this.endT >= 0) return this.leave(dt);
    c.roll = 0;
    if (t < TWIST) {
      const wiggle = wave(t, 3.75) * 0.45;
      faceToward(c, me);
      c.f.applyAxisAngle(c.v, wiggle);
      return true;
    }
    if (t < TWIST + PLOP) {
      if (c.sink === 0) this.plop();
      const u = (t - TWIST) / PLOP;
      c.sink = 0.3 * u + 0.001;
      return true;
    }
    c.sink = 0.3;
    const k = this.lured,
      isWalking = k !== null && this.ctx.round.isOut(k);
    if (!isWalking || !this.ctx.round.isSeeking()) {
      this.endT = 0;
      return true;
    }
    // 걸어 나오는 상자를 힐끔힐끔, 김 줄기는 그 상자 쪽으로
    if (t % 1.6 < 0.7) faceToward(c, k.box.v);
    else faceToward(c, me);
    this.steam(dt, k);
    return true;
  }

  stop() {
    this.c.sink = 0;
    this.c.pitch = 0;
    this.c.roll = 0;
    this.ctx.creatures.dismiss(this.c);
  }

  // 풀썩: 앉으며 소리, 냄새에 홀린 상자가 걸어 나오기 시작한다
  private plop() {
    this.ctx.s.events.emit("hideHelpUsed", { kind: "cupcake" });
    const k = this.lured;
    if (k) this.ctx.round.walkOut(k, this.c.v, HIDE.cupcake.walkSeconds);
  }

  // 일어나 꾸벅 인사하고 간다
  private leave(dt: number): boolean {
    this.endT += dt;
    const c = this.c,
      u = progress(this.endT, BOW),
      stood = u * 3,
      risen = Math.min(1, stood);
    c.sink = 0.3 * (1 - risen);
    c.pitch = 0.35 * bump(u);
    faceToward(c, this.ctx.s.player.p as THREE.Vector3);
    if (u < 1) return true;
    this.stop();
    return false;
  }

  // 분홍 김: 컵케이크에서 상자 쪽으로 점이 이어진다(방향이 보이게)
  private steam(dt: number, k: Seeker) {
    this.puffT -= dt;
    if (this.puffT > 0) return;
    this.puffT = 0.12;
    const c = this.c;
    this.dir.copy(k.box.v).sub(c.v);
    const up = this.dir.dot(c.v);
    this.dir.addScaledVector(c.v, -up);
    const gap = this.dir.length() * S.R;
    if (gap < 1e-3) return;
    this.dir.normalize();
    const reach = Math.min(PLUME_REACH, gap),
      run = this.t * PLUME_SPEED,
      along = run % reach,
      top = c.batch.hh * 2 + 0.6,
      arc = along / S.R;
    at.copy(c.v).addScaledVector(this.dir, arc).normalize();
    const ground = this.ctx.s.terrain.groundAt(at),
      lift = S.R + ground + top;
    at.multiplyScalar(lift);
    this.ctx.fx.dot(at, 0.9, 1.1, STEAM_COLOR);
  }
}

/* ─── 회중시계 ─────────────────────────── */

/** 회중시계(시간): 뚜껑이 탁 열리고 바늘이 거꾸로 빠르게 돈다 — 해가 20초 되감기고 화면 가장자리에 반시계로 도는 빛 띠 → 뚜껑을 닫고 꾸벅 */
export class WatchHint implements Hint {
  private t = 0;

  constructor(
    private readonly ctx: HintCtx,
    private readonly c: Creature,
  ) {
    ctx.creatures.escort(c, false);
    ctx.round.rewind(HIDE.watch.addSeconds, HANDS);
    ctx.overlay.rewindBand(HANDS);
    ctx.overlay.skyClock(SKY_CLOCK);
    ctx.s.events.emit("hideHelpUsed", { kind: "watch" });
    const top = c.batch.hh * 2;
    at.copy(c.pos).addScaledVector(c.v, top);
    ctx.fx.dot(at, 1.2, 0.4);
  }

  aim(): boolean {
    return false;
  }

  update(dt: number): boolean {
    this.t += dt;
    const c = this.c,
      t = this.t;
    c.roll = 0;
    if (t < HANDS) {
      c.pitch = t < 0.12 ? -0.4 : -0.15;
      const spin = (-HANDS_TURNS * Math.PI * 2 * dt) / HANDS;
      c.f.applyAxisAngle(c.v, spin);
      return true;
    }
    const after = t - HANDS,
      u = progress(after, BOW);
    faceToward(c, this.ctx.s.player.p as THREE.Vector3);
    c.pitch = 0.3 * bump(u);
    if (u < 1) return true;
    this.stop();
    return false;
  }

  stop() {
    this.c.pitch = 0;
    this.ctx.creatures.dismiss(this.c);
  }
}

/* ─── 도움 없는 생물: 요란한 반응 ─────────────────────────── */

/** 요란한 반응의 길이(초) · 달아나는 거리(m) · 하트·종이·김 같은 알갱이 색 */
const POKE_SECONDS = 2.4,
  FLEE = 7,
  HEART_COLOR = 0xff7eb6,
  TEA_COLOR = 0xc89b6d;

/**
 * 도움 없는 생물을 눌렀다: 미스트를 맞고(부르르·반짝은 helpers 가) 종마다 요란하게 — 달아나는 놈(주사위·편지), 제자리에서 터지는 놈(찻주전자·하트·찻잔·종·모자),
 * 숨는 놈(장미). 뼈대가 없어 통째 움직임(돌기·튀기·커지기·가라앉기)과 알갱이(김·종이·하트)로 한다. 다 하면 제 할 일로
 */
export class PokeReaction implements Hint {
  private t = 0;
  private dotT = 0;
  private readonly from = new THREE.Vector3();
  private readonly away = new THREE.Vector3();
  private readonly baseA: number;
  private readonly isHappy: boolean;

  constructor(
    private readonly ctx: HintCtx,
    private readonly c: Creature,
  ) {
    ctx.creatures.escort(c, false);
    this.from.copy(c.v);
    this.baseA = c.a;
    const me = ctx.s.player.p as THREE.Vector3;
    this.away.copy(c.v).sub(me);
    const up = this.away.dot(c.v);
    this.away.addScaledVector(c.v, -up).normalize();
    this.isHappy = Math.random() < 0.5;
    ctx.s.events.emit("hideCreaturePoked", { species: c.k });
  }

  aim(): boolean {
    return false;
  }

  update(dt: number): boolean {
    this.t += dt;
    const c = this.c,
      u = progress(this.t, POKE_SECONDS);
    c.hop = 0;
    c.roll = 0;
    c.pitch = 0;
    this.dotT -= dt;
    const isPuff = this.dotT <= 0;
    if (isPuff) this.dotT = 0.12;
    if (c.k === "teapot") this.teapot(dt, u, isPuff);
    else if (c.k === "c_dice") this.dice(dt, u);
    else if (c.k === "c_wletter") this.letter(dt, u, isPuff);
    else if (c.k === "c_wheart") this.heart(u);
    else if (c.k === "c_wcup") this.cup(dt, u, isPuff);
    else if (c.k === "c_wbell") this.bell(u);
    else if (c.k === "c_hat") this.hat(u);
    else if (c.k === "c_rose") this.rose(u);
    else this.spin(dt, u);
    if (u < 1) return true;
    this.stop();
    return false;
  }

  stop() {
    const c = this.c;
    c.hop = c.roll = c.pitch = c.sink = 0;
    c.want = 1;
    c.a = this.baseA;
    this.ctx.creatures.dismiss(c);
  }

  // 찻주전자: 뚜껑이 들썩들썩(통통), 김을 뿜으며 팽이처럼 돌고, 주둥이로 차를 한 줄기
  private teapot(dt: number, u: number, isPuff: boolean) {
    const c = this.c,
      turn = dt * Math.PI * 6 * bump(u);
    c.f.applyAxisAngle(c.v, turn);
    const rattle = wave(this.t, 9);
    c.hop = 0.08 * Math.abs(rattle);
    const steamAt = c.batch.hh * 2.2;
    if (isPuff) this.puffAt(steamAt, 0.8, 0xffffff);
    if (u > 0.45 && u < 0.7 && isPuff) this.stream(TEA_COLOR);
  }

  // 주사위: 깜짝 뛰어 데굴데굴 굴러 달아난다 → 멈추면 나온 눈을 보고 좋아하거나(폴짝) 실망한다(납작)
  private dice(dt: number, u: number) {
    const c = this.c;
    if (u < 0.6) {
      const speed = FLEE / (POKE_SECONDS * 0.6),
        arc = (speed * dt) / S.R;
      c.v.addScaledVector(this.away, arc).normalize();
      c.a = this.ctx.s.terrain.groundAt(c.v);
      const rolled = this.t * 12;
      c.pitch = rolled;
      c.f.copy(this.away);
      return;
    }
    faceToward(c, this.ctx.s.player.p as THREE.Vector3);
    const after = (u - 0.6) / 0.4;
    const joy = wave(after, 2);
    if (this.isHappy) c.hop = 0.5 * Math.abs(joy);
    else c.sink = 0.25 * bump(after);
  }

  // 날개 편지: 봉투가 펑 열리며 하트 종이가 쏟아지고, 부끄러워 지그재그로 날아 달아난다
  private letter(dt: number, u: number, isPuff: boolean) {
    const c = this.c;
    if (this.t < 0.15 && isPuff)
      for (let i = 0; i < 5; i++) this.puffAt(c.batch.hh, 0.6, HEART_COLOR);
    const zig = wave(this.t, 2.5) * 0.9,
      speed = FLEE / POKE_SECONDS,
      arc = (speed * dt) / S.R;
    const zigArc = (zig * dt) / S.R;
    side.crossVectors(c.v, this.away).normalize();
    c.v.addScaledVector(this.away, arc).addScaledVector(side, zigArc).normalize();
    c.a = this.baseA + 2 * u;
    c.f.copy(this.away);
  }

  // 날개 하트: 두근두근 부풀다 두 배로 커졌다가 퐁 — 작은 하트 셋으로 흩어졌다 다시 모인다
  private heart(u: number) {
    const c = this.c;
    if (u < 0.4) {
      const pulse = wave(this.t, 3),
        beat = Math.abs(pulse);
      c.want = 1 + u * 2.5 + 0.15 * beat;
      return;
    }
    if (u < 0.45) {
      c.want = 0;
      for (let i = 0; i < 3; i++) this.puffAt(c.batch.hh, 0.9, HEART_COLOR);
      return;
    }
    c.want = u > 0.8 ? 1 : 0;
  }

  // 날개 찻잔: 차를 엎지르고 허둥지둥 빙빙
  private cup(dt: number, u: number, isPuff: boolean) {
    const c = this.c,
      turn = dt * Math.PI * 4;
    c.f.applyAxisAngle(c.v, turn);
    c.roll = 0.5 * bump(u);
    const radius = 1.5 / S.R,
      angle = this.t * Math.PI * 2;
    side.crossVectors(c.v, this.away).normalize();
    const cos = Math.cos(angle) * radius,
      sin = Math.sin(angle) * radius;
    c.v.copy(this.from).addScaledVector(this.away, cos).addScaledVector(side, sin).normalize();
    if (isPuff && u < 0.5) this.puffAt(-0.4, 0.5, TEA_COLOR);
  }

  // 날개 종: 딸랑딸랑 흔들리며 위로 솟구쳤다 내려온다
  private bell(u: number) {
    const c = this.c,
      ring = wave(this.t, 6);
    c.roll = 0.5 * ring * (1 - u);
    c.a = this.baseA + 3 * bump(u);
  }

  // 모자: 뒤집혀서 안에서 작은 것(꽃·리본·꼬마 라임)이 하나 튀어나온다
  private hat(u: number) {
    const c = this.c;
    c.roll = Math.PI * bump(u);
    const popAt = c.batch.hh * 2.5;
    if (u > 0.45 && u < 0.5) this.puffAt(popAt, 1.2, 0xa9ff39);
  }

  // 장미: 꽃잎을 확 펼쳤다가(커짐) 부끄러워 오므리고 땅속으로 반쯤 숨는다
  private rose(u: number) {
    const c = this.c;
    if (u < 0.3) {
      const open = u / 0.3;
      c.want = 1 + bump(open) * 0.4;
      return;
    }
    c.want = 1;
    const shy = (u - 0.3) / 0.7;
    c.sink = 0.6 * bump(shy);
  }

  // 그 밖: 제자리에서 빙글 돌며 폴짝
  private spin(dt: number, u: number) {
    const c = this.c,
      turn = dt * Math.PI * 4;
    c.f.applyAxisAngle(c.v, turn);
    c.hop = 0.6 * bump(u);
  }

  // 몸 위 lift(m)에 알갱이 하나
  private puffAt(lift: number, size: number, color: number) {
    const c = this.c,
      jitter = (Math.random() - 0.5) * 1.2,
      up = c.batch.hh + lift;
    side.crossVectors(c.v, c.f).normalize();
    at.copy(c.pos).addScaledVector(c.v, up).addScaledVector(side, jitter);
    this.ctx.fx.dot(at, size, 0.8, color);
  }

  // 주둥이 쪽으로 한 줄기(앞으로 이어진 점)
  private stream(color: number) {
    const c = this.c;
    for (let i = 1; i <= 4; i++) {
      const ahead = c.batch.hh + i * 0.5,
        up = c.batch.hh * 1.2;
      at.copy(c.pos).addScaledVector(c.f, ahead).addScaledVector(c.v, up);
      this.ctx.fx.dot(at, 0.45, 0.5, color);
    }
  }
}

/* ─── 다 쓴 생물의 인사 ─────────────────────────── */

/** 다 쓴 생물: 내가 가까이 가면 손(귀·몸)을 흔들어 인사만 한다(0.9초) */
export class WaveHello implements Hint {
  private t = 0;
  private readonly baseA: number;

  constructor(
    private readonly ctx: HintCtx,
    private readonly c: Creature,
  ) {
    ctx.creatures.escort(c, false);
    this.baseA = c.a;
  }

  aim(): boolean {
    return false;
  }

  update(dt: number): boolean {
    this.t += dt;
    const c = this.c,
      u = progress(this.t, 0.9),
      shake = wave(u, 2);
    c.a = this.baseA;
    faceToward(c, this.ctx.s.player.p as THREE.Vector3);
    c.roll = 0.22 * shake * (1 - u);
    c.hop = 0.25 * Math.abs(shake) * (1 - u);
    if (u < 1) return true;
    this.stop();
    return false;
  }

  stop() {
    this.c.roll = 0;
    this.c.hop = 0;
    this.ctx.creatures.dismiss(this.c);
  }
}

/* ─── 내부 ─────────────────────────── */

/** 내 앞 meters(m) 자리(땅 위 단위 벡터) */
export function aheadOf(s: Services, meters: number, out: THREE.Vector3): THREE.Vector3 {
  const arc = meters / S.R;
  return out.copy(s.player.p).addScaledVector(s.player.h, arc).normalize();
}

/** c 를 to(단위 벡터) 쪽으로 speed(m/s)로 옮기고 그쪽을 보게 한다 */
export function moveToward(c: Creature, to: THREE.Vector3, speed: number, dt: number) {
  turn.crossVectors(c.v, to);
  if (turn.lengthSq() < 1e-12) return;
  turn.normalize();
  const left = c.v.angleTo(to),
    move = (speed * dt) / S.R,
    step = Math.min(left, move);
  fwd.crossVectors(turn, c.v).normalize();
  c.v.applyAxisAngle(turn, step).normalize();
  c.f.copy(fwd);
}

/** c 가 to(단위 벡터) 쪽을 보게 한다 */
export function faceToward(c: Creature, to: THREE.Vector3) {
  fwd.copy(to).normalize().sub(c.v);
  const up = fwd.dot(c.v);
  fwd.addScaledVector(c.v, -up);
  if (fwd.lengthSq() < 1e-12) return;
  fwd.normalize();
  c.f.copy(fwd);
}

/** at 에서 가장 가까운 상자 */
export function nearestTo(boxes: readonly Seeker[], at: THREE.Vector3): Seeker | null {
  let best: Seeker | null = null,
    bestD = Infinity;
  for (const k of boxes) {
    const d = k.box.v.angleTo(at);
    if (d < bestD) {
      bestD = d;
      best = k;
    }
  }
  return best;
}

/** t 가 seconds 가운데 얼마나 갔나(0..1) */
function progress(t: number, seconds: number): number {
  const u = t / seconds;
  return Math.min(1, u);
}

/** 0..1 동안 한 번 솟았다 내려오는 곡선 */
function bump(u: number): number {
  const angle = u * Math.PI;
  return Math.sin(angle);
}

/** 초당 hz 번 오르내리는 물결(-1..1) */
function wave(t: number, hz: number): number {
  const angle = t * Math.PI * 2 * hz;
  return Math.sin(angle);
}
