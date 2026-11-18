import * as THREE from "three";

import type { Creature } from "../creatures/creature";
import { S } from "../settings";
import { FIND } from "./findTuning";
import { STAGE } from "./openTuning";
import { sphereAt } from "./spots";
import type { GuestGroup, Seat } from "./tuning";
import { HIDE } from "./tuning";

// 구경꾼 — 판 영역에 사는 주민: 판에 부르는 생물 무리(hideseek.data.json 의 guests — 버섯은 mushrooms 가 따로 앉힌다).
// 구조물이 아니라 이웃이다: 저마다 하루를 살고(생물 쪽 creatures/town·days), 나를 알아보고 인사하고, 판에서 일어난 일에 반응한다.
// 고리도 이름표도 없고 눌러도 반응하지 않는다(리본이 없다). 여기는 누가 어디에 사는지와, 판에서 일어난 일을 주민에게 알리는 일만 한다.
// 사는 자리는 무리마다 정해져 있다(guests 의 home) — 판마다 섞지 않는다, 이웃은 늘 그 동네에 산다.
// 그 자리가 그 판의 리본 달린 물건에 막혔으면 가장 가까운 빈 seats 로 옮겨 앉는다(seats 는 후보 물건·버섯과 겹치지 않는 것만 쓴다)

/** 판에 부르는 생물을 다루는 창구(Creatures) */
export interface BystanderCreatures {
  /** 무리를 만든다(모델이 없는 종이면 빈 목록) */
  invite(species: string, count: number): Creature[];
  /** 무리를 at 둘레에 앉힌다(하늘 무리는 orbit 둘레·alt 높이에 뜬다, row 면 한 줄로) */
  seat(
    group: readonly Creature[],
    at: THREE.Vector3,
    orbit: number | null,
    alt: number | null,
    row: boolean,
  ): void;
  /** 숨바꼭질이 맡는다(자리와 몸짓을 숨바꼭질이 정한다) · 돌려보낸다 */
  escort(c: Creature, run?: boolean): void;
  dismiss(c: Creature): void;
  /** 올라선 것을 튕겨 낸 버섯: 갓이 한참 출렁인다 */
  wobble(c: Creature): void;
  /** 판 영역: 가운데·반경(m)과 리본 달린 물건 — 주민은 그 둘레 room(m) 안에 서지도 지나가지도 않는다 */
  setStage(hub: THREE.Vector3, radius: number, keepOff: readonly KeepOff[], room: number): void;
  /** 판에서 일어난 일을 주민에게 알린다(뜻은 아래 Bystanders 의 같은 이름) */
  turnAway(on: boolean): void;
  cheer(at: THREE.Vector3): void;
  puzzle(at: THREE.Vector3): void;
  watch(box: THREE.Vector3 | null): void;
  setHiding(spots: readonly THREE.Vector3[]): void;
  gather(at: THREE.Vector3): void;
  release(): void;
}

/** 구경꾼이 서지 않는 자리: 리본 달린 물건(자리와 반지름 m) — 그 둘레 npc.propRoom 안에는 서지도 지나가지도 않는다 */
export interface KeepOff {
  v: THREE.Vector3;
  r: number;
}

/** 구경꾼 자리가 후보 물건·버섯에서 떨어져 있어야 하는 거리(m — 물건은 가장자리에서) */
const PROP_ROOM = 5,
  MUSHROOM_ROOM = 6;
/** 한 무리가 둘러서는 자리의 반지름(m) — 그 판의 리본 달린 물건에서 npc.propRoom 에 이만큼 더 떨어진 자리만 쓴다 */
const SEAT_SPREAD = 2;
/** 무리와 무리의 자리 사이(m) */
const HOME_ROOM = 8;
/** 주민 수가 npc.count 에서 벗어나도 되는 폭(마리 — "서른 마리 안팎") */
const ROSTER_SLACK = 5;

