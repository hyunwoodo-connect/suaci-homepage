import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { Hold, ModelLibrary } from "../models/library";
import type { Player } from "../player/player";
import { S } from "../settings";
import type { Occupancy } from "../world/occupancy";

// 놀이기구 여럿이 똑같이 하는 일: 자리 차지, 닿았나, 도형 대신 모델 끼우기, 같이 쓰는 모양

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

/**
 * 몽글몽글한 구름 방석 모양: 가운데 큰 덩이 + 둘레 일곱 덩이(통통 구름·징검 구름과 그네 의자가 같이 쓴다).
 * 위에서 본 테두리(둘레 칸)는 둥글게 두고 세로 칸만 줄인다 — 한 화면에 마흔 개 넘게 그려져서 삼각형이 그대로 곱해진다
 */
export function cloudPadGeometry(): THREE.BufferGeometry {
  const core = new THREE.SphereGeometry(0.7, 20, 9);
  core.scale(1, 0.95, 1);
  core.translate(0, 0.28, 0);
  const parts: THREE.BufferGeometry[] = [core];
  for (let i = 0; i < 7; i++) {
    const a = (i * Math.PI * 2) / 7,
      r = 0.4 + (i % 2) * 0.07,
      pg = new THREE.SphereGeometry(r, 16, 8);
    const px = Math.cos(a) * 0.6,
      py = 0.02 + (i % 3) * 0.05,
      pz = Math.sin(a) * 0.6;
    pg.translate(px, py, pz);
    parts.push(pg);
  }
  const merged = mergeGeometries(parts);
  for (const pg of parts) pg.dispose();
  return merged;
}
