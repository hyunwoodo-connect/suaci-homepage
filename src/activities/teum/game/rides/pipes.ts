import * as THREE from "three";

import { say } from "../hud";
import type { Game } from "../state";
import { GREY_TOY, S } from "../state";
import type { HeadedSpot } from "../world/layout";
import { grey } from "../world/materials";
import { FWD, from, heading } from "../world/sphere";
import { featGround } from "../world/terrain";

// 구름 골짜기 — 양쪽 벽을 오갈수록 점점 높이 솟는다

/** 골짜기 하나 */
export interface Pipe extends HeadedSpot {
  v: THREE.Vector3;
  d: THREE.Vector3;
  side: THREE.Vector3;
  cool: number;
  combo: number;
  idle: number;
}

/** 골짜기 전체. 부푼 쿠션 벽(ramps)은 자리만 잡고 장면에 넣지 않는다(시제품 그대로 — 벽은 보이지 않고 튀기만 한다) */
export interface Pipes {
  list: Pipe[];
  ramps: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
}

const tmp = new THREE.Vector3(),
  ps = new THREE.Vector3(),
  bx = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  q = new THREE.Quaternion(),
  sc = new THREE.Vector3();

/** 골짜기를 만든다 */
export function createPipes(g: Game): Pipes {
  const list = g.L.pipe.map((c) => ({
    ...c,
    v: new THREE.Vector3(),
    d: new THREE.Vector3(),
    side: new THREE.Vector3(),
    cool: 0,
    combo: 0,
    idle: 0,
  }));
  const rampGeo = new THREE.SphereGeometry(0.5, 18, 12);
  const rampMat = grey(g.mats, GREY_TOY);
  const rampCount = list.length * 16;
  const ramps = new THREE.InstancedMesh(rampGeo, rampMat, rampCount); // 부푼 쿠션 벽
  return { list, ramps };
}

/** 골짜기 자리: 언덕이 덮지 않게 넓은 자리로 잡고, 양쪽 벽 쿠션을 놓는다 */
export function layoutPipes(g: Game) {
  const ramps = g.pipes.ramps;
  let rmi = 0;
  for (const pp of g.pipes.list) {
    const spot = from(pp.dist, pp.bear);
    pp.v.copy(spot);
    const dir = heading(pp.v, pp.head);
    pp.d.copy(dir);
    pp.side.crossVectors(pp.v, pp.d).normalize();
    g.zones.push({ v: pp.v, r: 36 });
    const gr = featGround(g, pp.v);
    for (let j = 0; j < 8; j++)
      for (const sgn of [-1, 1]) {
        const alongStep = ((j - 3.5) * 8) / S.R;
        const sideStep = (sgn * 12) / S.R;
        ps.copy(pp.v)
          .addScaledVector(pp.d, alongStep)
          .addScaledVector(pp.side, sideStep)
          .normalize();
        bx.crossVectors(ps, pp.d).normalize();
        m4.makeBasis(bx, ps, pp.d);
        q.setFromRotationMatrix(m4);
        const tiltAngle = sgn * 0.85;
        const tilt = new THREE.Quaternion().setFromAxisAngle(FWD, tiltAngle);
        q.multiply(tilt);
        const radius = S.R + gr + 2.6;
        ps.multiplyScalar(radius);
        sc.set(8.2, 1.7, 8.6);
        m4.compose(ps, q, sc);
        ramps.setMatrixAt(rmi, m4);
        rmi++;
      }
  }
  ramps.instanceMatrix.needsUpdate = true;
}

/** 구름 골짜기: 벽 쪽으로 달려들 때마다 반대로 튕기며 더 높이 */
export function pipesFrame(g: Game) {
  const { pl, t } = g,
    { p, vel } = pl,
    dt = t.dt,
    list = g.pipes.list;
  let inPipe: Pipe | null = null;
  for (const pp of list) {
    if (pp.cool > 0) pp.cool -= dt;
    pp.idle += dt;
    tmp.copy(p).sub(pp.v);
    const al = tmp.dot(pp.d) * S.R,
      la = tmp.dot(pp.side) * S.R;
    if (Math.abs(al) < 32 && Math.abs(la) < 15.5) {
      inPipe = pp;
      if (
        !t.held &&
        pp.cool <= 0 &&
        (pl.air < 2.2 || pl.vy < 0.3) &&
        Math.abs(la) > 9 &&
        vel.dot(pp.side) * Math.sign(la) > 0.15
      ) {
        const nextCombo = pp.combo + 1;
        pp.combo = Math.min(6, nextCombo);
        pl.vy = 4.5 + 2.3 * pp.combo;
        if (pl.air <= 0) pl.air = 0.01;
        const sideSpeed = vel.dot(pp.side);
        const reflect = -2 * sideSpeed;
        vel.addScaledVector(pp.side, reflect).normalize();
        pl.boost = Math.max(pl.boost, 1.1);
        pl.stun = 0.9;
        pp.cool = 0.5;
        pp.idle = 0;
        if (pp.combo === 1) say(g, "구름 골짜기 — 양쪽 벽을 오갈수록 높이 솟습니다");
      }
    }
  }
  for (const pp of list) if (pp !== inPipe || pp.idle > 6) pp.combo = 0;
}
