import * as THREE from "three";

import type { Creature } from "../creatures/creature";
import { ease } from "../core/frame";
import type { HeldBody, Holder } from "../player/player";
import type { Services } from "../services";
import { S } from "../settings";
import { sphereAt } from "./spots";
import { HIDE } from "./tuning";

// 생물이 데려다준다. 판 중에 생물에 닿으면 그 생물이 "상자 봤어! 따라와!" 하고 나를 붙잡아 가장 가까운 숨은 상자 앞(guide.stop m)까지 데려간다.
// 땅 위 생물은 앞장서 뛰고 나는 끌려가고, 하늘 생물은 나를 들어 올려 날아간다. 한 번 데려다준 생물은 그 판에 다시 데려다주지 않는다.
// 오래 못 찾으면 가까운 생물 하나가 나를 찾아온다(come) — 닿으면 똑같이 데려다준다.
// 광장에는 원래 사는 생물이 거의 없어, 판마다 무대에 손님 무리(hideseek.data.json 의 guests)를 불러 앉힌다.
// 데려가는 동안 나는 이 길잡이에게 붙잡혀 있다(놀이기구와 같은 붙잡기) — 자리는 여기서 정하고, 조작을 막는 것은 숨바꼭질이 한다

/** 길잡이가 생물에게 부탁하는 것(Creatures) */
export interface GuideCreatures {
  invite(species: string, count: number): Creature[];
  seat(
    group: readonly Creature[],
    at: THREE.Vector3,
    orbit: number | null,
    alt: number | null,
    row: boolean,
  ): void;
  touching(reach: number, band: number, skip: ReadonlySet<Creature>): Creature | null;
  escort(c: Creature): void;
  dismiss(c: Creature): void;
}

/** 이번 프레임에 일어난 일: 나를 찾아오던 생물이 닿았다 · 상자 앞에 다 왔다 */
export type GuideEvent = "reached" | "arrived";

/** 지금 하는 일: 없음 · 나를 찾아오는 중 · 데려가는 중 */
type Step = "idle" | "coming" | "leading";

/** 갈 길이 이보다 짧으면(m — 상자가 바로 앞) 데려가지 않고 그쪽으로 돌려세우기만 한다(초) */
const SHORT_TRIP = 1,
  TURN_SECONDS = 0.8;
/** 찾아오는 생물: 멀수록 서두르는 정도(거리 1m 마다 m/s) · 이만큼(초) 못 닿으면 그만두고 돌아간다 */
const COME_HURRY = 0.8,
  COME_GIVE_UP = 12;
/** 하늘 생물: 나를 들어 올리고 내려놓는 데 쓰는 길의 몫 · 내 머리 위로 떠 있는 높이(m) · 찾아올 때 나는 높이(땅에서 m) */
const LIFT_SHARE = 0.2,
  OVERHEAD = 0.9,
  COME_ALT = 3;

/**
 * 숨은 상자까지 dist(m) 떨어진 데서 데려갈 때 걸리는 시간(초): 상자 앞 guide.stop 까지의 길을 guide.speed 로 가되
 * guide.minSeconds~maxSeconds 안에 맞춘다. 갈 길이 거의 없으면(상자가 바로 앞) 그쪽으로 돌려세우는 시간만
 */
export function tripSeconds(dist: number): number {
  const G = HIDE.guide,
    travel = dist - G.stop;
  if (travel < SHORT_TRIP) return TURN_SECONDS;
  const pace = travel / G.speed,
    capped = Math.min(G.maxSeconds, pace);
  return Math.max(G.minSeconds, capped);
}

const seatAt = new THREE.Vector3(),
  spot = new THREE.Vector3(),
  ahead = new THREE.Vector3(),
  fwd = new THREE.Vector3(),
  turn = new THREE.Vector3();

