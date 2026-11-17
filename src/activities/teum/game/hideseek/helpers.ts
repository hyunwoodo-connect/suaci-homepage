import * as THREE from "three";

import { ease } from "../core/frame";
import type { Creature } from "../creatures/creature";
import { GUEST_ROW_GAP } from "../creatures/creatures";
import type { Services } from "../services";
import { S } from "../settings";
import type { HideFx } from "./effects";
import type { CameraFocus } from "./focus";
import type { Hint, HintCtx, HelpCreatures, HelpRound } from "./hints";
import {
  aheadOf,
  CupcakeHint,
  faceToward,
  KeyHint,
  moveToward,
  MushroomHint,
  nearestTo,
  noticePose,
  RabbitHint,
  Shiver,
  SoldierHint,
  WatchHint,
  WaveHello,
} from "./hints";
import { Leap } from "./leap";
import type { HideOverlay } from "./overlay";
import { Pawprints } from "./pawprints";
import type { PickTarget } from "./picker";
import { FootRing } from "./rings";
import { startPoint, sphereAt } from "./spots";
import type { Timeline } from "./timeline";
import type { GuestGroup, HelpKind } from "./tuning";
import { HIDE } from "./tuning";

export type { HelpCreatures, HelpRound } from "./hints";

// 생물과의 만남 — 모든 생물이 같은 다섯 단계를 거친다. 단계마다 보이는 것 하나가 바뀐다(글자·기호는 없다):
//   ① 멀리(markReach 밖) — 제 할 일을 한다. 표시 없음
//   ② 알아볼 때(markReach 안이고 화면 안) — 발밑에 얇은 라임 고리가 켜지고, 생물이 하던 일을 멈추고 나를 보며 종마다의 '아는 척'을 되풀이한다.
//      고리는 가장 가까운 ringMax 마리까지(화면이 고리로 덮이지 않게)
//   ③ 누를 때 — 생물 몸과 고리 안쪽 전부를 넉넉히 받는다. 고리가 조여들며 팟(라임 반짝 여섯), 미스트가 날아가고(0.25초),
//      생물이 부르르 떨고 한 번 반짝(0.25~0.55초). 조작은 0.5초만 잠긴다
//   ④ 카메라 — 0.25초부터 생물을 화면 가운데로 잡고(화각을 좁혀 생물이 화면 높이의 18% 넘게), 힌트에 방향이 있으면 15도 더 그쪽으로.
//      힌트가 시작되고 focusSeconds 뒤 돌아온다(끌면 바로)
//   ⑤ 끝난 뒤 — 고리가 다시 켜지지 않는다. 가까이 가면 손을 흔들어 인사만 하고, 3초마다 몸에 작은 라임 반짝이(미스트 맞은 표시)
// 종마다의 몸짓과 힌트는 hints. 버섯은 누르거나 걸어 들어가면 된다. 회중시계는 판 시작 watch.minElapsed 뒤부터 고리가 켜진다.
// 오래 못 찾으면 가장 가까운 쓸 수 있는 생물이 내 화면 안으로 와서 고리를 1.5배 밝게 뛴다(누르는 것은 내 몫).
// 첫 판에 첫 상자를 찾으면 토끼가 내 앞으로 와서 누를 때까지 나를 따라다닌다(손가락이 그 위에서 톡톡 — helpers 는 자리만 알려 준다).
// 손님 무리는 판마다 seats 를 섞어 앉힌다(첫 판에는 토끼가 시작 자리에서 가장 가까운 자리)

/** 누르면 날아가는 미스트 알갱이 수 · 공통 연출: 부르르(초) · 힌트 시작(초) · 터지는 반짝이 수 */
const MIST_DOTS = 5,
  SHIVER_AT = 0.25,
  HINT_AT = 0.65,
  SPARKS = 6;
/** 부르러 오기: 빠르기(m/s)·옆 거리(m)·와서 기다리는 시간(초) · 처음 배우기의 토끼가 뛰어오는 빠르기(m/s) */
const CALL_SPEED = 11,
  CALL_SIDE = 3,
  CALL_WAIT = 12,
  TEACH_SPEED = 10;
/** 다 쓴 생물: 반짝이 간격(초) · 인사하는 거리(m)·다시 인사하려면 멀어질 거리(m) */
const SPARKLE_EVERY = 3,
  HELLO_REACH = 8,
  HELLO_AGAIN = 14;
