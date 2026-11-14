import * as THREE from "three";

import { say } from "../hud";
import type { Game } from "../state";
import { S } from "../state";
import { grey } from "../world/materials";
import { from, UP } from "../world/sphere";
import { featGround } from "../world/terrain";

// 풍선 — 잡으면 천천히 떠오른다. 끌면 방향을 잡을 수 있고, 칙 하면 놓는다

/** 풍선 하나 */
export interface Balloon {
  g: THREE.Group;
  dist: number;
  bear: number;
  v: THREE.Vector3;
  gnd: number;
  cool: number;
}

/** 풍선을 잡고 있는 동안 */
export interface BalloonRide {
  on: boolean;
  t: number;
  b: Balloon | null;
}

/** 풍선을 만든다 */
export function createBalloons(g: Game): Balloon[] {
  return g.L.balloon.map(({ dist, bear }) => {
    const gr = new THREE.Group();
    const b = new THREE.Mesh(new THREE.SphereGeometry(1.5, 20, 14), grey(g.mats, 0xc9cdcc));
    b.scale.y = 1.15;
    const str = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 4, 6),
      grey(g.mats, 0x9a9f9e),
    );
    str.position.y = -3.4;
    gr.add(b, str);
    g.scene.add(gr);
    return { g: gr, dist, bear, v: new THREE.Vector3(), gnd: 0, cool: 0 };
  });
}

/** 풍선 자리 */
export function layoutBalloons(g: Game, keep: THREE.Vector3[]) {
  for (const b of g.balloons) {
    b.v.copy(from(b.dist, b.bear));
    b.gnd = featGround(g, b.v);
    keep.push(b.v);
    b.cool = 0;
  }
}

/** 풍선: 잡으면 떠오르다 한참 뒤나 높이 오르면 놓는다 */
export function balloonsFrame(g: Game) {
  const { pl, t } = g,
    dt = t.dt,
    balloon = g.rides.balloon;
  for (const b of g.balloons) {
    if (b.cool > 0) b.cool -= dt;
    else if (!t.held && !balloon.on && pl.air < 7 && pl.p.angleTo(b.v) * S.R < 3) {
      balloon.on = true;
      balloon.t = 0;
      balloon.b = b;
      say(g, "풍선 — 천천히 떠오릅니다. 칙 하면 놓습니다");
    }
  }
  if (balloon.on) {
    balloon.t += dt;
    pl.vy = Math.max(pl.vy, 2.4);
    if (pl.air <= 0) pl.air = 0.01;
    if (balloon.t > 11 || pl.air > 84) {
      balloon.on = false;
      balloon.b!.cool = 6;
    }
  }
}

/** 풍선 모양: 잡은 것은 머리 위에 작게, 나머지는 제자리에서 둥실 */
export function balloonsPose(g: Game) {
  const { pl, time } = g,
    { p, P } = pl,
    balloon = g.rides.balloon;
  for (const b of g.balloons) {
    const mine = balloon.on && balloon.b === b;
    b.g.visible = mine || b.cool <= 0;
    b.g.scale.setScalar(mine ? 0.6 : 1); // 잡고 있을 때는 시야를 가리지 않게 작게
    if (mine) {
      b.g.position.copy(P).addScaledVector(p, 3.1);
      b.g.quaternion.setFromUnitVectors(UP, p);
    } else {
      b.g.position
        .copy(b.v)
        .multiplyScalar(S.R + b.gnd + 5.6 + Math.sin(time * 1.1 + b.dist) * 0.3);
      b.g.quaternion.setFromUnitVectors(UP, b.v);
    }
  }
}
