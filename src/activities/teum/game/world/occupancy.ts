import * as THREE from "three";

import { S } from "../settings";
import { Land } from "./land";
import { offset } from "./sphere";
import { chordOf, SphereGrid } from "./sphereGrid";

// 세계의 자리 차지: 이미 찬 자리(놓을 때 겹치지 않게), 비행 통로(놀이기구가 나를 실어 보내는 길 — 키 작은 것을 두지 않는다),
// 언덕이 덮으면 안 되는 넓은 놀이 자리, 마을 중심. 놓는 것들은 이 창구로만 묻고 적는다.
// 바다는 늘 찬 자리다 — 빈자리를 묻고 놓는 것은 저절로 뭍에만 놓인다

/** 온 행성이 뭍(지도가 뭍을 정하지 않았을 때) */
const WHOLE = new Land();

/** 둥근 자리 하나 */
interface Zone {
  v: THREE.Vector3;
  r: number;
}

/** 칸 나눔 위의 둥근 자리 목록: 비었나·가까운가를 몇 칸만 보고 답한다 */
class ZoneSet {
  readonly list: Zone[] = [];
  private readonly grid = new SphereGrid(0.06);
  private maxR = 0;
  private readonly near: number[] = [];

  add(v: THREE.Vector3, r: number) {
    this.list.push({ v, r });
    this.grid.add(v);
    if (r > this.maxR) this.maxR = r;
  }

  /** v 에서 (그 자리 반지름 + pad) 안에 하나라도 있나 — 칸으로 줄여 봐도 하나씩 다 보는 것과 같은 답 */
  touches(v: THREE.Vector3, pad: number): boolean {
    const reach = (this.maxR + pad) / S.R;
    const chord = chordOf(reach);
    for (const i of this.grid.query(v, chord, this.near)) {
      const o = this.list[i];
      if (o.v.angleTo(v) * S.R < o.r + pad) return true;
    }
    return false;
  }
}

/** 자리 차지 전체 */
export class Occupancy {
  private readonly occ = new ZoneSet();
  private readonly cor = new ZoneSet();
  /** 언덕이 덮으면 안 되는 넓은 놀이 자리(깔때기·씨앗밭·로켓…) */
  readonly zones: Zone[] = [];
  /** 마을 중심(자리표 hub) */
  readonly hubs: THREE.Vector3[] = [];

  /** land: 뭍과 바다(없으면 온 행성이 뭍) */
  constructor(private readonly land: Land = WHOLE) {}

  /** 찬 자리에 더한다 */
  fill(v: THREE.Vector3, r: number) {
    this.occ.add(v, r);
  }

  /** v 둘레 r 이 비어 있나(바다는 늘 차 있다) */
  isFree(v: THREE.Vector3, r: number): boolean {
    return this.land.has(v) && !this.occ.touches(v, r);
  }

  /** 비행 통로에 더한다 */
  addCorridor(v: THREE.Vector3, r: number) {
    this.cor.add(v, r);
  }

  /** 비행 통로 가까이인가 */
  nearCorridor(v: THREE.Vector3, pad: number): boolean {
    return this.cor.touches(v, pad);
  }

  /** 넓은 놀이 자리에 더한다 */
  addZone(v: THREE.Vector3, r: number) {
    this.zones.push({ v, r });
  }

  /** 마을 hk 중심에서 거리(넓이 배)·방향의 자리 */
  hubAt(hk: number, d: number, b: number): THREE.Vector3 {
    const dist = d * S.wide;
    return offset(this.hubs[hk], dist, b);
  }
}
