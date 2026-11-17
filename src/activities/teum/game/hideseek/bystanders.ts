import * as THREE from "three";

import type { Creature } from "../creatures/creature";
import { FIND } from "./findTuning";
import { sphereAt } from "./spots";
import type { GuestGroup, Seat } from "./tuning";
import { HIDE } from "./tuning";

// 구경꾼: 판에 부르는 생물 무리(hideseek.data.json 의 guests — 버섯은 mushrooms 가 따로 앉힌다). 제 할 일을 하며 돌아다닐 뿐이다 —
// 고리도 이름표도 없고, 눌러도 반응하지 않고, 달아나지도 않는다(조각 02: 생물 힌트를 모두 껐다).
// 자리는 seats 를 판마다 섞어 앉힌다. 후보 물건·버섯과 겹치는 자리는 쓰지 않는다(그만큼 무리를 덜 부른다)

/** 판에 부르는 생물을 다루는 창구(Creatures) */
export interface BystanderCreatures {
  /** 무리를 만든다(모델이 없는 종이면 빈 목록) */
  invite(species: string, count: number): Creature[];
  /** 무리를 at 둘레에 앉힌다(하늘 무리는 orbit·alt 로 돈다, row 면 한 줄로) */
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
}

/** 구경꾼 자리가 후보 물건·버섯에서 떨어져 있어야 하는 거리(m — 물건은 가장자리에서) */
const PROP_ROOM = 5,
  MUSHROOM_ROOM = 6;

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

/** 구경꾼 */
export class Bystanders {
  private readonly seats = openSeats();
  private readonly groups: { spec: GuestGroup; members: Creature[] }[];

  constructor(
    private readonly creatures: BystanderCreatures,
    private readonly rand: () => number,
  ) {
    const guests = HIDE.guests.filter((g) => g.species !== "mushroom"),
      invited = guests.slice(0, this.seats.length);
    this.groups = invited.map((spec) => {
      const members = creatures.invite(spec.species, spec.count);
      return { spec, members };
    });
  }

  /** 판 시작(눈을 감은 동안): 무리를 섞은 자리에 앉힌다 */
  seat(hub: THREE.Vector3) {
    const order = this.seats.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const roll = this.rand() * (i + 1),
        j = Math.floor(roll);
      [order[i], order[j]] = [order[j], order[i]];
    }
    this.groups.forEach((g, i) => {
      const seat = this.seats[order[i]];
      sphereAt(at, hub, seat.x, seat.y);
      const { orbit, alt, row } = g.spec;
      this.creatures.seat(g.members, at, orbit, alt, row);
    });
  }
}
