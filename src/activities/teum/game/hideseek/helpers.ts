import * as THREE from "three";

import { ease } from "../core/frame";
import type { Creature } from "../creatures/creature";
import { GUEST_ROW_GAP } from "../creatures/creatures";
import type { Services } from "../services";
import { S } from "../settings";
import type { HideFx } from "./effects";
import type { CameraFocus } from "./focus";
import type { HideOverlay } from "./overlay";
import type { PickTarget } from "./picker";
import type { Seeker } from "./seeker";
import { startPoint, sphereAt } from "./spots";
import type { Timeline } from "./timeline";
import type { GuestGroup, HelpKind } from "./tuning";
import { HIDE } from "./tuning";

// 생물 — 종류마다 다른 것을 준다. 잡는 법은 하나: 생물을 직접 톡 친다(버섯만 밟는다). 닿기만 해서는 아무 일도 없다.
// 누르면 미스트가 날아가고 → 그 생물만의 반응(1초) 동안 카메라가 생물을 화면 가운데로 잡고(조작은 잠깐만 잠긴다) → 도움이 시작된다.
// 도움은 주는 정보의 축이 서로 다르다:
//   토끼(길) — 가장 가까운 숨은 상자 쪽으로 뛰며 빛나는 발자국을 남기고, 상자 앞에서 굴로 사라진다
//   버섯(높이) — 밟으면 높이 튕겨 올라 천천히 내려온다. 그동안 아래를 내려다보고 멀리 보이는 상자도 눌러 찾는다
//   열쇠(투시) — 내 둘레의 가리는 물건이 잠깐 유리처럼 비친다
//   카드 병정(점호) — "번호!" 하면 숨은 상자들이 반사적으로 귀를 들고 번호를 댄다
//   컵케이크(미끼) — 달콤한 냄새에 가장 가까운 숨은 상자가 내가 안 볼 때 살금살금 다가온다
//   회중시계(시간) — 해가 되돌아간다
// 쓸 수 있는 생물은 머리 위에 라임 물방울이 통통 뜬다(가까우면 커진다). 한 번 쓴 생물은 그 판에 다시 못 쓴다.
// 오래 못 찾으면 가장 가까운 쓸 수 있는 생물이 내 화면 안으로 와서 물방울을 크게 흔든다 — 누르는 것은 내 몫이다.
// 손님 무리는 판마다 seats 를 섞어 앉힌다(첫 판에는 토끼가 시작 자리에서 가장 가까운 자리)

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

/** 도움이 판에 부탁하는 것 */
export interface HelpRound {
  /** 지금 찾는 중인가 */
  isSeeking(): boolean;
  /** 지금 숨어 있는(눌러 찾을 수 있는) 상자들 · 그중 컵케이크 냄새에 끌려올 수 있는 것(내 곁을 따라오는 아닌 척은 빼고) */
  hidden(): Seeker[];
  lurable(): Seeker[];
  /** k 상자가 at 쪽으로 내가 안 볼 때만 다가온다(미끼). null 이면 그친다 */
  lure(k: Seeker | null, at: THREE.Vector3 | null): void;
  /** 해를 seconds 초만큼 되돌린다 */
  rewind(seconds: number): void;
  /** 투시: center 둘레 radius(m) 안의 물건을 alpha 몫만 남기고 비춘다(radius 0 이면 끈다) */
  xray(center: THREE.Vector3, radius: number, alpha: number): void;
  /** 조작을 잠그거나 푼다 */
  hold(on: boolean): void;
}

/** 생물 반응 시간(초) · 반응에서 콩 뛰는 높이(m) · 토끼가 놀라 달아나는 거리(m) */
const REACT_SECONDS = 1,
  REACT_HOP = 1.1,
  RABBIT_FLEE = 1.6;
/** 토끼: 뛰는 빠르기(m/s) · 발자국 사이(m)·크기(m)·좌우 벌림(m) · 기다리다 다시 뛰는 거리(waitGap 의 몫) · 굴 파는 시간(초) */
const RABBIT_SPEED = 8,
  PRINT_EVERY = 0.9,
  PRINT_SIZE = 0.6,
  PRINT_SIDE = 0.35,
  RABBIT_RESUME = 0.7,
  BURROW = 0.6;