const at = new THREE.Vector3();

/** 후보 물건·버섯과 겹치지 않는 구경꾼 자리 */
export function openSeats(): Seat[] {
  return HIDE.seats.filter((seat) => {
    const isByProp = FIND.props.some((p) => {
      const widest = Math.max(p.size, ...p.under),
        dx = p.x - seat.x,
        dy = p.y - seat.y;
      return Math.hypot(dx, dy) < widest / 2 + PROP_ROOM;
    });
    const isByMushroom = FIND.mushrooms.some((m) => {
      const dx = m.x - seat.x,
        dy = m.y - seat.y;
      return Math.hypot(dx, dy) < MUSHROOM_ROOM;
    });
    return !isByProp && !isByMushroom;
  });
}

/**
 * 판 영역 주민 수의 규칙에 어긋난 것을 글로 돌려준다(없으면 빈 목록): 같은 종은 npc.perSpecies 를 넘지 않고, 모두 합쳐 npc.count 안팎이다.
 * guests: 판에 부르는 무리(버섯은 mushrooms 가 따로 놓아서 여기 없다)
 */
export function rosterProblems(
  guests: readonly { species: string; count: number }[],
  npc: { count: number; perSpecies: number },
): string[] {
  const perSpecies = new Map<string, number>();
  for (const g of guests) {
    const soFar = perSpecies.get(g.species) ?? 0,
      now = soFar + g.count;
    perSpecies.set(g.species, now);
  }
  const problems: string[] = [];
  let total = 0;
  for (const [species, n] of perSpecies) {
    total += n;
    if (n > npc.perSpecies)
      problems.push(
        `guests: "${species}" 가 ${n}마리 — 한 종은 npc.perSpecies(${npc.perSpecies})를 넘지 않는다`,
      );
  }
  const off = total - npc.count;
  if (Math.abs(off) > ROSTER_SLACK)
    problems.push(
      `guests: 주민이 ${total}마리 — npc.count(${npc.count}) 안팎(±${ROSTER_SLACK})이어야 한다`,
    );
  return problems;
}

/**
 * 무리마다 앉을 자리를 정한다(무리 차례대로 — 앉을 데가 없으면 null).
 * 사는 자리(home)가 비어 있으면(isClear) 거기에, 리본 달린 물건에 막혔으면 거기서 가장 가까운 빈 seats 에 앉는다.
 * 사는 자리가 없는 무리는 남은 seats 가운데 아무 데나(rand). isClear 가 false 인 자리는 쓰지 않는다
 */
export function placeGroups(
  groups: readonly { home: Seat | null }[],
  seats: readonly Seat[],
  isClear: (seat: Seat) => boolean,
  rand: () => number,
): (Seat | null)[] {
  const free = seats.map((seat) => isClear(seat)),
    out: (Seat | null)[] = groups.map(() => null);
  // 사는 자리가 정해진 무리가 먼저 고른다(아무 데나 앉는 무리가 남의 동네를 차지하지 않게)
  groups.forEach((g, i) => {
    const home = g.home;
    if (!home) return;
    if (isClear(home)) {
      out[i] = home;
      return;
    }
    let best = -1,
      least = Infinity;
    seats.forEach((seat, k) => {
      const dx = seat.x - home.x,
        dy = seat.y - home.y,
        far = Math.hypot(dx, dy);
      if (!free[k] || far >= least) return;
      least = far;
      best = k;
    });
    if (best < 0) return;
    free[best] = false;
    out[i] = seats[best];
  });
  // 남의 집 곁의 seats 는 집 없는 무리에게 주지 않는다
  const taken = out.filter((seat) => seat !== null);
  seats.forEach((seat, k) => {
    const isByHome = taken.some((home) => Math.hypot(home.x - seat.x, home.y - seat.y) < HOME_ROOM);
    if (isByHome) free[k] = false;
  });
  groups.forEach((g, i) => {
    if (g.home) return;
    const left = free.flatMap((isFree, k) => (isFree ? [k] : []));
    if (!left.length) return;
    const scaled = rand() * left.length,
      roll = Math.floor(scaled),
      lastOne = left.length - 1,
      pick = left[Math.min(lastOne, roll)];
    free[pick] = false;
    out[i] = seats[pick];
  });
  return out;
}

