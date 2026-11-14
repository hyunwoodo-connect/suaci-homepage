import * as THREE from "three";

import { say } from "../hud";
import type { Game } from "../state";
import { GREY_TOY, S } from "../state";
import type { LayoutPath } from "../world/layout";
import { grey } from "../world/materials";
import { from, heading, step } from "../world/sphere";
import { featGround } from "../world/terrain";
import type { PathNode } from "./streams";

// 무지개 레일 — 닿으면 붙어 점점 빠르게 미끄러지고, 칙 하면 뛰어오른다

/** 레일 마디: 오르내리는 높이(hh) */
export interface RailNode extends Omit<PathNode, "ph"> {
  hh: number;
}

/** 레일 하나 */
export interface Rail extends LayoutPath {
  nodes: RailNode[];
}

/** 레일 전체. 구슬을 꿴 것 같은 레일(railM)은 자리만 잡고 장면에 넣지 않는다(시제품 그대로) */
export interface Rails {
  list: Rail[];
  rnodes: RailNode[];
  railM: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  railSp: number;
  railCool: number;
  railOn: boolean;
  wasR2: boolean;
}

const tmp = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  q = new THREE.Quaternion(),
  ps = new THREE.Vector3(),
  sc = new THREE.Vector3();

/** 레일을 만든다 */
export function createRails(g: Game): Rails {
  const rnodes: RailNode[] = [];
  const list = g.L.rail.map((rl) => {
    const rail: Rail = { ...rl, nodes: [] };
    for (let i = 0; i < rl.n; i++) {
      const nd = {
        v: new THREE.Vector3(),
        d: new THREE.Vector3(),
        side: new THREE.Vector3(),
        g: 0,
        hh: 2 + 7 * (0.5 - 0.5 * Math.cos((Math.PI * 4 * i) / (rl.n - 1))),
      };
      rail.nodes.push(nd);
      rnodes.push(nd);
    }
    return rail;
  });
  const railM = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.5, 12, 10),
    grey(g.mats, GREY_TOY),
    rnodes.length,
  );
  return { list, rnodes, railM, railSp: 1.3, railCool: 0, railOn: false, wasR2: false };
}

/** 레일 자리 */
export function layoutRails(g: Game, keep: THREE.Vector3[]) {
  const railM = g.rails.railM;
  let rli = 0;
  for (const rl of g.rails.list) {
    let v = from(rl.dist, rl.bear),
      d = heading(v, rl.head),
      i = 0;
    for (const nd of rl.nodes) {
      nd.v.copy(v);
      nd.d.copy(d);
      nd.side.crossVectors(v, d).normalize();
      nd.g = featGround(g, v);
      keep.push(nd.v);
      m4.makeBasis(nd.side, nd.v, nd.d);
      q.setFromRotationMatrix(m4);
      ps.copy(v).multiplyScalar(S.R + nd.g + nd.hh);
      sc.set(0.75, 0.6, rl.gap * 1.35);
      m4.compose(ps, q, sc);
      railM.setMatrixAt(rli++, m4);
      [v, d] = step(v, d, rl.gap, rl.wig * Math.sin(i++ * 0.33));
    }
  }
  railM.instanceMatrix.needsUpdate = true;
}

/** 무지개 레일: 붙어서 점점 빠르게 미끄러진다 */
export function railsFrame(g: Game) {
  const { pl, t } = g,
    { p, h, vel } = pl,
    dt = t.dt,
    R = g.rails;
  let onR2 = false;
  if (R.railCool > 0) R.railCool -= dt;
  else if (!t.held && !g.rides.balloon.on)
    for (const nd of R.rnodes) {
      if (p.angleTo(nd.v) * S.R < 3.4 && Math.abs(t.alt - (nd.g + nd.hh + S.hover * 0.5)) < 3.4) {
        onR2 = true;
        const sg = vel.dot(nd.d) >= 0 ? 1 : -1;
        tmp.copy(p).sub(nd.v);
        const alr = tmp.dot(nd.d);
        p.copy(nd.v).addScaledVector(nd.d, alr).normalize(); // 레일 위에 붙여 둔다(옆으로 밀려나지 않게)
        tmp.copy(nd.d).multiplyScalar(sg);
        vel.lerp(tmp, 1 - Math.exp(-10 * dt)).normalize();
        h.lerp(tmp, 1 - Math.exp(-2 * dt));
        h.addScaledVector(p, -h.dot(p)).normalize();
        R.railSp = Math.min(2.8, R.railSp + dt * 0.35);
        pl.boost = Math.max(pl.boost, R.railSp);
        pl.vy = 0;
        pl.air +=
          (Math.max(0.01, nd.g + nd.hh + 0.8 - Math.max(pl.gh, t.gNow - 0.4) - S.hover + 0.6) -
            pl.air) *
          (1 - Math.exp(-10 * dt));
        break;
      }
    }
  if (!onR2) R.railSp = Math.max(1.3, R.railSp - dt * 1.5);
  if (onR2 && !R.wasR2) say(g, "무지개 레일 — 미끄러지다 칙 하면 뛰어오릅니다");
  R.wasR2 = onR2;
  R.railOn = onR2;
}