/** 버섯: 튕겨 오르는 시간(초) · 다 내려왔을 때의 높이(height 의 몫) · 밟은 것으로 치는 거리(m)·높이(m) */
const MUSHROOM_RISE = 0.8,
  MUSHROOM_LOW = 0.6,
  STEP_REACH = 2.2,
  STEP_AIR = 1.2;
/** 컵케이크 김: 피우는 간격(초)·크기(m)·남는 시간(초)·색 */
const STEAM_EVERY = 0.22,
  STEAM_SIZE = 0.9,
  STEAM_LIFE = 1.6,
  STEAM_COLOR = 0xff9ad2;
/** 물방울 표시: 크기(m — 가까우면 near 배, 부르러 오면 call 배)·생물 머리 위 높이(m)·통통 뜨는 폭(m) */
const MARK_SIZE = 1,
  MARK_NEAR = 1.6,
  MARK_CALL = 2.6,
  MARK_OVER = 1.1,
  MARK_BOB = 0.25;
/** 부르러 오기: 빠르기(m/s) · 내 앞 거리(m)·옆 거리(m) · 와서 기다리는 시간(초) */
const CALL_SPEED = 11,
  CALL_AHEAD = 10,
  CALL_SIDE = 3,
  CALL_WAIT = 12;
/** 미스트 알갱이 수 · 말풍선 띄우는 높이(머리 위 m) */
const MIST_DOTS = 5,
  BUBBLE_OVER = 0.7;

const tmp = new THREE.Vector3(),
  at = new THREE.Vector3(),
  side = new THREE.Vector3(),
  turn = new THREE.Vector3(),
  fwd = new THREE.Vector3();

/** 손님 한 무리 */
interface Group {
  spec: GuestGroup;
  members: Creature[];
  /** 표시를 다는 생물(줄이면 가운데) */
  lead: Creature | null;
  mark: THREE.Sprite | null;
}

/** 도움 하나(반응·도움): 프레임마다 돌고 끝나면 false */
interface Hint {
  update(dt: number): boolean;
  stop(): void;
}

/** 도움을 주는 데 쓰는 것 */
interface HintCtx {
  s: Services;
  creatures: HelpCreatures;
  round: HelpRound;
  fx: HideFx;
  overlay: HideOverlay;
  timeline: Timeline;
}

/** 생물 도움 */
export class CreatureHelp {
  private readonly groups: Group[];
  private readonly used = new Set<HelpKind>();
  private readonly hints: Hint[] = [];
  private readonly ctx: HintCtx;
  private readonly markTex: THREE.CanvasTexture;
  /** 오래 못 찾아 부르러 오는 생물 · 와서 기다릴 자리 · 남은 시간(초) */
  private caller: Creature | null = null;
  private readonly callAt = new THREE.Vector3();
  private callLeft = 0;
  /** 버섯으로 떠 있는 중(멀리 보이는 상자도 눌러 찾는다) */
  private hang: MushroomHang | null = null;
  /** 쓸 수 있는 생물이 markReach 안에 있나(첫 판 안내 '생물을 눌러 봐') */
  private hasHelperNear = false;
  private time = 0;

  constructor(
    private readonly s: Services,
    creatures: HelpCreatures,
    round: HelpRound,
    fx: HideFx,
    overlay: HideOverlay,
    private readonly focus: CameraFocus,
    timeline: Timeline,
    private readonly rand: () => number,
  ) {
    this.ctx = { s, creatures, round, fx, overlay, timeline };
    this.markTex = dropTexture();
    this.groups = HIDE.guests.map((spec) => {
      const members = creatures.invite(spec.species, spec.count);
      const half = members.length / 2,
        leadAt = Math.floor(half),
        lead = members[leadAt] ?? null,
        mark = spec.help ? this.newMark() : null;
      return { spec, members, lead, mark };
    });
  }

  /** 지금 상자를 눌러 찾을 수 있는 거리(m) — 버섯으로 떠 있는 동안은 더 멀리 */
  get tapReach(): number {
    return this.hang ? HIDE.mushroom.tapReach : HIDE.find.tapReach;
  }

  /** 쓸 수 있는 생물이 가까이 있나 */
  get isHelperNear(): boolean {
    return this.hasHelperNear;
  }

