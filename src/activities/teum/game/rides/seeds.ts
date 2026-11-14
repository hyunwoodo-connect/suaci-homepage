import * as THREE from "three";

import { burst } from "../fx/sparks";
import { say } from "../hud";
import type { Game } from "../state";
import { GREY_TOY, S } from "../state";
import type { GreyMesh } from "../world/materials";
import { grey } from "../world/materials";
import { from, offset, UP } from "../world/sphere";
import { featGround, groundAt } from "../world/terrain";

// 봉오리 밭(칙 씨앗밭) — 땅 위에 봉오리를 하나씩 놓는다. 위를 지나가면 봉오리가 퐁 터지며 구름 싹이 솟아 몸을 튕겨 올린다.
// 밭 안에 칙 하면 그 자리에도 구름 싹이 솟아 발판이 된다(직접 징검다리를 놓는다)

/** 봉오리 하나 */
export interface Bud {
  m: GreyMesh;
  a: number;
  r: number;
  v: THREE.Vector3;
  g: number;
  cool: number;
}

/** 봉오리 밭 하나. 땅에 묻힌 고리(ring)는 숨긴다 */
export interface SeedField {
  g: THREE.Group;
  ring: GreyMesh;
  dist: number;
  bear: number;
  r: number;
  v: THREE.Vector3;
  dots: Bud[];
}

/** 구름 싹 하나 */
export interface Sprout {
  m: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  v: THREE.Vector3;
  on: boolean;
  t: number;
  g: number;
  cool: number;
  sq: number;
}

/** 봉오리 밭과 구름 싹(돌려 쓰는 열둘) */
export interface Seeds {
  fields: SeedField[];
  sprouts: Sprout[];
  sproutI: number;
}

/** 봉오리 밭을 만든다 */
export function createSeedFields(g: Game): SeedField[] {
  return g.L.seed.map(({ dist, bear }) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(24, 0.28, 8, 80), grey(g.mats, GREY_TOY));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.75;
    const gr = new THREE.Group();
    gr.add(ring);
    ring.visible = false;
    const dots: Bud[] = [];
    for (let k = 0; k < 44; k++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 9), ring.material);
      g.scene.add(dot);
      dots.push({
        m: dot,
        a: k * 2.399 * 57.2958,
        r: 23 * Math.sqrt((k + 0.5) / 44),
        v: new THREE.Vector3(),
        g: 0,
        cool: 0,
      });
    }
    g.scene.add(gr);
    return { g: gr, ring, dist, bear, r: 24, v: new THREE.Vector3(), dots };
  });
}

/** 구름 싹을 만든다(숨긴 채로) */
export function createSprouts(g: Game): Sprout[] {
  const sprouts: Sprout[] = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(1, 18, 12),
      new THREE.MeshBasicMaterial({ color: 0xfafbfb }),
    );
    m.visible = false;
    g.scene.add(m);
    sprouts.push({ m, v: new THREE.Vector3(), on: false, t: 0, g: 0, cool: 0, sq: 0 });
  }
  return sprouts;
}

/** 봉오리 밭 자리(언덕이 덮지 않게 넓은 자리로) */
export function layoutSeedFields(g: Game) {
  for (const f of g.seeds.fields) {
    f.v.copy(from(f.dist, f.bear));
    g.zones.push({ v: f.v, r: 25 });
    f.g.position.copy(f.v).multiplyScalar(S.R + featGround(g, f.v));
    f.g.quaternion.setFromUnitVectors(UP, f.v);
  }
}

/** 봉오리 자리: 해바라기 씨처럼 고르게. 싹은 모두 거둔다 */
export function layoutBuds(g: Game) {
  for (const f of g.seeds.fields)
    for (const d of f.dots) {
      d.v.copy(offset(f.v, d.r, d.a));
      d.g = groundAt(g, d.v);
      d.m.position.copy(d.v).multiplyScalar(S.R + d.g + 0.55);
      d.cool = 0;
    }
  for (const sp of g.seeds.sprouts) sp.on = false;
}

/** 다음 구름 싹을 그 자리에 솟게 한다 */
export function nextSprout(g: Game): Sprout {
  const s = g.seeds;
  return s.sprouts[s.sproutI++ % s.sprouts.length];
}

/** 봉오리: 가까이 지나가면 터지고 잠시 뒤 다시 맺힌다. 구름 싹: 솟았다가 밟으면 튕기고 시간이 지나면 진다 */
export function seedsFrame(g: Game) {
  const { pl, t, time } = g,
    dt = t.dt,
    p = pl.p;
  for (const f of g.seeds.fields) {
    if (p.angleTo(f.v) * S.R > f.r + 30) continue;
    for (const d of f.dots) {
      if (d.cool > 0) {
        d.cool -= dt;
        const k = d.cool > 5 ? 0.001 : 1 - d.cool / 5;
        d.m.scale.setScalar(k);
        continue;
      }
      d.m.scale.setScalar(1 + 0.12 * Math.sin(time * 3 + d.a));
      if (!t.held && pl.air < 3.5 && p.angleTo(d.v) * S.R < 2.6) {
        d.cool = 9;
        const sp = nextSprout(g);
        sp.on = true;
        sp.v.copy(d.v);
        sp.t = 0;
        sp.g = d.g;
        sp.cool = 0.5;
        sp.sq = 1;
        pl.vy = Math.max(pl.vy, 5.5);
        if (pl.air <= 0) pl.air = 0.01;
        burst(g, d.m.position.clone(), 5, 7);
        if (!g.said.seed) {
          g.said.seed = true;
          say(g, "봉오리 밭 — 스치면 퐁 터지며 구름 싹이 솟습니다");
        }
      }
    }
  }
  for (const sp of g.seeds.sprouts) {
    if (!sp.on) {
      sp.m.visible = false;
      continue;
    }
    sp.t += dt;
    if (sp.t > 16) {
      sp.on = false;
      continue;
    }
    if (sp.cool > 0) sp.cool -= dt;
    else if (!t.held && pl.air < 1.4 && sp.t > 0.3 && p.angleTo(sp.v) * S.R < 2.9) {
      pl.vy = 8.2;
      pl.air = 0.01;
      sp.cool = 0.8;
      sp.sq = 1;
    }
    sp.sq = Math.max(0, sp.sq - dt * 2.4);
    const gk = Math.min(1, sp.t / 0.35),
      k = gk * (2 - gk) * Math.min(1, 16 - sp.t) * (1 - Math.sin(sp.sq * Math.PI) * 0.5);
    sp.m.visible = true;
    sp.m.scale.set(2.5 * gk, 1.4 * k, 2.5 * gk);
    sp.m.position.copy(sp.v).multiplyScalar(S.R + sp.g + 0.9 * k);
    sp.m.quaternion.setFromUnitVectors(UP, sp.v);
  }
}
