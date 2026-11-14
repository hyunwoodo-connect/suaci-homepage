import * as THREE from "three";

import { say } from "../hud";
import type { Game } from "../state";
import { GREY_TOY, S } from "../state";
import type { LayoutChain } from "../world/layout";
import type { GreyMesh } from "../world/materials";
import { grey } from "../world/materials";
import { from, heading, step } from "../world/sphere";
import { featGround } from "../world/terrain";
import { basis } from "./bars";

// 고리 줄 — 통과하면 그 방향으로 슝 밀려 올라간다. 줄을 타면 하늘까지 간다

/** 고리 하나 */
export interface Ring {
  m: GreyMesh;
  c: LayoutChain;
  i: number;
  v: THREE.Vector3;
  d: THREE.Vector3;
  pos: THREE.Vector3;
  h: number;
  cool: number;
  lit: number;
  /** 칙 했을 때 울릴 시각(-1 이면 없음) */
  ringAt: number;
}

const tmp = new THREE.Vector3();

/** 고리를 만든다(자리는 layout) */
export function createRings(g: Game): Ring[] {
  const rings: Ring[] = [];
  for (const c of g.L.chain)
    for (let i = 0; i < c.n; i++) {
      const ringGeo = new THREE.TorusGeometry(7, 0.9, 14, 48);
      const ringMat = grey(g.mats, GREY_TOY);
      const m = new THREE.Mesh(ringGeo, ringMat);
      g.scene.add(m);
      rings.push({
        m,
        c,
        i,
        v: new THREE.Vector3(),
        d: new THREE.Vector3(),
        pos: new THREE.Vector3(),
        h: 0,
        cool: 0,
        lit: 0,
        ringAt: -1,
      });
    }
  return rings;
}

/** 고리 줄 자리: 바람길 끝에서 잇거나 제 자리에서, 고리마다 조금씩 높게 */
export function layoutRings(g: Game, keep: THREE.Vector3[]) {
  const STREAMS = g.streams.list;
  let ri = 0;
  for (const c of g.L.chain) {
    const af = c.afterStream != null ? STREAMS[c.afterStream] : null;
    let v = af ? af.endV.clone() : from(c.dist!, c.bear!),
      d = af ? af.endD.clone() : heading(v, c.head!);
    for (let i = 0; i < c.n; i++) {
      const r = g.rings[ri++];
      r.v.copy(v);
      r.d.copy(d);
      r.h = featGround(g, v) + 5 + i * c.rise * 2.2;
      keep.push(r.v);
      const radius = S.R + r.h;
      r.pos.copy(v).multiplyScalar(radius);
      r.m.position.copy(r.pos);
      basis(r.m, r.v, r.d);
      [v, d] = step(v, d, c.gap, c.curve);
    }
  }
}

/** 고리: 통과하면 고리 방향으로 밀려 올라간다 */
export function ringsFrame(g: Game) {
  const { pl, t } = g,
    { p, h, vel } = pl,
    dt = t.dt,
    TC = g.mats.toy,
    lime = g.mats.lime;
  for (const r of g.rings) {
    const altOffset = t.alt - r.h;
    if (r.cool > 0) r.cool -= dt;
    else if (p.angleTo(r.v) * S.R < 7.6 && Math.abs(altOffset) < 11) {
      const sgn = vel.dot(r.d) >= 0 ? 1 : -1;
      tmp.copy(r.d).multiplyScalar(sgn);
      vel.lerp(tmp, 0.85).normalize();
      h.lerp(tmp, 0.45);
      const hUp = h.dot(p);
      h.addScaledVector(p, -hUp).normalize();
      pl.boost = 1.7;
      pl.vy = sgn > 0 ? 6.6 : 2;
      if (pl.air <= 0) pl.air = 0.01;
      r.cool = 1.6;
      r.lit = 1;
      if (r.i === 0 && sgn > 0) say(g, "고리 줄 — 따라가면 하늘까지 올라갑니다");
    }
    if (r.lit > 0) {
      const dimmed = r.lit - dt * 0.5;
      r.lit = Math.max(0, dimmed);
    }
    const glowRaw = r.lit * 1.6;
    const glow = Math.min(1, glowRaw);
    r.m.material.color.copy(TC.ring).lerp(lime, glow);
    const swell = 1 + r.lit * 0.18;
    r.m.scale.setScalar(swell);
  }
}