  /** 판 시작(눈을 감은 동안): 하던 도움을 거두고, 손님 무리를 섞은 자리에 앉힌다. 첫 판이면 토끼를 시작 자리 곁에 */
  reset(hub: THREE.Vector3, first: boolean) {
    this.stop();
    this.used.clear();
    const order = this.seatOrder(first);
    this.groups.forEach((g, i) => {
      const seat = HIDE.seats[order[i]];
      sphereAt(at, hub, seat.x, seat.y);
      const { orbit, alt, row } = g.spec;
      this.ctx.creatures.seat(g.members, at, orbit, alt, row);
    });
  }

  /** 이 판에 그 종 무리가 앉은 자리(가면 상자가 섞여 든다). 없으면 null */
  homeOf(species: string, out: THREE.Vector3): THREE.Vector3 | null {
    const g = this.groups.find((x) => x.spec.species === species);
    const c = g?.lead;
    if (!c) return null;
    return out.copy(c.home);
  }

  /** 카드 병정 줄의 맨 끝 다음 자리(out)와 병정이 보는 쪽(face). 병정이 없으면 false */
  rowEnd(out: THREE.Vector3, face: THREE.Vector3): boolean {
    const g = this.groups.find((x) => x.spec.help === "soldier");
    const first = g?.members[0],
      last = g?.members[g.members.length - 1];
    if (!first || !last || first === last) return false;
    tmp.copy(last.home).sub(first.home).normalize();
    const step = GUEST_ROW_GAP / S.R;
    out.copy(last.home).addScaledVector(tmp, step).normalize();
    face.copy(last.f);
    return true;
  }

  /** 누를 수 있는 생물(쓸 수 있는 무리의 생물 전부)을 targets 에 더한다 */
  targets(out: PickTarget<Creature>[]) {
    for (const g of this.groups) {
      if (!g.spec.help) continue;
      for (const c of g.members) {
        if (c.gone || c.vis < 0.5) continue;
        const center = c.pos.clone().addScaledVector(c.v, c.batch.hh);
        out.push({ item: c, center, halfH: c.batch.hh, halfW: c.batch.hh });
      }
    }
  }

  /** c 를 눌렀다(거리는 판이 이미 쟀다). 쓴 도움 종류(못 쓰면 null) */
  use(c: Creature): HelpKind | null {
    const g = this.groups.find((x) => x.members.includes(c));
    const kind = g?.spec.help ?? null;
    // 도움을 주는 중인 생물(토끼가 뛰는 중·컵케이크가 앉은 중)은 누르는 것을 받지 않는다 — 부르러 온 생물만 받는다
    if (c.st === "guide" && c !== this.caller) return null;
    this.mist(c);
    // 버섯은 밟아야 하고, 한 번 쓴 생물은 원래 반응만 한다
    if (!g || !kind || kind === "mushroom" || this.used.has(kind)) {
      const shrug = new Reaction(this.ctx, [c], null);
      this.hints.push(shrug);
      return null;
    }
    this.begin(g, kind);
    return kind;
  }