/** 길잡이 생물과 판의 손님 */
export class Guide implements Holder {
  readonly rideName = "guide";
  /** 데려가는 동안은 내 높이를 길잡이가 정한다 */
  readonly freezesGravity = true;
  private readonly groups: Creature[][];
  /** 이 판에 이미 데려다준 생물 */
  private readonly used = new Set<Creature>();
  private step: Step = "idle";
  private who: Creature | null = null;
  private t = 0;
  private seconds = 0;
  /** 나를 찾아오기 시작한 뒤 흐른 시간(초) */
  private comeT = 0;
  /** 데려가는 길: 떠난 자리·도는 축·다 갔을 때의 각(rad) */
  private readonly from = new THREE.Vector3();
  private readonly axis = new THREE.Vector3();
  private angle = 0;

  /** hub: 무대 마을 중심(손님을 처음부터 제자리에 앉혀 둔다) */
  constructor(
    private readonly s: Services,
    private readonly creatures: GuideCreatures,
    hub: THREE.Vector3,
  ) {
    this.groups = HIDE.guests.map((g) => creatures.invite(g.species, g.count));
    this.reset(hub);
  }

  /** 지금 나를 데려가는 중인가(그동안 조작은 멈춘다) */
  get isLeading(): boolean {
    return this.step === "leading";
  }

  /** 지금 길잡이가 나를 찾아오거나 데려가는 중인가 */
  get isBusy(): boolean {
    return this.step !== "idle";
  }

  /** 판 시작: 하던 일을 그치고, 손님 무리를 제자리(무대 마을 hub 기준)에 앉히고, 데려다준 기록을 비운다 */
  reset(hub: THREE.Vector3) {
    this.stop();
    this.used.clear();
    HIDE.guests.forEach((g, i) => {
      sphereAt(seatAt, hub, g.x, g.y);
      this.creatures.seat(this.groups[i], seatAt, g.orbit, g.alt, g.row);
    });
  }

  /**
   * 지금 닿은, 아직 데려다주지 않은 생물(없거나, 내가 무엇에 실려 있거나, 이미 데려가는 중이면 null).
   * 다른 생물이 나를 찾아오는 중이어도 닿은 생물이 먼저다
   */
  touching(): Creature | null {
    if (this.step === "leading" || this.s.player.isHeld) return null;
    return this.creatures.touching(HIDE.guide.reach, HIDE.guide.band, this.used);
  }

