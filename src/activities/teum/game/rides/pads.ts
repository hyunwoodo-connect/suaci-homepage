import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { say } from "../hud";
import type { Game } from "../state";
import { S } from "../state";
import type { LayoutHop } from "../world/layout";
import { from, heading, step, UP } from "../world/sphere";
import { featGround } from "../world/terrain";

// 통통 구름 — 위에 오면 높이 튀어 오른다. 징검 구름 — 작은 구름을 통통 밟으며 건너간다

/** 구름 방석 하나(통통 구름 또는 징검 구름의 한 칸) */
export interface Pad {
  m: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  dist?: number;
  bear?: number;
  /** 징검 구름이면 그 줄과 몇 번째 */
  hop?: LayoutHop;
  i?: number;
  v: THREE.Vector3;
  dir?: THREE.Vector3;
  cool: number;
  sq: number;
  size?: number;
  g: number;
  ringAt: number;
}

/** 구름 방석 전체와 같이 쓰는 모양 */
export interface Pads {
  list: Pad[];
  /** 몽글몽글한 구름 방석: 가운데 큰 덩이 + 둘레 일곱 덩이 */
  geo: THREE.BufferGeometry;
}

const tmp = new THREE.Vector3();

/** 구름 방석 재질 하나 */
export function padMat(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xfafbfb,
    roughness: 0.32,
    metalness: 0,
    emissive: 0xffffff,
    emissiveIntensity: 0.12,
  });
}

/** 통통 구름을 만든다 */
export function createPads(g: Game): Pads {
  const geo = (() => {
    const parts = [new THREE.SphereGeometry(0.7, 20, 14)];
    parts[0].scale(1, 0.95, 1);
    parts[0].translate(0, 0.28, 0);
    for (let i = 0; i < 7; i++) {
      const a = (i * Math.PI * 2) / 7,
        r = 0.4 + (i % 2) * 0.07,
        pg = new THREE.SphereGeometry(r, 16, 12);
      pg.translate(Math.cos(a) * 0.6, 0.02 + (i % 3) * 0.05, Math.sin(a) * 0.6);
      parts.push(pg);
    }
    return mergeGeometries(parts);
  })();
  const list: Pad[] = g.L.pad.map(({ dist, bear }) => {
    const m = new THREE.Mesh(geo, padMat());
    g.scene.add(m);
    return { m, dist, bear, v: new THREE.Vector3(), cool: 0, sq: 0, g: 0, ringAt: -1 };
  });
  return { list, geo };
}

/** 징검 구름(작은 구름 줄)을 만든다 */
export function createHops(g: Game) {
  for (const hp of g.L.hop)
    for (let i = 0; i < hp.n; i++) {
      const m = new THREE.Mesh(g.pads.geo, padMat());
      g.scene.add(m);
      g.pads.list.push({
        m,
        hop: hp,
        i,
        v: new THREE.Vector3(),
        dir: new THREE.Vector3(),
        cool: 0,
        sq: 0,
        size: 3.2,
        g: 0,
        ringAt: -1,
      });
    }
}

/** 징검 구름 자리: 줄을 따라 조금씩 휘며 */
export function layoutHops(g: Game) {
  for (const hp of g.L.hop) {
    let v = from(hp.dist, hp.bear),
      d = heading(v, hp.head);
    for (const pd of g.pads.list)
      if (pd.hop === hp) {
        pd.v.copy(v);
        pd.dir!.copy(d);
        [v, d] = step(v, d, hp.gap, 3);
      }
  }
}

/** 구름 방석 자리와 땅 높이 */
export function layoutPads(g: Game, keep: THREE.Vector3[]) {
  for (const pd of g.pads.list) {
    if (!pd.hop) pd.v.copy(from(pd.dist!, pd.bear!));
    keep.push(pd.v);
    pd.g = featGround(g, pd.v);
    pd.m.quaternion.setFromUnitVectors(UP, pd.v);
  }
}

/** 통통 구름·징검 구름: 밟으면 튀고, 가만히 있을 때도 숨 쉬듯 부푼다 */
export function padsFrame(g: Game) {
  const { pl, t, time } = g,
    { p, vel } = pl,
    dt = t.dt;
  for (const pd of g.pads.list) {
    if (pd.cool > 0) pd.cool -= dt;
    else if (!t.held && pl.air < 0.9 && p.angleTo(pd.v) * S.R < (pd.hop ? 3.6 : 4.4)) {
      pd.cool = 1.2;
      pd.sq = 1;
      pl.air = 0.01;
      if (pd.hop) {
        pl.vy = 3.5;
        const sg = vel.dot(pd.dir!) >= 0 ? 1 : -1;
        tmp.copy(pd.dir!).multiplyScalar(sg);
        vel.lerp(tmp, 0.7).normalize();
        pl.boost = Math.max(pl.boost, 0.7);
        if (pd.i === 0 || pd.i === pd.hop.n - 1) say(g, "징검 구름 — 통통 밟으며 건너갑니다");
      } else {
        pl.vy = 11.5;
        say(g, "통통 구름 — 높이 튀어 올라 멀리 봅니다");
      }
    }
    pd.sq = Math.max(0, pd.sq - dt * 2.2);
    const k =
        (1 - Math.sin(pd.sq * Math.PI) * 0.55) * (1 + 0.05 * Math.sin(time * 2.6 + pd.v.x * 40)),
      w = (pd.size || 4.6) * (1 + (1 - k) * 0.5); // 가만히 있을 때도 숨 쉬듯 부푼다
    pd.m.scale.set(w, 2.3 * k, w);
    pd.m.position.copy(pd.v).multiplyScalar(S.R + pd.g + 0.9 * k);
  }
}