  /** 오래 못 찾았다: 가장 가까운 쓸 수 있는 생물이 내 화면 안으로 온다. 부를 생물이 없으면 false */
  call(): boolean {
    if (this.caller || this.hints.length) return false;
    const p = this.s.player.p;
    let best: Group | null = null,
      bestD = Infinity;
    for (const g of this.groups) {
      const c = g.lead;
      const help = g.spec.help;
      if (!c || !help || help === "mushroom" || this.used.has(help) || c.gone) continue;
      const d = c.v.angleTo(p);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    const c = best?.lead;
    if (!c) return false;
    const { player } = this.s,
      h = player.h as THREE.Vector3;
    side.crossVectors(player.p, h).normalize();
    const aheadArc = CALL_AHEAD / S.R,
      sideArc = CALL_SIDE / S.R;
    this.callAt.copy(player.p).addScaledVector(h, aheadArc).addScaledVector(side, sideArc);
    this.callAt.normalize();
    this.ctx.creatures.escort(c, true);
    this.caller = c;
    this.callLeft = CALL_WAIT;
    return true;
  }

  /** 한 프레임(찾는 중) */
  update(dt: number) {
    this.time += dt;
    this.stepOnMushroom();
    this.walkCaller(dt);
    for (let i = this.hints.length - 1; i >= 0; i--) {
      const isAlive = this.hints[i].update(dt);
      if (isAlive) continue;
      if (this.hints[i] === this.hang) this.hang = null;
      this.hints.splice(i, 1);
    }
    this.placeMarks();
  }

  /** 찾기가 끝났다: 하던 도움을 거두고 생물을 돌려보낸다 */
  stop() {
    for (const h of this.hints) h.stop();
    this.hints.length = 0;
    this.hang = null;
    if (this.caller) this.ctx.creatures.dismiss(this.caller);
    this.caller = null;
    for (const g of this.groups)
      for (const c of g.members) if (c.st === "guide") this.ctx.creatures.dismiss(c);
    this.focus.drop();
    for (const g of this.groups) if (g.mark) g.mark.visible = false;
  }

  dispose() {
    for (const g of this.groups) {
      g.mark?.removeFromParent();
      g.mark?.material.dispose();
    }
    this.markTex.dispose();
  }

  /* ─── 내부 ─────────────────────────── */

  // 도움을 시작한다: 미스트 → 반응(카메라가 생물을 잡고, 조작은 잠깐 잠긴다) → 도움
  private begin(g: Group, kind: HelpKind) {
    const { round, timeline, s } = this.ctx,
      H = HIDE.help,
      lead = g.lead ?? g.members[0];
    this.used.add(kind);
    if (this.caller && g.members.includes(this.caller)) this.caller = null;
    this.focus.look((out) => out.copy(lead.pos), H.focusSeconds);
    round.hold(true);
    timeline.after(H.lockSeconds, () => round.hold(false));
    s.events.emit("hideHelpUsed", { kind });
    const reaction = new Reaction(this.ctx, g.members, kind);
    this.hints.push(reaction);
    timeline.after(REACT_SECONDS, () => {
      const hint = round.isSeeking() ? this.hintFor(kind, g) : null;
      if (hint) this.hints.push(hint);
      // 도움이 이어지지 않으면(판이 끝났거나 갈 상자가 없다) 맡았던 생물을 돌려보낸다
      else for (const m of g.members) if (m.st === "guide") this.ctx.creatures.dismiss(m);
    });
  }

  private hintFor(kind: HelpKind, g: Group): Hint | null {
    const ctx = this.ctx,
      c = g.lead ?? g.members[0];
    if (kind === "rabbit") {
      const hidden = ctx.round.hidden(),
        box = nearestTo(hidden, c.v);
      return box ? new RabbitTrail(ctx, c, box) : null;
    }
    if (kind === "key") return new KeyXray(ctx);
    if (kind === "soldier") return new RollCall(ctx, c);
    if (kind === "cupcake") return new CupcakeLure(ctx, c);
    if (kind === "watch") {
      ctx.round.rewind(HIDE.watch.addSeconds);
      return null;
    }
    return null;
  }

  // 버섯: 밟으면(곁에서 땅 가까이) 튕겨 오른다
  private stepOnMushroom() {
    if (this.used.has("mushroom") || this.hang) return;
    const g = this.groups.find((x) => x.spec.help === "mushroom");
    const c = g?.lead,
      { player } = this.s;
    if (!g || !c || c.gone || player.isHeld) return;
    const d = c.v.angleTo(player.p) * S.R;
    if (d > STEP_REACH || player.air > STEP_AIR) return;
    this.used.add("mushroom");
    this.s.events.emit("hideHelpUsed", { kind: "mushroom" });
    const squash = new Reaction(this.ctx, [c], "mushroom");
    this.hints.push(squash);
    this.hang = new MushroomHang(this.ctx, this.focus);
    this.hints.push(this.hang);
  }

  // 부르러 오는 생물: 내 앞까지 와서 물방울을 크게 흔들며 기다린다. 오래 안 누르면 돌아간다
  private walkCaller(dt: number) {
    const c = this.caller;
    if (!c) return;
    this.callLeft -= dt;
    if (this.callLeft <= 0) {
      this.ctx.creatures.dismiss(c);
      this.caller = null;
      return;
    }
    const left = c.v.angleTo(this.callAt) * S.R;
    c.isRunning = left > 0.3;
    if (c.isRunning) moveToward(c, this.callAt, CALL_SPEED, dt);
    else faceToward(c, this.s.player.p as THREE.Vector3);
    const ground = this.s.terrain.groundAt(c.v),
      sky = c.role === "flock" ? ground + 3 : ground,
      k = ease(6, dt);
    c.a += (sky - c.a) * k;
  }

  // 머리 위 물방울: 쓸 수 있는 동안만, 가까우면 크게, 부르러 왔으면 더 크게 흔든다
  private placeMarks() {
    const { player } = this.s;
    this.hasHelperNear = false;
    for (const g of this.groups) {
      const m = g.mark,
        c = g.lead,
        kind = g.spec.help;
      if (!m || !c || !kind) continue;
      const isUsable = !this.used.has(kind) && !c.gone && c.vis > 0.5;
      m.visible = isUsable;
      if (!isUsable) continue;
      const d = c.v.angleTo(player.p) * S.R,
        isNear = d <= HIDE.help.markReach,
        isCalled = c === this.caller;
      if (isNear) this.hasHelperNear = true;
      const phase = this.time * 3 + c.ph,
        bob = Math.sin(phase) * MARK_BOB,
        lift = c.batch.hh * 2 + MARK_OVER + bob;
      m.position.copy(c.pos).addScaledVector(c.v, lift);
      const grow = isCalled ? MARK_CALL : isNear ? MARK_NEAR : 1,
        wobblePhase = this.time * 9,
        wobble = isCalled ? 1 + 0.15 * Math.sin(wobblePhase) : 1,
        size = MARK_SIZE * grow * wobble;
      m.scale.setScalar(size);
    }
  }

  // 판마다 손님 무리가 앉을 자리 순서: 섞고, 첫 판이면 토끼를 시작 자리에서 가장 가까운 자리로
  private seatOrder(first: boolean): number[] {
    const order = HIDE.seats.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const roll = this.rand() * (i + 1),
        j = Math.floor(roll);
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (!first) return order;
    const rabbit = this.groups.findIndex((g) => g.spec.help === "rabbit");
    const start = startPoint();
    let near = 0,
      nearD = Infinity;
    HIDE.seats.forEach((seat, i) => {
      const dx = seat.x - start.x,
        dy = seat.y - start.y,
        d = Math.hypot(dx, dy);
      if (d < nearD) {
        nearD = d;
        near = i;
      }
    });
    const at = order.indexOf(near);
    [order[rabbit], order[at]] = [order[at], order[rabbit]];
    return order;
  }

  // 미스트가 내 자리에서 생물로 날아간다
  private mist(c: Creature) {
    const from = this.s.player.P.clone(),
      to = c.pos.clone();
    for (let i = 1; i <= MIST_DOTS; i++) {
      const share = i / (MIST_DOTS + 1),
        wait = share * HIDE.find.mistSeconds;
      this.ctx.timeline.after(wait, () => {
        const mote = tmp.copy(from).lerp(to, share);
        this.ctx.fx.dot(mote, 0.7, 0.35);
      });
    }
  }

  private newMark(): THREE.Sprite {
    const mat = new THREE.SpriteMaterial({
      map: this.markTex,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
    });
    const m = new THREE.Sprite(mat);
    m.renderOrder = 6;
    m.visible = false;
    this.s.scene.add(m);
    return m;
  }
}

/* ─── 하위: 반응과 도움 ─────────────────────────── */

// 눌렸을 때의 반응(1초): 토끼 깜짝 폴짝 달아났다 돌아봄 · 버섯 납작 · 열쇠 빙글(찰칵) · 병정 셋 차렷 · 컵케이크 부끄러워 주저앉음 ·
// 회중시계 빙글. 도움이 없는 생물(kind null)은 콩 한 번
class Reaction implements Hint {
  private t = 0;
  private readonly ground: number[];
  private readonly away = new THREE.Vector3();