/** 화면 안으로 치는 범위(화면 좌표) */
const SEEN_EDGE = 0.92;

const tmp = new THREE.Vector3(),
  at = new THREE.Vector3(),
  side = new THREE.Vector3();

/** 손님 한 무리 */
interface Group {
  spec: GuestGroup;
  members: Creature[];
  /** 고리를 다는 생물(줄이면 가운데) */
  lead: Creature | null;
  ring: FootRing | null;
  /** 아는 척 중(고리가 켜져 있다)·한 지(초)·시작할 때의 자리 */
  isNoticing: boolean;
  noticeT: number;
  base: { a: number; v: THREE.Vector3 }[];
  /** 도움을 주는 중(누른 뒤 힌트가 끝날 때까지) · 누른 뒤 힌트가 아직 시작되지 않았다(그 사이에도 바쁘다) */
  isBusy: boolean;
  isPending: boolean;
  /** 다 쓴 생물: 다음 반짝이까지(초) · 인사했나 */
  sparkleT: number;
  hasWaved: boolean;
}

/** 생물 도움 */
export class CreatureHelp {
  private readonly groups: Group[];
  private readonly used = new Set<HelpKind>();
  private readonly hints: { hint: Hint; group: Group | null }[] = [];
  private readonly ctx: HintCtx;
  /** 오래 못 찾아 부르러 온 무리 · 와서 기다릴 자리 · 남은 시간(초) */
  private caller: Group | null = null;
  private readonly callAt = new THREE.Vector3();
  private callLeft = 0;
  /** 처음 배우기: 나를 따라다니는 토끼 무리(누르면 끝) · 이 판에서 이미 했나 */
  private teacher: Group | null = null;
  private hasTaught = false;
  /** 버섯으로 떠 있는 중(멀리 보이는 상자도 눌러 찾는다) */
  private hang: MushroomHint | null = null;
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
    const prints = new Pawprints(s.scene),
      leap = new Leap(s);
    this.ctx = { s, creatures, round, fx, overlay, timeline, focus, prints, leap };
    this.groups = HIDE.guests.map((spec) => {
      const members = creatures.invite(spec.species, spec.count);
      const half = members.length / 2,
        leadAt = Math.floor(half),
        lead = members[leadAt] ?? null,
        ring = spec.help ? new FootRing(s.scene) : null;
      return {
        spec,
        members,
        lead,
        ring,
        isNoticing: false,
        noticeT: 0,
        base: members.map((c) => ({ a: c.a, v: c.v.clone() })),
        isBusy: false,
        isPending: false,
        sparkleT: 0,
        hasWaved: false,
      };
    });
  }

  /** 지금 상자를 눌러 찾을 수 있는 거리(m) — 버섯 꼭대기에 떠 있는 동안은 더 멀리 */
  get tapReach(): number {
    return this.hang?.isHigh ? HIDE.mushroom.tapReach : HIDE.find.tapReach;
  }

  /** 판 시작(눈을 감은 동안): 하던 도움을 거두고, 손님 무리를 섞은 자리에 앉힌다. 첫 판이면 토끼를 시작 자리 곁에 */
  reset(hub: THREE.Vector3, first: boolean) {
    this.stop();
    this.used.clear();
    this.hasTaught = !first;
    this.ctx.prints.clear();
    const order = this.seatOrder(first);
    this.groups.forEach((g, i) => {
      const seat = HIDE.seats[order[i]];
      sphereAt(at, hub, seat.x, seat.y);
      const { orbit, alt, row } = g.spec;
      this.ctx.creatures.seat(g.members, at, orbit, alt, row);
      g.hasWaved = false;
      g.sparkleT = this.rand() * SPARKLE_EVERY;
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

  /** 누를 수 있는 생물(고리가 켜진 무리): 몸 하나하나와 고리 안쪽을 targets 에 더한다 */
  targets(out: PickTarget<Creature>[]) {
    for (const g of this.groups) {
      const lead = g.lead;
      if (!lead || !g.ring?.on) continue;
      for (const c of g.members) {
        const hh = c.batch.hh,
          center = c.pos.clone().addScaledVector(c.v, hh);
        const halfW = Math.max(hh, c.batch.rw);
        out.push({ item: c, center, halfH: hh, halfW });
      }
      const ground = this.s.terrain.groundAt(lead.v),
        lift = S.R + ground,
        r = g.ring.size,
        center = lead.v.clone().multiplyScalar(lift);
      const flat = r * 0.6;
      out.push({ item: lead, center, halfH: flat, halfW: r });
    }
  }

  /** c 를 눌렀다(고리가 켜진 무리만 누를 수 있다). 쓴 도움 종류(못 쓰면 null) */
  use(c: Creature): HelpKind | null {
    const g = this.groups.find((x) => x.members.includes(c));
    const kind = g?.spec.help ?? null;
    if (!g || !kind || !g.ring?.on || g.isBusy || this.used.has(kind)) return null;
    this.begin(g, kind, false);
    return kind;
  }

  /** 오래 못 찾았다: 가장 가까운 쓸 수 있는 생물이 내 화면 안으로 온다. 부를 생물이 없으면 false */
  call(): boolean {
    if (this.caller || this.teacher || this.hints.some((h) => h.group?.isBusy)) return false;
    const p = this.s.player.p;
    let best: Group | null = null,
      bestD = Infinity;
    for (const g of this.groups) {
      const c = g.lead;
      if (!c || !this.isUsable(g)) continue;
      const d = c.v.angleTo(p);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    if (!best?.lead) return false;
    const { player } = this.s,
      h = player.h as THREE.Vector3;
    side.crossVectors(player.p, h).normalize();
    const aheadArc = HIDE.stuck.callAhead / S.R,
      sideArc = CALL_SIDE / S.R;
    this.callAt.copy(player.p).addScaledVector(h, aheadArc).addScaledVector(side, sideArc);
    this.callAt.normalize();
    this.ctx.creatures.escort(best.lead, true);
    best.isNoticing = false;
    this.caller = best;
    this.callLeft = CALL_WAIT;
    return true;
  }

  /** 처음 배우기(첫 판, 첫 상자를 찾은 직후): 토끼가 내 앞으로 뛰어와 누를 때까지 나를 따라다닌다. 못 하면 false */
  teach(): boolean {
    if (this.hasTaught) return false;
    this.hasTaught = true;
    const g = this.groups.find((x) => x.spec.help === "rabbit");
    if (!g?.lead || !this.isUsable(g) || g.isBusy) return false;
    if (this.caller === g) this.caller = null;
    this.ctx.creatures.escort(g.lead, true);
    g.isNoticing = false;
    this.teacher = g;
    return true;
  }

  /** 처음 배우기의 손가락이 가리킬 곳(토끼 몸) — 없으면 null */
  pointer(): ((out: THREE.Vector3) => void) | null {
    const c = this.teacher?.lead;
    if (!c || !this.teacher?.ring?.on) return null;
    return (out) => {
      const lift = c.batch.hh * 1.6;
      out.copy(c.pos).addScaledVector(c.v, lift);
    };
  }

  /** 한 프레임(찾는 중) */
  update(dt: number) {
    this.time += dt;
    this.walkInMushroom();
    this.moveCaller(dt);
    this.moveTeacher(dt);
    this.pickRings(dt);
    for (let i = this.hints.length - 1; i >= 0; i--) {
      const { hint, group } = this.hints[i];
      if (hint.update(dt)) continue;
      if (hint === this.hang) this.hang = null;
      this.hints.splice(i, 1);
      const isOtherBusy = this.hints.some((h) => h.group === group);
      if (group && !isOtherBusy && !group.isPending) group.isBusy = false;
    }
    for (const g of this.groups) this.after(g, dt);
    const camera = this.s.camera.camera;
    const prints = this.ctx.prints,
      { player } = this.s;
    const stomped = prints.update(dt, player.p as THREE.Vector3, player.air);
    if (stomped) this.s.events.emit("hidePrintStomped", {});
    for (const g of this.groups) g.ring?.update(dt, this.time, camera, innerHeight);
  }

  /** 찾기가 끝났다: 하던 도움을 거두고 생물을 돌려보낸다 */
  stop() {
    for (const h of this.hints) h.hint.stop();
    this.hints.length = 0;
    this.hang = null;
    this.caller = null;
    this.teacher = null;
    // 판 밖에서는 고리·발자국을 그리지 않는다(이 둘은 찾는 동안에만 돈다 — 켜진 채 남으면 그대로 굳는다)
    this.ctx.prints.clear();
    for (const g of this.groups) {
      g.ring?.hide();
      g.isNoticing = false;
      g.isBusy = false;
      g.isPending = false;
      for (const c of g.members) this.ctx.creatures.dismiss(c);
    }
    this.focus.drop();
  }

  dispose() {
    for (const g of this.groups) g.ring?.dispose();
    this.ctx.prints.dispose();
  }

  /* ─── 내부: 고리와 아는 척 ─────────────────────────── */

  // 쓸 수 있는 무리인가(이 판에 아직 안 썼고, 떠나지 않았고, 시계는 판 시작 뒤 minElapsed 가 지났다)
  private isUsable(g: Group): boolean {
    const kind = g.spec.help,
      c = g.lead;
    if (!kind || !c || this.used.has(kind) || c.gone || c.vis < 0.5) return false;
    if (kind === "watch" && this.ctx.round.roundT() < HIDE.watch.minElapsed) return false;
    return true;
  }

  // 고리를 켤 무리: 쓸 수 있고 markReach 안이고 화면 안인 것 가운데 가까운 ringMax 마리(부르러 온 생물·처음 배우기 토끼는 늘)
  private pickRings(dt: number) {
    const { player } = this.s,
      H = HIDE.help;
    const picks: { g: Group; d: number }[] = [];
    for (const g of this.groups) {
      const c = g.lead;
      if (!c || !g.ring || g.isBusy || !this.isUsable(g)) continue;
      const isForced = g === this.caller || g === this.teacher,
        isArrived = isForced && c.st === "guide" && !c.isRunning,
        d = c.v.angleTo(player.p) * S.R;
      if (isForced && !isArrived) continue;
      if (!isForced && (d > H.markReach || !this.isOnScreen(c))) continue;
      const rank = isForced ? -1 : d;
      picks.push({ g, d: rank });
    }
    picks.sort((a, b) => a.d - b.d);
    const chosen = new Set(picks.slice(0, H.ringMax).map((x) => x.g));
    for (const g of this.groups) {
      const ring = g.ring,
        lead = g.lead;
      if (!ring || !lead) continue;
      const isOn = chosen.has(g);
      if (isOn && !ring.on) this.s.events.emit("hideRingOn", {});
      if (!g.isBusy) ring.set(isOn);
      const bright = g === this.caller ? HIDE.stuck.callBright : 1;
      ring.setBright(bright);
      const ground = this.s.terrain.groundAt(lead.v),
        r = lead.batch.rw * H.ringScale;
      ring.place(lead.v, ground, r);
      this.notice(g, isOn, dt);
    }
  }

  // 아는 척: 고리가 켜지면 하던 일을 멈추고 나를 보며 종마다의 몸짓. 꺼지면 제 할 일로(부르러 온·처음 배우기 생물은 그대로 기다린다)
  private notice(g: Group, isOn: boolean, dt: number) {
    const kind = g.spec.help;
    if (!kind || g.isBusy) return;
    const isHeldHere = g === this.caller || g === this.teacher;
    if (isOn && !g.isNoticing) {
      g.isNoticing = true;
      g.noticeT = 0;
      g.members.forEach((c, i) => {
        this.ctx.creatures.escort(c, false);
        g.base[i].a = c.a;
        g.base[i].v.copy(c.v);
      });
    } else if (!isOn && g.isNoticing) {
      g.isNoticing = false;
      for (const c of g.members) {
        c.hop = c.sink = c.pitch = c.roll = 0;
        if (!isHeldHere) this.ctx.creatures.dismiss(c);
      }
    }
    if (!g.isNoticing) return;
    g.noticeT += dt;
    const boxes = this.ctx.round.hidden(),
      lead = g.lead,
      near = lead ? nearestTo(boxes, lead.v) : null,
      boxAt = near ? near.box.v : null;
    noticePose(kind, g.members, g.base, g.noticeT, this.ctx, boxAt);
  }

  // 다 쓴 무리: 3초마다 작은 라임 반짝이, 가까이 가면 손을 흔들어 인사
  private after(g: Group, dt: number) {
    const kind = g.spec.help,
      c = g.lead;
    const isAway = c?.want === 0;
    if (!kind || !c || !this.used.has(kind) || g.isBusy || c.gone || !c.visible || isAway) return;
    g.sparkleT -= dt;
    if (g.sparkleT <= 0) {
      g.sparkleT = SPARKLE_EVERY;
      const lift = c.batch.hh * 1.7;
      at.copy(c.pos).addScaledVector(c.v, lift);
      this.ctx.fx.dot(at, 0.45, 0.6);
    }
    const d = c.v.angleTo(this.s.player.p) * S.R;
    if (d > HELLO_AGAIN) g.hasWaved = false;
    if (g.hasWaved || d > HELLO_REACH || !this.isOnScreen(c)) return;
    g.hasWaved = true;
    g.isBusy = true;
    const hello = new WaveHello(this.ctx, c);
    this.hints.push({ hint: hello, group: g });
  }

  /* ─── 내부: 누르기 ─────────────────────────── */

  // 도움을 시작한다: 고리가 터지고 미스트 → 부르르·반짝 → 카메라 → 힌트(0.65초부터)
  private begin(g: Group, kind: HelpKind, walkedIn: boolean) {
    const { round, timeline, s } = this.ctx,
      H = HIDE.help,
      lead = g.lead ?? g.members[0];
    this.used.add(kind);
    g.isBusy = true;
    g.isPending = true;
    g.isNoticing = false;
    if (this.caller === g) this.caller = null;
    if (this.teacher === g) this.teacher = null;
    for (const c of g.members) {
      this.ctx.creatures.escort(c, false);
      c.hop = c.sink = c.pitch = c.roll = 0;
    }
    this.burstRing(g);
    s.events.emit("hideCreatureTapped", { kind });
    if (!walkedIn) {
      this.mist(lead);
      round.hold(true);
      timeline.after(H.lockSeconds, () => round.hold(false));
    }
    // 버섯은 아바타가 올라타고(카메라는 꼭대기에서 내려다본다), 나머지는 부르르 떤 뒤 힌트
    if (kind === "mushroom") {
      const delay = walkedIn ? 0 : SHIVER_AT;
      timeline.after(delay, () => {
        g.isPending = false;
        if (!round.isSeeking()) return;
        this.hang = new MushroomHint(this.ctx, lead, walkedIn);
        this.hints.push({ hint: this.hang, group: g });
      });
      return;
    }
    timeline.after(SHIVER_AT, () => {
      if (!round.isSeeking()) return;
      const shiver = new Shiver(this.ctx, g.members);
      this.hints.push({ hint: shiver, group: g });
    });
    timeline.after(HINT_AT, () => {
      g.isPending = false;
      if (!round.isSeeking()) return;
      const hint = this.hintFor(kind, g, lead);
      if (!hint) {
        g.isBusy = false;
        for (const c of g.members) this.ctx.creatures.dismiss(c);
        return;
      }
      this.hints.push({ hint, group: g });
      const height = lead.batch.hh * 2,
        where = (out: THREE.Vector3) => {
          const lift = lead.batch.hh;
          out.copy(lead.pos).addScaledVector(lead.v, lift);
        };
      this.focus.look({ where, height, hint: (out) => hint.aim(out) }, H.focusSeconds);
    });
    // 카메라는 부르르와 같이(0.25초) 돌기 시작한다 — 힌트가 오기 전에는 방향 없이
    timeline.after(SHIVER_AT, () => {
      if (!round.isSeeking()) return;
      const height = lead.batch.hh * 2,
        where = (out: THREE.Vector3) => {
          const lift = lead.batch.hh;
          out.copy(lead.pos).addScaledVector(lead.v, lift);
        };
      this.focus.look({ where, height, hint: null }, HINT_AT);
    });
  }

  private hintFor(kind: HelpKind, g: Group, lead: Creature): Hint | null {
    const ctx = this.ctx;
    if (kind === "rabbit") {
      const hidden = ctx.round.hidden(),
        box = nearestTo(hidden, lead.v);
      return box ? new RabbitHint(ctx, lead, box) : null;
    }
    if (kind === "key") return new KeyHint(ctx, lead);
    if (kind === "soldier") return new SoldierHint(ctx, g.members);
    if (kind === "cupcake") return new CupcakeHint(ctx, lead);
    if (kind === "watch") return new WatchHint(ctx, lead);
    return null;
  }

  // 고리가 안으로 조여들며 팟: 라임 반짝 여섯
  private burstRing(g: Group) {
    const lead = g.lead,
      ring = g.ring;
    if (!lead || !ring) return;
    ring.implode();
    const ground = this.s.terrain.groundAt(lead.v),
      r = ring.size * 0.6;
    side.set(0, 0, 0);
    tmp.copy(lead.f);
    for (let i = 0; i < SPARKS; i++) {
      const angle = (i / SPARKS) * Math.PI * 2;
      side.crossVectors(lead.v, tmp).normalize();
      const cos = Math.cos(angle) * r,
        sin = Math.sin(angle) * r,
        lift = S.R + ground + 0.5;
      at.copy(lead.v).multiplyScalar(lift).addScaledVector(tmp, cos).addScaledVector(side, sin);
      this.ctx.fx.dot(at, 0.4, 0.45);
    }
  }

  // 미스트가 내 자리에서 생물로 날아간다(0.25초)
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

  // 버섯: 누르지 않고 걸어 들어와도(수평 walkReach 안, 땅 가까이) 튕겨 준다
  private walkInMushroom() {
    const g = this.groups.find((x) => x.spec.help === "mushroom");
    const c = g?.lead,
      { player } = this.s;
    if (!g || !c || g.isBusy || !this.isUsable(g) || player.isHeld) return;
    const d = c.v.angleTo(player.p) * S.R;
    if (d > HIDE.mushroom.walkReach || player.air > 1.5) return;
    this.begin(g, "mushroom", true);
  }

  // 부르러 오는 생물: 내 앞까지 와서 고리를 밝게 뛰며 기다린다. 오래 안 누르면 돌아간다
  private moveCaller(dt: number) {
    const g = this.caller,
      c = g?.lead;
    if (!g || !c) return;
    this.callLeft -= dt;
    if (this.callLeft <= 0 || g.isBusy) {
      // 아는 척하는 중이면 고리가 꺼질 때 notice 가 돌려보낸다(여기서 보내면 아는 척이 자리를 붙잡아 제자리걸음)
      if (!g.isBusy && !g.isNoticing) this.ctx.creatures.dismiss(c);
      this.caller = null;
      return;
    }
    if (g.isNoticing) return;
    const left = c.v.angleTo(this.callAt) * S.R;
    c.isRunning = left > 0.3;
    if (c.isRunning) moveToward(c, this.callAt, CALL_SPEED, dt);
    else faceToward(c, this.s.player.p as THREE.Vector3);
    this.settle(c, dt);
  }

  // 처음 배우기 토끼: 내 앞 teach.creatureAhead 로 뛰어와 서고, 누를 때까지 나와 teach.creatureKeep 안을 지킨다
  private moveTeacher(dt: number) {
    const g = this.teacher,
      c = g?.lead;
    if (!g || !c) return;
    const T = HIDE.teach,
      gap = c.v.angleTo(this.s.player.p) * S.R,
      isFar = gap > T.creatureKeep || !this.isOnScreen(c);
    if (g.isNoticing && !isFar) return;
    if (g.isNoticing) {
      g.isNoticing = false;
      this.ctx.creatures.escort(c, true);
    }
    aheadOf(this.s, T.creatureAhead, at);
    const left = c.v.angleTo(at) * S.R;
    c.isRunning = left > 0.3;
    if (c.isRunning) moveToward(c, at, TEACH_SPEED, dt);
    else faceToward(c, this.s.player.p as THREE.Vector3);
    this.settle(c, dt);
  }

  // 옮겨 다니는 생물의 높이: 땅 위(하늘 생물은 3m 위)
  private settle(c: Creature, dt: number) {
    const ground = this.s.terrain.groundAt(c.v),
      sky = c.role === "flock" ? ground + 3 : ground,
      k = ease(6, dt);
    c.a += (sky - c.a) * k;
  }

  // 화면 안인가(몸 가운데)
  private isOnScreen(c: Creature): boolean {
    const lift = c.batch.hh;
    at.copy(c.pos).addScaledVector(c.v, lift).project(this.s.camera.camera);
    return at.z < 1 && Math.abs(at.x) < SEEN_EDGE && Math.abs(at.y) < SEEN_EDGE;
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
    const pos = order.indexOf(near);
    [order[rabbit], order[pos]] = [order[pos], order[rabbit]];
    return order;
  }
}
