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
    const ringGeo = new THREE.TorusGeometry(24, 0.28, 8, 80);
    const ringMat = grey(g.mats, GREY_TOY);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.75;
    const gr = new THREE.Group();
    gr.add(ring);
    ring.visible = false;
    const dots: Bud[] = [];
    for (let k = 0; k < 44; k++) {
      const dotGeo = new THREE.SphereGeometry(0.7, 12, 9);
      const dot = new THREE.Mesh(dotGeo, ring.material);
      g.scene.add(dot);
      // 해바라기 씨 배치: 황금각 2.399 라디안(offset 은 도를 받는다)씩 돌고, 반지름은 √ 로 벌려 넓이에 고르게
      const budAngle = k * 2.399 * 57.2958;
      const areaFrac = (k + 0.5) / 44;
      const budR = 23 * Math.sqrt(areaFrac);
      const bud: Bud = { m: dot, a: budAngle, r: budR, v: new THREE.Vector3(), g: 0, cool: 0 };
      dots.push(bud);
    }
    g.scene.add(gr);
    return { g: gr, ring, dist, bear, r: 24, v: new THREE.Vector3(), dots };
  });
}

/** 구름 싹을 만든다(숨긴 채로) */
export function createSprouts(g: Game): Sprout[] {
  const sprouts: Sprout[] = [];
  for (let i = 0; i < 12; i++) {
    const sproutGeo = new THREE.SphereGeometry(1, 18, 12);
    const sproutMat = new THREE.MeshBasicMaterial({ color: 0xfafbfb });
    const m = new THREE.Mesh(sproutGeo, sproutMat);
    m.visible = false;
    g.scene.add(m);
    const sprout: Sprout = { m, v: new THREE.Vector3(), on: false, t: 0, g: 0, cool: 0, sq: 0 };
    sprouts.push(sprout);
  }
  return sprouts;
}

/** 봉오리 밭 자리(언덕이 덮지 않게 넓은 자리로) */
export function layoutSeedFields(g: Game) {
  for (const f of g.seeds.fields) {
    const spot = from(f.dist, f.bear);
    f.v.copy(spot);
    g.zones.push({ v: f.v, r: 25 });
    const fieldGround = featGround(g, f.v);
    const fieldR = S.R + fieldGround;
    f.g.position.copy(f.v).multiplyScalar(fieldR);
    f.g.quaternion.setFromUnitVectors(UP, f.v);
  }
}

/** 봉오리 자리: 해바라기 씨처럼 고르게. 싹은 모두 거둔다 */
export function layoutBuds(g: Game) {
  for (const f of g.seeds.fields)
    for (const d of f.dots) {
      const spot = offset(f.v, d.r, d.a);
      d.v.copy(spot);
      d.g = groundAt(g, d.v);
      const budR = S.R + d.g + 0.55;
      d.m.position.copy(d.v).multiplyScalar(budR);
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
      const pulsePhase = time * 3 + d.a;
      const pulse = 1 + 0.12 * Math.sin(pulsePhase);
      d.m.scale.setScalar(pulse);
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
        const popAt = d.m.position.clone();
        burst(g, popAt, 5, 7);
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
    const easedSq = sp.sq - dt * 2.4;
    sp.sq = Math.max(0, easedSq);
    // 솟을 때 부풀고(gk), 지기 1초 전부터 줄고, 밟히면 잠깐 눌린다(sq)
    const growTime = sp.t / 0.35;
    const gk = Math.min(1, growTime);
    const lifeLeft = 16 - sp.t;
    const fade = Math.min(1, lifeLeft);
    const squashAngle = sp.sq * Math.PI;
    const k = gk * (2 - gk) * fade * (1 - Math.sin(squashAngle) * 0.5);
    sp.m.visible = true;
    const width = 2.5 * gk;
    const height = 1.4 * k;
    sp.m.scale.set(width, height, width);
    const sproutR = S.R + sp.g + 0.9 * k;
    sp.m.position.copy(sp.v).multiplyScalar(sproutR);
    sp.m.quaternion.setFromUnitVectors(UP, sp.v);
  }
}