  constructor(
    private readonly ctx: HintCtx,
    private readonly members: readonly Creature[],
    private readonly kind: HelpKind | null,
  ) {
    const { player, terrain } = ctx.s;
    for (const c of members) ctx.creatures.escort(c, false);
    this.ground = members.map((c) => c.a);
    const c = members[0];
    // 토끼는 나에게서 먼 쪽으로 달아난다
    this.away.copy(c.v).sub(player.p);
    const up = this.away.dot(c.v);
    this.away.addScaledVector(c.v, -up).normalize();
    const ground = terrain.groundAt(c.v);
    if (kind === "mushroom") ctx.fx.sonar(c.v, ground, 4, 0.5);
  }

  update(dt: number): boolean {
    this.t += dt;
    const span = this.t / REACT_SECONDS,
      u = Math.min(1, span),
      kind = this.kind;
    this.members.forEach((c, i) => {
      const quick = u * 2.5,
        hopU = Math.min(1, quick),
        arcPhase = hopU * Math.PI,
        bump = Math.sin(arcPhase);
      if (kind === "key" || kind === "watch") {
        const turns = kind === "key" ? 2 : 1,
          angle = dt * turns * Math.PI * 2;
        c.f.applyAxisAngle(c.v, angle);
      } else if (kind === "cupcake") c.sink = 0.3 * u;
      else if (kind === "mushroom") c.sink = 0.4 * bump;
      else c.a = this.ground[i] + REACT_HOP * bump;
      const flee = (RABBIT_FLEE / 0.5) * dt;
      if (kind === "rabbit" && u < 0.5) moveAlong(c, this.away, flee);
      if (kind === "rabbit" && u >= 0.5) faceToward(c, this.ctx.s.player.p as THREE.Vector3);
    });
    if (u < 1) return true;
    this.stop();
    return false;
  }

