import * as THREE from "three";

import type { Layout } from "../maps/layout";
import { S } from "../settings";
import { from, heading, offsetInto } from "./sphere";
import type { Terrain } from "./terrain";

// 평평한 단을 깎을 자리(지도 terrain.level — 오너 2026-11-20 "맵에 들어가는 애들이 바닥이랑 수평이 안 맞으면 이상하다"):
// 넓은 것(깔때기 그릇·큰 구조물·장소·문·구름 골짜기·이동 구멍·소용돌이)이 비탈에 걸리면 그 밑을 평평하게 깎는다.
// 작은 것(대포·종·나무…)은 단 없이 가장 낮은 땅에 앉힌다(terrain.seatAt) — 언덕 그물이 작은 단을 그리지 못한다

/** 넓은 것들의 평평한 반지름(m): 깔때기 그릇 · 문(기둥 사이 반 + 여유) · 이동 구멍·소용돌이 · 구름 골짜기 마디 */
const FLAT = { funnel: 25, gate: 11, hole: 5, whirl: 5, pipe: 15 } as const;
/** 구름 골짜기를 따라 단을 놓는 자리(가운데에서 길이 방향 m) */
const PIPE_ALONG = [-20, 0, 20];
/** 둘레 땅 높이가 이만큼(m) 넘게 차이 나는 것만 깎는다(평지·언덕 꼭대기는 그대로) */
const SPREAD_MIN = 0.5;

/** 단을 깎을 자리 하나: 가운데 v, 평평한 반지름 r, 높이를 재는 곳 at(없으면 v) */
export interface TerraceSpot {
  v: THREE.Vector3;
  r: number;
  at?: THREE.Vector3;
}

/** 자리표에서 비탈에 걸린 넓은 것들의 단 자리 */
export function terraceSpots(layout: Layout, terrain: Terrain): TerraceSpot[] {
  const all: TerraceSpot[] = [];
  const add = (v: THREE.Vector3, r: number, at?: THREE.Vector3) => all.push({ v, r, at });
  for (const st of layout.site) {
    if (st.sky || st.lift) continue;
    const v = from(st.dist, st.bear);
    add(v, st.r);
  }
  for (const pl of layout.place) {
    const v = from(pl.dist, pl.bear);
    add(v, pl.r);
  }
  for (const f of layout.funnel) {
    const v = from(f.dist, f.bear);
    add(v, FLAT.funnel);
  }
  for (const gt of layout.gate ?? []) {
    const v = from(gt.dist, gt.bear);
    add(v, FLAT.gate);
  }
  for (const h of layout.hole) {
    const v = from(h.dist, h.bear);
    add(v, FLAT.hole);
  }
  for (const w of layout.whirl) {
    if (w.dist === undefined || w.bear === undefined) continue;
    const v = from(w.dist, w.bear);
    add(v, FLAT.whirl);
  }
  // 구름 골짜기는 길쭉해서 길이 방향으로 단 셋 — 높이는 모두 가운데 땅(경사로가 한 높이에 선다)
  for (const pp of layout.pipe) {
    const center = from(pp.dist, pp.bear);
    const dir = heading(center, pp.head);
    for (const m of PIPE_ALONG) {
      const step = m / S.R;
      const v = center.clone().addScaledVector(dir, step).normalize();
      add(v, FLAT.pipe, center);
    }
  }
  return all.filter((sp) => spreadOf(terrain, sp) > SPREAD_MIN);
}

/* ─── 내부 ─────────────────────────── */

const ring = new THREE.Vector3();

// 평평한 반지름 둘레(열여섯 곳)와 가운데의 땅 높이 차이
function spreadOf(terrain: Terrain, sp: TerraceSpot): number {
  let lo = terrain.featGround(sp.v),
    hi = lo;
  for (let k = 0; k < 16; k++) {
    const bear = k * 22.5;
    offsetInto(ring, sp.v, sp.r, bear);
    const g = terrain.featGround(ring);
    lo = Math.min(lo, g);
    hi = Math.max(hi, g);
  }
  return hi - lo;
}