  /** 가장 가까운(아직 데려다주지 않은) 손님 하나가 나를 찾아온다(부를 손님이 없으면 아무 일도 없다) */
  come() {
    if (this.step !== "idle") return;
    const p = this.s.player.p;
    let best: Creature | null = null,
      bestD = Infinity;
    for (const c of this.groups.flat()) {
      if (this.used.has(c) || c.st === "follow" || c.gone) continue;
      const d = c.v.angleTo(p);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (!best) return;
    this.creatures.escort(best);
    this.who = best;
    this.comeT = 0;
    this.step = "coming";
  }

  /** c 가 나를 붙잡아 toward(숨은 상자의 자리) 앞 guide.stop(m)까지 데려간다. 거리에 맞춰 3~5초에 닿게 간다 */
  lead(c: Creature, toward: THREE.Vector3) {
    const { player } = this.s,
      G = HIDE.guide;
    // 나를 찾아오던 다른 생물은 돌려보낸다(닿은 생물이 데려간다)
    if (this.who && this.who !== c) this.creatures.dismiss(this.who);
    this.used.add(c);
    this.creatures.escort(c);
    this.who = c;
    this.from.copy(player.p);
    const dist = this.from.angleTo(toward) * S.R,
      over = dist - G.stop,
      travel = Math.max(0, over);
    this.axis.crossVectors(this.from, toward).normalize();
    this.angle = travel / S.R;
    this.seconds = tripSeconds(dist);
    this.t = 0;
    this.step = "leading";
    player.grab(this);
  }

  /** 한 프레임: 찾아오는 생물은 내 쪽으로 오고, 데려가는 생물은 길을 따라 나를 옮긴다. 일어난 일이 있으면 알려 준다 */
  update(dt: number): GuideEvent | null {
    if (this.step === "coming") return this.approach(dt);
    if (this.step === "leading") return this.carry(dt);
    return null;
  }

  /** 하던 일을 그친다(판이 넘어간다): 나를 놓고 생물을 돌려보낸다 */
  stop() {
    const c = this.who;
    this.s.player.release(this);
    if (c) this.creatures.dismiss(c);
    this.who = null;
    this.step = "idle";
  }

  /** 방금 나를 찾아와 닿은 생물(reached 를 알린 프레임에) */
  get comer(): Creature | null {
    return this.step === "coming" ? this.who : null;
  }

  /* ─── 내부 ─────────────────────────── */

  // 나를 찾아온다: 내 쪽으로 곧장, 멀수록 서둘러서(하늘 생물은 내 높이로 날아서). 닿을 거리와 높이에 오면 알린다.
  // 내가 놀이기구에 실려 있거나 너무 높이 떠 있으면 곁에서 기다리고, 끝내 못 닿으면 그만두고 돌아간다
  private approach(dt: number): GuideEvent | null {
    const c = this.who,
      { player, terrain } = this.s,
      G = HIDE.guide;
    if (!c) return null;
    this.comeT += dt;
    if (this.comeT > COME_GIVE_UP) {
      this.stop();
      return null;
    }
    const p = player.p as THREE.Vector3,
      d = c.v.angleTo(p) * S.R,
      above = c.a + c.batch.hh - player.alt,
      apart = Math.abs(above);
    if (d > G.reach) {
      const hurry = d * COME_HURRY,
        pace = Math.max(G.comeSpeed, hurry),
        reach = pace * dt,
        move = Math.min(d, reach),
        step = move / S.R;
      turn.crossVectors(c.v, p).normalize();
      fwd.crossVectors(turn, c.v).normalize();
      c.v.applyAxisAngle(turn, step).normalize();
      c.f.copy(fwd);
    }
    const ground = terrain.groundAt(c.v),
      low = ground + COME_ALT,
      flying = Math.max(low, player.alt),
      want = c.role === "flock" ? flying : ground,
      k = ease(6, dt);
    c.a += (want - c.a) * k;
    const isClose = d <= G.reach && apart <= G.band;
    return isClose && !player.isHeld ? "reached" : null;
  }

  // 데려간다: 길을 따라 나를 옮기고(땅 위 생물은 앞장서 뛰고, 하늘 생물은 내 머리 위에서 들어 올린다), 다 가면 놓아 준다
  private carry(dt: number): GuideEvent | null {
    const c = this.who,
      { player, terrain } = this.s,
      body = player.bodyFor(this);
    if (!c || !body) {
      this.stop();
      return "arrived";
    }
    this.t += dt;
    const raw = this.t / this.seconds,
      u = Math.min(1, raw),
      gone = u * u * (3 - 2 * u),
      arc = this.angle * gone;
    spot.copy(this.from).applyAxisAngle(this.axis, arc).normalize();
    fwd.crossVectors(this.axis, spot).normalize();
    const k = ease(8, dt);
    body.p.copy(spot);
    body.h.lerp(fwd, k).normalize();
    body.vel.copy(body.h);
    body.vy = 0;
    const isFlying = c.role === "flock";
    this.liftBody(body, isFlying, u, k);
    if (isFlying) {
      c.v.copy(spot);
      c.a = player.alt + OVERHEAD;
    } else {
      const leadArc = arc + HIDE.guide.lead / S.R;
      ahead.copy(this.from).applyAxisAngle(this.axis, leadArc).normalize();
      c.v.copy(ahead);
      c.a = terrain.groundAt(ahead);
    }
    c.f.copy(fwd);
    if (u < 1) return null;
    player.release(this, { boost: 0 });
    this.creatures.dismiss(c);
    this.who = null;
    this.step = "idle";
    return "arrived";
  }

  // 내 높이: 끌려갈 때는 땅에 붙고, 들려 갈 때는 길의 처음에 올라가 끝에 내려온다
  private liftBody(body: HeldBody, isFlying: boolean, u: number, k: number) {
    const rising = u / LIFT_SHARE,
      landing = (1 - u) / LIFT_SHARE,
      share = Math.min(1, rising, landing),
      want = isFlying ? 0.01 + HIDE.guide.lift * share : 0.01;
    body.air += (want - body.air) * k;
  }
}