  stop() {
    this.members.forEach((c, i) => {
      if (this.kind !== "cupcake") c.sink = 0;
      if (this.kind !== "key" && this.kind !== "watch") c.a = this.ground[i];
      // 토끼·컵케이크는 이어서 도움을 주며 맡긴 채로 둔다
      if (this.kind !== "rabbit" && this.kind !== "cupcake") this.ctx.creatures.dismiss(c);
    });
  }
}

// 토끼(길): "늦었다 늦었어!" — 가장 가까운 숨은 상자 쪽으로 뛰며 빛나는 라임 발자국을 남긴다.
// 나와 너무 벌어지면 멈춰 뒤돌아보고, 상자 rabbit.stop(m) 앞에서 굴을 파고 쏙 사라진다
class RabbitTrail implements Hint {
  /** 굴로 사라지는 거리(상자 앞 m — rabbit.stop, 처음부터 가까우면 그 거리의 절반) */
  private readonly burrowAt: number;
  private walked = 0;
  private foot = 1;
  private isWaiting = false;
  private burrowT = -1;

  constructor(
    private readonly ctx: HintCtx,
    private readonly c: Creature,
    private readonly box: Seeker,
  ) {
    ctx.creatures.escort(c, true);
    ctx.overlay.bubble(HIDE.copy.rabbitLate, (out) => overCreature(c, out), 1.8);
    const start = c.v.angleTo(box.box.v) * S.R,
      half = start * 0.5;
    this.burrowAt = Math.min(HIDE.rabbit.stop, half);
  }

  update(dt: number): boolean {
    const c = this.c,
      { player, terrain } = this.ctx.s,
      R = HIDE.rabbit;
    if (this.burrowT >= 0) {
      this.burrowT += dt;
      const dug = this.burrowT / BURROW;
      const sunk = dug * 1.5;
      c.sink = Math.min(1.5, sunk);
      if (dug < 1) return true;
      this.hide();
      return false;
    }
    const toBox = c.v.angleTo(this.box.box.v) * S.R;
    if (toBox <= this.burrowAt || this.box.state !== "hidden") {
      this.burrowT = 0;
      c.isRunning = false;
      return true;
    }
    const gap = c.v.angleTo(player.p) * S.R;
    if (gap > R.waitGap) this.isWaiting = true;
    else if (gap < R.waitGap * RABBIT_RESUME) this.isWaiting = false;
    c.isRunning = !this.isWaiting;
    if (this.isWaiting) {
      faceToward(c, player.p as THREE.Vector3);
      return true;
    }
    const step = RABBIT_SPEED * dt;
    moveToward(c, this.box.box.v, RABBIT_SPEED, dt);
    c.a = terrain.groundAt(c.v);
    this.walked += step;
    if (this.walked >= PRINT_EVERY) this.print();
    return true;
  }

