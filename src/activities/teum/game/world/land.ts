import type * as THREE from "three";

import type { GameMap } from "../maps/map";
import { S } from "../settings";
import { from } from "./sphere";

// 뭍과 바다: 지도가 뭍(land)을 정하면 그 가운데에서 reach 도 안쪽만 뭍이고 나머지는 바다다. 정하지 않으면 온 행성이 뭍.
// 바다에는 아무것도 놓지 않는다 — 놓는 것들은 자리 차지(Occupancy.isFree)나 이 창구에 묻는다

/** 뭍과 바다 */
export class Land {
  /** 뭍의 가운데(온 행성이 뭍이면 null) */
  readonly centre: THREE.Vector3 | null;
  /** 가운데와 이루는 각의 코사인이 이보다 크면 뭍(온 행성이 뭍이면 -2 — 늘 참) */
  readonly cos: number;

  constructor(spec?: GameMap["land"]) {
    this.centre = spec ? from(spec.dist, spec.bear) : null;
    const reach = spec ? (spec.reach * Math.PI) / 180 : Math.PI;
    this.cos = spec ? Math.cos(reach) : -2;
  }

  /** v 가 뭍인가. inland(m)를 주면 물가에서 그만큼 더 들어온 자리만 뭍으로 친다 */
  has(v: THREE.Vector3, inland = 0): boolean {
    if (!this.centre) return true;
    if (inland === 0) return v.dot(this.centre) > this.cos;
    return this.coast(v) > inland;
  }

  /** v 에서 물가까지의 거리(m): 뭍 안쪽이면 양수, 바다면 음수. 온 행성이 뭍이면 한없이 멀다 */
  coast(v: THREE.Vector3): number {
    if (!this.centre) return Infinity;
    const reach = Math.acos(this.cos);
    return (reach - v.angleTo(this.centre)) * S.R;
  }
}
