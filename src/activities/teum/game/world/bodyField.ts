import type * as THREE from "three";

import type { Body } from "../maps/tangles";
import { ACCESS_ROOM, isTogether, tangleOf, widest } from "../maps/tangles";
import { S } from "../settings";
import { chordOf, SphereGrid } from "./sphereGrid";

// 놓인 것들의 몸을 모아 두고, 새로 놓으려는 것이 엉키는지 답한다.
// 자리 차지(world/occupancy)는 둥근 자리 하나로만 보지만, 여기는 높이마다 굵기를 본다 —
// 씨앗으로 흩뿌리는 것 가운데 채우는 것(작은 소품·숲 나무·열기구·큰 꽃·비눗방울·꼬마 라임)이 다른 것과 엉키면 놓지 않는 데 쓴다

/** 땅에 닿은 토막으로 치는 높이(m) · 이 키(m) 이하의 납작한 자리는 땅으로 친다 */
const GROUND = 1,
  FLAT = 1;

/** 놓인 몸들 */
export class BodyField {
  private readonly list: Body[] = [];
  /** 몸마다 가장 넓은 반지름(m — list 와 같은 차례) */
  private readonly wide: number[] = [];
  private readonly grid = new SphereGrid(0.06);
  private maxR = 0;
  private readonly near: number[] = [];

  /** 놓인 것으로 적는다 */
  add(body: Body) {
    const wide = widest(body);
    this.list.push(body);
    this.wide.push(wide);
    this.grid.add(body.v);
    this.maxR = Math.max(this.maxR, wide);
  }

  /** body 를 놓으면 이미 놓인 것과 엉키나(겹침·올라탐·길 막음). isCounted 를 주면 그것이 고른 것만 본다 */
  tangles(body: Body, isCounted: (other: Body) => boolean = () => true): boolean {
    const wide = widest(body) + ACCESS_ROOM,
      reach = (this.maxR + wide) / S.R,
      chord = chordOf(reach);
    for (const i of this.grid.query(body.v, chord, this.near)) {
      const other = this.list[i];
      // 닿을 수 없이 먼 것은 토막을 견주지 않는다
      if (other.v.angleTo(body.v) * S.R > wide + this.wide[i]) continue;
      if (!isCounted(other) || isTogether(body, other)) continue;
      if (tangleOf(body, other)) return true;
    }
    return false;
  }

  /**
   * 그 자리의 땅이 놓인 것에 덮였나: 땅에 닿은 단단한 토막 안이다(바닥의 작은 꽃을 거를 때).
   * 납작한 놀이 자리(키 FLAT 이하 — 씨앗밭)는 덮은 것으로 치지 않는다: 그 위에는 꽃이 펴도 된다
   */
  covers(v: THREE.Vector3): boolean {
    const reach = this.maxR / S.R,
      chord = chordOf(reach);
    for (const i of this.grid.query(v, chord, this.near)) {
      const other = this.list[i],
        d = other.v.angleTo(v) * S.R;
      for (const part of other.parts)
        if (!part.isSoft && part.lo < GROUND && part.hi > FLAT && d < part.r) return true;
    }
    return false;
  }
}