  stop() {
    if (this.burrowT < 0) this.ctx.creatures.dismiss(this.c);
    else this.hide();
  }

  // 발자국 하나: 좌우를 번갈아, 땅 위에 빛나는 라임 점
  private print() {
    const c = this.c,
      terrain = this.ctx.s.terrain;
    this.walked = 0;
    this.foot = -this.foot;
    side.crossVectors(c.v, c.f).normalize();
    const sideArc = (PRINT_SIDE * this.foot) / S.R;
    at.copy(c.v).addScaledVector(side, sideArc).normalize();
    const ground = terrain.groundAt(at),
      lift = S.R + ground + 0.08;
    at.multiplyScalar(lift);
    this.ctx.fx.dot(at, PRINT_SIZE, HIDE.rabbit.trailSeconds);
  }

  // 굴로 쏙 — 이 판에서는 다시 안 나온다(판이 시작할 때 돌아온다)
  private hide() {
    const c = this.c;
    c.want = 0;
    c.sink = 0;
    this.ctx.creatures.dismiss(c);
  }
}

// 버섯(높이): 높이 mushroom.height 까지 튕겨 올라 mushroom.hang 초 동안 천천히 내려온다. 그동안 카메라가 아래를 내려다본다(조작은 방향만)
class MushroomHang implements Hint {
  private t = 0;

  constructor(
    private readonly ctx: HintCtx,
    private readonly focus: CameraFocus,
  ) {
    const total = MUSHROOM_RISE + HIDE.mushroom.hang;
    focus.down(total);
    ctx.s.player.hop(4);
  }

  // 상자를 눌러 뛰어가거나 전설에 실리면 떠 있기를 그친다(카메라도 돌려준다)
  private isTaken(): boolean {
    return this.ctx.s.player.isHeld;
  }

  update(dt: number): boolean {
    this.t += dt;
    const M = HIDE.mushroom,
      player = this.ctx.s.player;
    if (this.isTaken()) {
      this.focus.drop();
      return false;
    }
    if (this.t < MUSHROOM_RISE) {
      const k = ease(3.5, dt);
      player.glide(M.height, k);
      return true;
    }
    const u = (this.t - MUSHROOM_RISE) / M.hang;
    if (u >= 1) return false;
    const low = 1 - (1 - MUSHROOM_LOW) * u,
      target = M.height * low,
      k = ease(4, dt);
    player.glide(target, k);
    return true;
  }

  stop() {}
}

// 열쇠(투시): 내 둘레 key.reach 안의 가리는 물건이 key.seconds 동안 유리처럼 비친다
class KeyXray implements Hint {
  private t = 0;

  constructor(private readonly ctx: HintCtx) {}

  update(dt: number): boolean {
    this.t += dt;
    const K = HIDE.key;
    if (this.t >= K.seconds) {
      this.stop();
      return false;
    }
    this.ctx.round.xray(this.ctx.s.player.P as THREE.Vector3, K.reach, K.alpha);
    return true;
  }

  stop() {
    this.ctx.round.xray(this.ctx.s.player.P as THREE.Vector3, 0, 1);
  }
}

// 카드 병정(점호): 맨 앞 병정이 "번호!" — 숨은 상자 전부가 반사적으로 귀를 번쩍 들고 차례로 "하나!" "둘!" …
// (말풍선은 그 상자 위에, 화면 밖이면 그쪽 가장자리에). 대답하고 나서 아차 하며 귀를 접는다
class RollCall implements Hint {
  private t = 0;

