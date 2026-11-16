import * as THREE from "three";

import type { Creature } from "../creatures/creature";
import type { Services } from "../services";
import { S } from "../settings";
import type { HideFx } from "./effects";
import { sphereAt } from "./spots";
import type { ItemKind } from "./tuning";
import { HIDE } from "./tuning";

// 생물은 아이템이다. 닿으면 잡혀 왼쪽 아래 칸 하나에 들어오고, 칸을 누르면 한 번 쓰고 풀어 준다.
// 칸이 차 있을 때 다른 종류의 생물에 닿으면 바뀐다(먼저 든 것은 그냥 풀려나고, 내게서 멀어질 때까지는 다시 잡히지 않는다 — 둘이 번갈아 잡히지 않게).
// 같은 종류면 바꾸지 않는다. 한 번 쓴 생물은 그 판에 다시 잡히지 않는다. 종류는 둘:
//   일러바치기 — 하늘을 도는 작은 생물(날개 달린 편지·하트·찻잔·종·열쇠). 풀려나면 가장 가까운 숨은 상자 쪽으로 날아가며 라임 점선을 남긴다
//   깨우기 — 땅 위의 큰 생물(컵케이크·찻주전자·회중시계·카드 병정 …). 숨은 상자 전부가 제자리에서 폴짝폴짝 뛴다
// 광장에는 원래 사는 생물이 거의 없어, 판마다 무대에 손님 무리(hideseek.data.json 의 guests)를 불러 앉힌다

/** 아이템이 생물에게 부탁하는 것(Creatures) */
export interface ItemCreatures {
  invite(species: string, count: number): Creature[];
  seat(
    group: readonly Creature[],
    at: THREE.Vector3,
    orbit: number | null,
    alt: number | null,
  ): void;
  touching(reach: number, band: number, skip: ReadonlySet<Creature>): Creature | null;
  capture(c: Creature): void;
  release(c: Creature, at: Readonly<THREE.Vector3>, above: number, circle: number): void;
  sendTo(c: Creature, goal: THREE.Vector3, seconds: number, above: number): void;
  isTattling(c: Creature): boolean;
}

/** 일러바치는 생물이 나는 높이(땅에서 m)·점선 사이(m)·점 크기(m)·점이 남아 있는 시간(초) */
const TATTLE_ALT = 3.2,
  DOT_GAP = 1.5,
  DOT_SIZE = 0.75,
  DOT_LIFE = 7;
/** 상자가 코앞이라 갈 길이 없을 때도 이만큼은 날아가 방향을 보여 준다(m) */
const TATTLE_MIN = 3;
/** 풀려난 생물이 나타나는 자리: 내 앞 이만큼(m) */
const FREE_AHEAD = 5;

const seatAt = new THREE.Vector3(),
  freeAt = new THREE.Vector3(),
  axis = new THREE.Vector3();

/** 아이템 칸 하나와 판의 손님 */
export class Items {
  private readonly groups: Creature[][];
  private held: Creature | null = null;
  /** 지금 잡히지 않는 생물: 이 판에 이미 쓴 것과, 칸에서 밀려나 아직 내 곁에 있는 것(resting — 멀어지면 다시 잡힌다) */
  private readonly blocked = new Set<Creature>();
  private readonly resting = new Set<Creature>();
  /** 지금 일러바치는 생물: 내 앞에서 한 바퀴 도는 남은 시간(초), 날아갈 곳, 마지막 점을 찍은 자리 */
  private flier: Creature | null = null;
  private circling = 0;
  private readonly flyTo = new THREE.Vector3();
  private readonly lastDot = new THREE.Vector3();

  /** hub: 무대 마을 중심(손님을 처음부터 제자리에 앉혀 둔다) */
  constructor(
    private readonly s: Services,
    private readonly creatures: ItemCreatures,
    private readonly fx: HideFx,
    hub: THREE.Vector3,
  ) {
    this.groups = HIDE.guests.map((g) => creatures.invite(g.species, g.count));
    this.reset(hub);
  }

  /** 판 시작: 손님 무리를 제자리(무대 마을 hub 기준)에 앉히고, 칸과 쓴 기록을 비운다 */
  reset(hub: THREE.Vector3) {
    this.held = null;
    this.flier = null;
    this.circling = 0;
    this.blocked.clear();
    this.resting.clear();
    HIDE.guests.forEach((g, i) => {
      sphereAt(seatAt, hub, g.x, g.y);
      this.creatures.seat(this.groups[i], seatAt, g.orbit, g.alt);
    });
  }

