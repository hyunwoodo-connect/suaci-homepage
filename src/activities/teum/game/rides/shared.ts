import type * as THREE from "three";

import type { Hold, ModelLibrary } from "../models/library";
import type { Player } from "../player/player";
import { S } from "../settings";
import type { Occupancy } from "../world/occupancy";

// 놀이기구 여럿이 똑같이 하는 일: 자리 차지, 닿았나, 도형 대신 모델 끼우기

/** 놓인 것마다 둘레 r(m)를 찬 자리로 적고, corridor 를 주면 그 반지름의 비행 통로로도 적는다 */
export function claimSpots(
  occ: Occupancy,
  spots: readonly { v: THREE.Vector3 }[],
  r: number,
  corridor?: number,
) {
  for (const o of spots) {
    occ.fill(o.v, r);
    if (corridor !== undefined) occ.addCorridor(o.v, corridor);
  }
}

/** 붙잡혀 있지 않고, 땅에서 air(m)보다 낮게, v 에서 reach(m) 안에 왔나. 거리 셈(acos)은 앞의 둘이 맞을 때만 한다 */
export function isTouching(player: Player, v: THREE.Vector3, air: number, reach: number): boolean {
  return !player.held && player.air < air && player.p.angleTo(v) * S.R < reach;
}

/** 모델 틀 m 을 parent 에 끼운다. 모델(k)이 오면 끼우기 전에 parent 에 있던 도형을 숨긴다 */
export function swapIn(models: ModelLibrary, k: string, parent: THREE.Object3D, m: Hold) {
  const prim = parent.children.slice();
  parent.add(m);
  models.swapWhenReady(k, prim);
}
