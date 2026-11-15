import type * as THREE from "three";

import type { MapRegion, RegionEdge } from "../maps/map";

// 지역: 자리마다 가장 가까운 마을 중심이 그 자리의 지역이고, 마을 쪽으로 테두리(regionEdge)를 넘을수록 그 지역답다(0..1).
// 배치(조형물 종류·솎기·나무 키)와 그리기(땅 색·물건 색·하늘빛)가 같은 셈을 쓴다

/** 자리 하나의 지역: 차례와 그 지역다운 정도 */
export interface RegionAt {
  i: number;
  w: number;
  /** 그 지역 */
  region: MapRegion;
}

/** 마을 중심과 지역 */
export class Regions {
  constructor(
    private readonly hubs: readonly THREE.Vector3[],
    readonly list: readonly MapRegion[],
    readonly edge: RegionEdge,
  ) {}

  /** v 의 지역(배치가 쓴다 — 새 값을 돌려준다) */
  of(v: THREE.Vector3): RegionAt {
    const i = this.nearest(v);
    const w = this.weight(v, i);
    return { i, w, region: this.list[i] };
  }

  /** v 에서 가장 가까운 마을(지역 차례) */
  nearest(v: THREE.Vector3): number {
    let bi = 0,
      bd = -1;
    for (let i = 0; i < this.hubs.length; i++) {
      const d = v.dot(this.hubs[i]);
      if (d > bd) {
        bd = d;
        bi = i;
      }
    }
    return bi;
  }

  /** v 가 지역 i 다운 정도(테두리 안에서 곧게 0 → 1) */
  weight(v: THREE.Vector3, i: number): number {
    const d = v.dot(this.hubs[i]);
    const t = (d - this.edge.from) / this.edge.width;
    const upper = Math.max(0, t);
    return Math.min(1, upper);
  }
}
