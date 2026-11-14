import * as THREE from "three";

import { say } from "../hud";
import type { Game } from "../state";
import { GREY_TOY, S } from "../state";
import type { LayoutRow } from "../world/layout";
import type { GreyMesh } from "../world/materials";
import { grey } from "../world/materials";
import { from, heading, step, UP } from "../world/sphere";
import { featGround } from "../world/terrain";

// 기둥 줄 — 지나가면 하나씩 불이 켜지며 솟는다.
// 풍선 꽃: 줄기 하나에 꽃잎 일곱. 지나가면 줄기가 자라고 꽃이 활짝 핀다(줄기는 길이만 늘어나서 모양이 뭉개지지 않는다)

/** 풍선 꽃 기둥 하나 */
export interface Pillar {
  m: GreyMesh;
  head: THREE.Group;
  r: LayoutRow;
  i: number;
  v: THREE.Vector3;
  lit: number;
  base: number;
  ringAt: number;
}

/** 기둥 줄 전체와 꽃 심 재질(로켓 창문도 같이 쓴다) */
export interface Pillars {
  list: Pillar[];
  core: THREE.MeshStandardMaterial;
}

const fz = new THREE.Vector3(),
  bx = new THREE.Vector3(),
  hy = new THREE.Vector3(),
  m4 = new THREE.Matrix4();

/** 기둥 줄을 만든다 */
export function createPillars(g: Game): Pillars {
  const list: Pillar[] = [],
    petalGeo = new THREE.SphereGeometry(1, 16, 12),
    stemGeo = new THREE.CylinderGeometry(0.3, 0.42, 1, 12).translate(0, 0.5, 0),
    core = grey(g.mats, 0xe6e8e7);
  for (const r of g.L.row)
    for (let i = 0; i < r.n; i++) {
      const mat = grey(g.mats, GREY_TOY),
        m = new THREE.Mesh(stemGeo, mat),
        head = new THREE.Group();
      for (let k = 0; k < 7; k++) {
        const a = (k * Math.PI * 2) / 7,
          pt = new THREE.Mesh(petalGeo, mat);
        const px = Math.cos(a) * 1.2,
          py = Math.sin(a) * 1.2;
        pt.position.set(px, py, 0);
        pt.rotation.z = a;
        pt.scale.set(0.95, 0.52, 0.42);
        head.add(pt);
      }
      const c = new THREE.Mesh(petalGeo, core);
      c.scale.set(0.66, 0.66, 0.5);
      c.position.z = 0.14;
      head.add(c);
      g.scene.add(m, head);
      list.push({
        m,
        head,
        r,
        i,
        v: new THREE.Vector3(),
        lit: 0,
        base: 2.6 + (i % 4) * 0.9,
        ringAt: -1,
      });
    }
  return { list, core };
}

/** 기둥 줄 자리: 좌우로 엇갈리고, 꽃은 줄을 따라 날아오는 쪽을 보고 살짝 위로 든다 */
export function layoutPillars(g: Game, keep: THREE.Vector3[]) {
  let pi = 0;
  for (const r of g.L.row) {
    let v = from(r.dist, r.bear),
      d = heading(v, r.head);
    for (let i = 0; i < r.n; i++) {
      const pl = g.pillars.list[pi++],
        side = new THREE.Vector3().crossVectors(v, d).normalize();
      const sideStep = (i % 2 ? 3.2 : -3.2) / S.R;
      pl.v.copy(v).addScaledVector(side, sideStep).normalize();
      keep.push(pl.v);
      const radius = S.R + featGround(g, pl.v);
      pl.m.position.copy(pl.v).multiplyScalar(radius);
      pl.m.quaternion.setFromUnitVectors(UP, pl.v);
      // 꽃은 줄을 따라 날아오는 쪽을 보고 살짝 위로 든다
      fz.copy(d).multiplyScalar(-0.9).addScaledVector(pl.v, 0.44).normalize();
      bx.crossVectors(pl.v, fz).normalize();
      hy.crossVectors(fz, bx);
      m4.makeBasis(bx, hy, fz);
      pl.head.quaternion.setFromRotationMatrix(m4);
      [v, d] = step(v, d, 5, 2);
    }
  }
}

/** 기둥 줄: 지나가면 불이 켜지며 솟고 꽃이 핀다 */
export function pillarsFrame(g: Game) {
  const { pl: me, t, time } = g,
    dt = t.dt,
    TC = g.mats.toy,
    lime = g.mats.lime;
  for (const pl of g.pillars.list) {
    if (me.air < 7 && me.p.angleTo(pl.v) * S.R < 5.6) {
      if (pl.lit <= 0.2 && pl.i === 0) say(g, "기둥 줄 — 지나가면 하나씩 솟습니다");
      pl.lit = 1;
    } else {
      const dimmed = pl.lit - dt * 0.45;
      pl.lit = Math.max(0, dimmed);
    }
    const e = pl.lit * pl.lit * (3 - 2 * pl.lit);
    const hgt = pl.base * (1 + e * 0.9);
    pl.m.scale.set(1, hgt, 1);
    pl.m.material.color.copy(TC.pillar).lerp(lime, e);
    const headLift = hgt + 0.7;
    pl.head.position.copy(pl.m.position).addScaledVector(pl.v, headLift);
    const pulsePhase = time * 10 + pl.i;
    const bloom = (0.72 + 0.7 * e) * (1 + 0.1 * Math.sin(pulsePhase) * e);
    pl.head.scale.setScalar(bloom);
  }
}