/** 구경꾼(판 영역의 주민) */
export class Bystanders {
  private readonly seats = openSeats();
  private readonly groups: { spec: GuestGroup; members: Creature[] }[];

  constructor(
    private readonly creatures: BystanderCreatures,
    private readonly rand: () => number,
  ) {
    const guests = HIDE.guests.filter((g) => g.species !== "mushroom"),
      problems = rosterProblems(guests, STAGE.npc);
    if (problems.length) throw new Error(`[teum] hideseek.data.json — ${problems[0]}`);
    this.groups = guests.map((spec) => {
      const members = creatures.invite(spec.species, spec.count);
      return { spec, members };
    });
  }

  /** "꼭꼭 숨어라" 동안 눈을 가리듯 등을 돌린다 · 끝나면 돌아선다 */
  turnAway(on: boolean) {
    this.creatures.turnAway(on);
  }

  /** 상자를 찾았다(at: 그 물건 자리 — 단위 벡터): npc.cheerReach 안의 생물이 그쪽을 보고 좋아한다 */
  cheer(at: THREE.Vector3) {
    this.creatures.cheer(at);
  }

  /** 꽝을 열었다(at: 그 물건 자리): npc.puzzleReach 안의 생물이 힐끗 보고 갸웃한다 */
  puzzle(at: THREE.Vector3) {
    this.creatures.puzzle(at);
  }

  /** 메롱 이사: 날아가는 상자를 눈으로 쫓는다(box: 이사 동안 숨바꼭질이 매 프레임 고치는 세계 자리, null 이면 그만) */
  watch(box: THREE.Vector3 | null) {
    this.creatures.watch(box);
  }

  /** 상자가 숨어 있는 물건들의 자리(단위 벡터) — 곁의 생물이 가끔 힐끗거린다. 찾거나 이사하면 다시 알린다 */
  setHiding(spots: readonly THREE.Vector3[]) {
    this.creatures.setHiding(spots);
  }

  /** 넷을 다 찾았다: at(금색 상자가 떨어지는 자리) 둘레에 둥글게 모인다 */
  gather(at: THREE.Vector3) {
    this.creatures.gather(at);
  }

  /** 판이 끝났다(모인 것·등 돌린 것을 풀고 제 하루로) */
  release() {
    this.creatures.release();
  }

  /**
   * 판 영역이 처음 보일 때와 판 시작(눈을 감은 동안): 무리를 제 동네 자리에 앉힌다. keepOff: 리본 달린 물건 —
   * 그 둘레에는 앉히지 않고, 주민은 그 판 내내 그 둘레(npc.propRoom)에 서지도 지나가지도 않는다
   */
  seat(hub: THREE.Vector3, keepOff: readonly KeepOff[] = []) {
    const room = STAGE.npc.propRoom;
    this.creatures.setStage(hub, HIDE.stage.radius, keepOff, room);
    const isClear = (seat: Seat) => {
      sphereAt(at, hub, seat.x, seat.y);
      return keepOff.every((k) => at.angleTo(k.v) * S.R - k.r >= room + SEAT_SPREAD);
    };
    const homes = this.groups.map((g) => g.spec),
      picked = placeGroups(homes, this.seats, isClear, this.rand);
    this.groups.forEach((g, i) => {
      const seat = picked[i];
      if (!seat) return;
      sphereAt(at, hub, seat.x, seat.y);
      const { orbit, alt, row } = g.spec;
      this.creatures.seat(g.members, at, orbit, alt, row);
    });
  }
}