  constructor(
    private readonly ctx: HintCtx,
    front: Creature,
  ) {
    const { overlay, round, timeline, s } = ctx,
      L = HIDE.soldier,
      p = s.player.p;
    overlay.bubble(HIDE.copy.rollCall, (out) => overCreature(front, out), 1.2);
    // 가까운 상자부터 대답한다
    const boxes = round.hidden().sort((a, b) => {
      const da = a.box.v.angleTo(p),
        db = b.box.v.angleTo(p);
      return da - db;
    });
    boxes.forEach((k, i) => {
      const callAt = 0.5 + i * L.gap,
        text = HIDE.copy.counts[i] ?? HIDE.copy.counts[0];
      timeline.after(callAt, () => {
        if (!round.isSeeking() || k.state !== "hidden") return;
        k.box.startle();
        overlay.bubble(text, (out) => overBox(k, out), 1.4);
        s.events.emit("hideBoxAnswered", {});
      });
    });
    timeline.after(L.seconds - 0.5, () => {
      if (!round.isSeeking()) return;
      for (const k of boxes) if (k.state === "hidden") k.box.coverEyes(true);
    });
    timeline.after(L.seconds, () => {
      for (const k of boxes) if (k.state === "hidden") k.box.coverEyes(false);
    });
  }

  update(dt: number): boolean {
    this.t += dt;
    return this.t < HIDE.soldier.seconds;
  }

  stop() {}
}

// 컵케이크(미끼): 그 자리에 앉아 달콤한 냄새(분홍 김)를 풍긴다. 가장 가까운 숨은 상자가 내가 안 볼 때만 살금살금 다가온다
class CupcakeLure implements Hint {
  private t = 0;
  private steamT = 0;

  constructor(
    private readonly ctx: HintCtx,
    private readonly c: Creature,
  ) {
    ctx.creatures.escort(c, false);
    const lurable = ctx.round.lurable(),
      near = nearestTo(lurable, c.v),
      far = near ? near.box.v.angleTo(c.v) * S.R : Infinity;
    if (near && far <= HIDE.cupcake.reach) ctx.round.lure(near, c.v);
  }

  update(dt: number): boolean {
    this.t += dt;
    if (this.t >= HIDE.cupcake.seconds) {
      this.stop();
      return false;
    }
    this.steamT -= dt;
    if (this.steamT > 0) return true;
    this.steamT = STEAM_EVERY;
    const c = this.c,
      rise = 0.6 + (this.t % 1) * 2.2,
      up = c.batch.hh + rise;
    at.copy(c.pos).addScaledVector(c.v, up);
    this.ctx.fx.dot(at, STEAM_SIZE, STEAM_LIFE, STEAM_COLOR);
    return true;
  }

  stop() {
    this.ctx.round.lure(null, null);
    this.c.sink = 0;
    this.ctx.creatures.dismiss(this.c);
  }
}

/* ─── 내부 ─────────────────────────── */

// 말풍선 자리: 생물 머리 위
function overCreature(c: Creature, out: THREE.Vector3) {
  const lift = c.batch.hh + BUBBLE_OVER;
  out.copy(c.pos).addScaledVector(c.v, lift);
}

// 말풍선 자리: 상자 위
function overBox(k: Seeker, out: THREE.Vector3) {
  const lift = k.box.hh * k.box.size + BUBBLE_OVER;
  k.box.center(out).addScaledVector(k.box.v, lift);
}

// c 를 to(단위 벡터) 쪽으로 speed(m/s)로 옮기고 그쪽을 보게 한다
function moveToward(c: Creature, to: THREE.Vector3, speed: number, dt: number) {
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

// c 를 dir(접선) 쪽으로 meters 만큼 옮긴다
function moveAlong(c: Creature, dir: THREE.Vector3, meters: number) {
  turn.crossVectors(c.v, dir).normalize();
  const arc = meters / S.R;
  c.v.applyAxisAngle(turn, arc).normalize();
}

// c 가 to(단위 벡터) 쪽을 보게 한다
function faceToward(c: Creature, to: THREE.Vector3) {
  fwd.copy(to).sub(c.v);
  const up = fwd.dot(c.v);
  fwd.addScaledVector(c.v, -up);
  if (fwd.lengthSq() < 1e-12) return;
  fwd.normalize();
  c.f.copy(fwd);
}

// at 에서 가장 가까운 상자
function nearestTo(boxes: readonly Seeker[], at: THREE.Vector3): Seeker | null {
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

// 물방울 표시 그림: 라임 물방울에 먹색 테두리
function dropTexture(): THREE.CanvasTexture {
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
    g.fillStyle = HIDE.colors.lime;
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = HIDE.colors.ink;
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