  /** 닿은 생물이 있으면 잡아 칸에 넣는다(먼저 든 것은 그 자리에서 풀려난다). 잡았으면 그 종류, 잡힌 자리(세계)는 at 에 */
  catchTouching(at: THREE.Vector3): ItemKind | null {
    const { player } = this.s;
    if (player.isHeld) return null;
    this.wakeRested();
    const c = this.creatures.touching(HIDE.item.reach, HIDE.item.band, this.blocked);
    if (!c || c === this.held) return null;
    const old = this.held;
    if (old) {
      if (kindOf(old) === kindOf(c)) return null;
      this.free(old);
      this.resting.add(old);
      this.blocked.add(old);
    }
    at.copy(c.pos);
    this.creatures.capture(c);
    this.held = c;
    return kindOf(c);
  }

  /**
   * 칸을 눌렀다: 든 생물을 풀어 주고 쓴 종류를 돌려준다(비었으면 null).
   * 일러바치기는 toward(가장 가까운 숨은 상자의 자리) 쪽으로 날아가며 점선을 남긴다 — 상자 tattleStop(m) 앞까지만
   */
  use(toward: THREE.Vector3 | null): ItemKind | null {
    const c = this.held;
    if (!c) return null;
    const kind = kindOf(c);
    this.free(c);
    this.blocked.add(c);
    if (kind === "tattle" && toward) this.tattle(c, toward);
    return kind;
  }

  /** 판이 끝났다: 칸에 든 것을 풀어 준다 */
  drop() {
    if (this.held) this.free(this.held);
    this.flier = null;
  }

  /**
   * 한 프레임: 일러바치는 생물이 내 앞에서 한 바퀴 돈 뒤(따라와) 상자 쪽으로 날아가며 라임 점선을 남긴다.
   * 다 날아가 멈춘 프레임에 true(그때 숨은 상자가 움찔한다)
   */
  update(dt: number): boolean {
    const c = this.flier;
    if (!c) return false;
    if (this.circling > 0) {
      this.circling -= dt;
      if (this.circling > 0) return false;
      this.creatures.sendTo(c, this.flyTo, HIDE.item.tattleSeconds, TATTLE_ALT);
      this.lastDot.copy(c.pos);
      return false;
    }
    if (!this.creatures.isTattling(c)) {
      this.flier = null;
      return true;
    }
    if (c.pos.distanceTo(this.lastDot) < DOT_GAP) return false;
    this.lastDot.copy(c.pos);
    this.fx.dot(c.pos, DOT_SIZE, DOT_LIFE);
    return false;
  }

  // 칸에서 밀려난 생물은 내게서 충분히 멀어지면 다시 잡힌다
  private wakeRested() {
    const p = this.s.player.p,
      far = HIDE.item.reach * 3;
    for (const c of this.resting) {
      if (c.v.angleTo(p) * S.R < far) continue;
      this.resting.delete(c);
      this.blocked.delete(c);
    }
  }

  // 내 앞에 풀어 준다(큰 생물이 내 자리에 나타나면 화면을 가린다)
  private free(c: Creature) {
    const { player } = this.s;
    const above = player.air + S.hover + 0.6,
      arc = FREE_AHEAD / S.R;
    freeAt.copy(player.p).addScaledVector(player.h, arc).normalize();
    this.creatures.release(c, freeAt, above, HIDE.item.circleSeconds);
    if (this.held === c) this.held = null;
  }

  // 일러바치기: 내 자리에서 상자 쪽으로, 상자 tattleStop 앞까지(너무 가까우면 조금만) 날아간다
  private tattle(c: Creature, toward: THREE.Vector3) {
    const p = this.s.player.p;
    const dist = p.angleTo(toward) * S.R,
      full = dist - HIDE.item.tattleStop,
      half = dist * 0.5,
      short = Math.min(TATTLE_MIN, half),
      travel = Math.max(full, short),
      angle = travel / S.R;
    axis.crossVectors(p, toward);
    if (axis.lengthSq() < 1e-12) return;
    axis.normalize();
    this.flyTo.copy(p).applyAxisAngle(axis, angle);
    this.flier = c;
    this.circling = HIDE.item.circleSeconds;
  }
}

/* ─── 내부 ─────────────────────────── */

// 하늘을 도는 작은 생물은 일러바치기, 땅 위의 큰 생물은 깨우기
function kindOf(c: Creature): ItemKind {
  return c.role === "flock" ? "tattle" : "wake";
}
