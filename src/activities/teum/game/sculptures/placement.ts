import * as THREE from "three";

import { SCULPTURES, sculptureKeys } from "../../assets/settings";
import type { GameMap } from "../maps/map";
import { within } from "../maps/map";
import type { Instancer } from "../models/instancer";
import type { Cannons } from "../rides/cannons";
import type { NearSet, Trees } from "../scenery/trees";
import type { Services } from "../services";
import { S } from "../settings";
import { fr } from "../world/hash";
import { along, offset } from "../world/sphere";
import type { Deco } from "./deco";

// 조형물 놓기: 고르게 뿌리지 않는다. 마을 기준탑(그 마을의 랜드마크) → 길목의 문 → 가로수 터널 → 숲 덩어리 → 높이 사다리 → 열기구 왕관 → 사이 채움
// → 외딴 거대 조형물 → 지역의 하늘 열기구. 큰 것(14 이상)은 크게 놓으려고 뽑은 열두 가지에서, 작은 것은 여섯 가지에서 —
// 지역 한가운데 쪽이면 그 지역에 서는 종류만. 같은 것이 가까이 또 나오지 않게 가장 멀리 떨어진 종류를 고른다.
// 지역마다 빽빽함·나무 키가 다르고 지역 사이는 성기다(지도 regions). 고르는 셈이 앞서 놓인 것과 차지한 자리를 보므로
// 단계의 차례와 단계 안의 셈이 곧 배치다 — 하나라도 바꾸면 행성 전체가 달라진다. 단계마다의 수와 크기는 지도(sculptures)가 정한다

/** 놓은 수 — 무엇을 몇 개 놓았는지(시험이 본다) */
export interface PlaceStats {
  anchor: number;
  gate: number;
  avenue: number;
  grove: number;
  ladder: number;
  crown: number;
  fill: number;
  lone: number;
  sky: number;
}

/** 놓은 것을 받는 곳(조형물 전체가 갖는다) */
interface Placed {
  list: Deco[];
  stats: PlaceStats;
  /** 마을마다의 랜드마크(못 놓은 마을은 비어 있다) */
  landmarks: (Deco | undefined)[];
  /** 곁에 간 것만 보려고 놓은 자리를 넣어 두는 곳 */
  near: NearSet;
}

/** 단계마다 같이 쓰는 것: 찍을 묶음(DK 작은 것·DKB 큰 것·DBAL 열기구)·숲의 나무 종류(TKS)·놓은 것·지도 */
interface PlaceCtx {
  occ: Services["occ"];
  terrain: Services["terrain"];
  regions: Services["regions"];
  plan: GameMap["sculptures"];
  between: GameMap["sculptures"]["between"];
  HV: THREE.Vector3[];
  p: THREE.Vector3;
  st: PlaceStats;
  DECO: Deco[];
  landmarks: (Deco | undefined)[];
  near: NearSet;
  trees: Trees;
  TKS: Trees["kinds"];
  DK: Instancer[];
  DKB: Instancer[];
  DBAL: Instancer | null;
}

/** 지역 한가운데 쪽으로 이만큼 넘으면 그 지역 종류만 고른다 */
const REGION_POOL = 0.25;

/** 작은 것·큰 것·열기구 한 종류에 찍는 수 */
const SMALL_N = 520,
  LARGE_N = 120,
  BALLOON_N = 160;

/** 조형물·가로수·숲·열기구를 아홉 단계로 놓는다(작은 조형물 모델이 하나도 없으면 아무것도 놓지 않는다) */
export function placeSculptures(s: Services, trees: Trees, cannons: Cannons, into: Placed) {
  const { models, occ, terrain, player } = s;
  const DK: Instancer[] = [];
  for (const k of sculptureKeys("small")) {
    const I = models.inst(k, SMALL_N);
    if (I) DK.push(I);
  }
  const DKB: Instancer[] = [];
  for (const k of sculptureKeys("large")) {
    const I = models.inst(k, LARGE_N);
    if (I) DKB.push(I);
  }
  const DBAL = models.inst("d_hotairballoon", BALLOON_N);
  if (!DK.length) return;
  const plan = s.map.sculptures;
  const x: PlaceCtx = {
    occ,
    terrain,
    regions: s.regions,
    plan,
    between: plan.between,
    HV: occ.hubs,
    p: player.p,
    st: into.stats,
    DECO: into.list,
    landmarks: into.landmarks,
    near: into.near,
    trees,
    TKS: trees.kinds,
    DK,
    DKB,
    DBAL,
  };
  placeAnchors(x);
  placeGates(x);
  placeAvenues(x, cannons);
  placeGroves(x);
  placeLadders(x);
  placeCrowns(x);
  placeFill(x);
  placeLone(x);
  placeSkyBalloons(x);
}

/* ─── 내부 ─────────────────────────── */

// 1) 마을마다 기준탑 하나: 멀리서도 저기가 마을임을 안다
function placeAnchors(x: PlaceCtx) {
  const { HV, occ, plan, st, DECO, landmarks } = x;
  for (let hk = 0; hk < HV.length; hk++)
    for (let t = 0; t < plan.anchorTries; t++) {
      const dist = 30 + t * 1.5;
      const bearing = 40 + hk * 67 + t * 37;
      const spot = occ.hubAt(hk, dist, bearing);
      const heightRoll = fr(hk, 361);
      const height = within(plan.anchorHeight, heightRoll);
      const seed = 9000 + hk * 50 + t;
      if (putD(x, spot, height, seed, 0.35)) {
        st.anchor++;
        landmarks[hk] = DECO[DECO.length - 1];
        break;
      }
    }
}

// 2) 다른 마을로 가는 길목마다 거대한 것 둘이 문이 된다
function placeGates(x: PlaceCtx) {
  const { HV, plan, st } = x;
  for (let a = 0; a < HV.length; a++)
    for (let b = 0; b < HV.length; b++) {
      if (a === b) continue;
      const ang = HV[a].angleTo(HV[b]);
      if (ang > 2.2) continue;
      const gateReach = 150 / (ang * S.R);
      const gateT = Math.min(0.5, gateReach);
      const c0 = HV[a].clone().lerp(HV[b], gateT).normalize();
      const dir = HV[b].clone().sub(HV[a]);
      const dirUp = dir.dot(c0);
      dir.addScaledVector(c0, -dirUp).normalize();
      const side = new THREE.Vector3().crossVectors(c0, dir).normalize();
      for (const sg of [-1, 1])
        for (let t = 0; t < 12; t++) {
          const sideDist = sg * (24 + t * 4);
          const lane = along(c0, side, sideDist);
          const forward = t * 6;
          const v = along(lane, dir, forward);
          const pairSeed = a * 7 + b;
          const pairSalt = 363 + sg;
          const heightRoll = fr(pairSeed, pairSalt);
          const height = within(plan.gateHeight, heightRoll);
          const sideSeed = sg > 0 ? 300 : 0;
          const seed = 9500 + a * 60 + b * 9 + t + sideSeed;
          if (putD(x, v, height, seed, 0.4)) {
            st.gate++;
            break;
          }
        }
    }
}

// 3) 가로수 터널: 대포가 쏘아 보내는 길 양옆에 점점 키가 커지는 나무
function placeAvenues(x: PlaceCtx, cannons: Cannons) {
  const { plan, st } = x;
  cannons.list.forEach((c, ci) => {
    const side = new THREE.Vector3().crossVectors(c.v, c.d).normalize();
    for (let k = 1; k <= plan.avenue; k++)
      for (const sg of [-1, 1]) {
        const forward = k * 15;
        const ahead = along(c.v, c.d, forward);
        const sideDist = sg * 16.5;
        const v = along(ahead, side, sideDist);
        const treeSeed = ci * 9 + k;
        const height = 88 + k * 14 + 10 * fr(treeSeed, 365);
        const sideSeed = sg > 0 ? 1 : 0;
        const seed = 3000 + ci * 6 + k * 2 + sideSeed;
        if (putT(x, v, height, seed)) st.avenue++;
      }
  });
}

// 4) 숲 덩어리: 가운데가 가장 높고 가장자리로 갈수록 낮다. 숲 위에는 열기구
function placeGroves(x: PlaceCtx) {
  const { HV, plan, st } = x;
  const grove = (c0: THREE.Vector3, gi: number) => {
    const topRoll = fr(gi, 371);
    const top = within(plan.groves.top, topRoll);
    const countSpread = 7 * fr(gi, 372);
    const n = 11 + Math.floor(countSpread);
    const centerSeed = 4000 + gi * 40;
    if (putT(x, c0, top, centerSeed)) st.grove++;
    for (let j = 0; j < n; j++) {
      const i = 4001 + gi * 40 + j;
      const ringFrac = (j + 0.5) / n;
      const d = 14 + 52 * Math.sqrt(ringFrac);
      const bearing = j * 137.5 + 360 * fr(gi, 373);
      const v = offset(c0, d, bearing);
      const taper = top * (1 - d / 78) * (0.75 + 0.5 * fr(i, 374));
      const height = Math.max(28, taper);
      if (putT(x, v, height, i)) st.grove++;
    }
    const balloonBearing = 360 * fr(gi, 375);
    const balloonAt = offset(c0, 18, balloonBearing);
    const balloonAlt = top + 25 + 30 * fr(gi, 376);
    const balloonSize = 26 + 14 * fr(gi, 377);
    putB(x, balloonAt, balloonAlt, balloonSize, gi);
  };
  let gi = 0;
  for (let a = 0; a < HV.length; a++)
    for (let b = a + 1; b < HV.length; b++) {
      const ang = HV[a].angleTo(HV[b]);
      if (ang > 2.2) continue;
      for (const t of plan.groves.between) {
        const between = HV[a].clone().lerp(HV[b], t).normalize();
        const bearing = 90 + gi * 61;
        const c0 = offset(between, 70, bearing);
        grove(c0, gi);
        gi++;
      }
    } // 마을 사이 길 옆으로
  for (let k = 0; k < plan.groves.scattered; k++) {
    const c0 = dv(k, 381);
    grove(c0, gi);
    gi++;
  }
}

// 5) 높이 사다리: 낮은 것 → 큰 것 → 나무 → 열기구. 밟고 올라간다
function placeLadders(x: PlaceCtx) {
  const { HV, occ, st } = x;
  for (let hk = 0; hk < HV.length; hk++) {
    const b0 = 200 + hk * 53,
      base = occ.hubAt(hk, 44, b0),
      dir = offset(base, 6, b0).sub(base);
    const dirUp = dir.dot(base);
    dir.addScaledVector(base, -dirUp).normalize();
    const at = (k: number) => {
      const dist = k * 15;
      return along(base, dir, dist);
    };
    [11, 20, 38].forEach((H, k) => {
      const spot = at(k);
      const seed = 9800 + hk * 10 + k;
      if (putD(x, spot, H, seed)) st.ladder++;
    });
    const lowTreeAt = at(3.3);
    const lowTreeSeed = 9900 + hk * 3;
    if (putT(x, lowTreeAt, 70, lowTreeSeed)) st.ladder++;
    const highTreeAt = at(5.2);
    const highTreeSeed = 9901 + hk * 3;
    if (putT(x, highTreeAt, 105, highTreeSeed)) st.ladder++;
    const lowBalloonAt = at(6.6);
    const lowBalloonSeed = 500 + hk;
    if (putB(x, lowBalloonAt, 118, 30, lowBalloonSeed)) st.ladder++;
    const highBalloonAt = at(8);
    const highBalloonSeed = 520 + hk;
    if (putB(x, highBalloonAt, 150, 34, highBalloonSeed)) st.ladder++;
  }
}

// 6) 열기구 왕관: 마을 둘레 하늘에 높낮이를 달리해 두른다
function placeCrowns(x: PlaceCtx) {
  const { HV, occ, plan, st } = x;
  const crown = plan.crown,
    crownStep = 360 / crown.perHub;
  for (let hk = 0; hk < HV.length; hk++)
    for (let j = 0; j < crown.perHub; j++) {
      const ringSeed = hk * 10 + j;
      const dist = 62 + 8 * fr(ringSeed, 391);
      const bearing = j * crownStep + hk * 11;
      const spot = occ.hubAt(hk, dist, bearing);
      const altRoll = fr(ringSeed, 392),
        sizeRoll = fr(ringSeed, 393);
      const alt = within(crown.alt, altRoll);
      const size = within(crown.size, sizeRoll);
      const seed = 600 + hk * 10 + j;
      if (putB(x, spot, alt, size, seed)) st.crown++;
    }
}

// 7) 사이 채움: 큰 것 하나에 작은 것 두세 개. 초원이 남도록 드문드문
function placeFill(x: PlaceCtx) {
  const { plan, st } = x;
  for (let c = 0; c < plan.fillTries; c++) {
    const c0 = dv(c, 321);
    const bigHeight = 18 + 34 * fr(c, 323) * fr(c, 324);
    const bigSeed = 1000 + c;
    if (putD(x, c0, bigHeight, bigSeed)) st.fill++;
    const extra = fr(c, 326) * 2;
    const n = 1 + Math.floor(extra);
    for (let j = 0; j < n; j++) {
      const i = 5000 + c * 7 + j;
      const dist = 8 + 17 * fr(i, 331);
      const bearing = 360 * fr(i, 332);
      const spot = offset(c0, dist, bearing);
      const height = 4 + 6 * fr(i, 333);
      if (putD(x, spot, height, i)) st.fill++;
    }
  }
}

// 8) 외딴 곳의 거대한 조형물 몇 개
function placeLone(x: PlaceCtx) {
  const { plan, st } = x;
  const lone = plan.lone;
  for (let i = 0; i < lone.tries && st.lone < lone.count; i++) {
    const spot = dv(i, 311);
    const heightRoll = fr(i, 313);
    const height = within(lone.height, heightRoll);
    if (putD(x, spot, height, i, 0.4)) st.lone++;
  }
}

// 9) 지역의 하늘 열기구(구름 마을은 하늘에 열기구가 가득)
function placeSkyBalloons(x: PlaceCtx) {
  const { occ, regions, st } = x;
  regions.list.forEach((region, hk) => {
    const sb = region.skyBalloons;
    if (!sb) return;
    for (let j = 0; j < sb.count; j++) {
      const distRoll = fr(j, 411),
        far = Math.sqrt(distRoll),
        dist = within(sb.dist, far),
        bearing = 360 * fr(j, 412),
        spot = occ.hubAt(hk, dist, bearing);
      const altRoll = fr(j, 413),
        sizeRoll = fr(j, 414);
      const alt = within(sb.alt, altRoll),
        size = within(sb.size, sizeRoll);
      const seed = 700 + j;
      if (putB(x, spot, alt, size, seed)) st.sky++;
    }
  });
}

// 행성 위 자리 하나: 고정 난수 i 의 n·n+1 번째 값을 높이와 방위로(구면에 고르게)
function dv(i: number, n: number) {
  const up = 2 * fr(i, n) - 1;
  const nextSalt = n + 1;
  const a = 6.283 * fr(i, nextSalt);
  const ringSq = 1 - up * up;
  const r = Math.sqrt(ringSq);
  const x = r * Math.cos(a);
  const z = r * Math.sin(a);
  return new THREE.Vector3(x, up, z);
}

// 마을 한가운데와 출발 자리 곁은 비워 둔다
function clearHub(x: PlaceCtx, v: THREE.Vector3, r: number) {
  const { HV, p } = x;
  return !HV.some((hv) => hv.angleTo(v) * S.R < 24 + r) && p.angleTo(v) * S.R > 16 + r;
}

// 지역 한가운데 쪽(0.25 넘게)이면 그 지역에 서는 종류 가운데서만 고른다
function pick(x: PlaceCtx, list0: Instancer[], v: THREE.Vector3, i: number, cap: number) {
  const { DKB, regions, DECO } = x;
  let list = list0;
  const at = regions.of(v);
  if (at.w > REGION_POOL) {
    const pool = list0 === DKB ? at.region.big : at.region.small;
    const inRegion = list0.filter((I) => pool.includes(I.key));
    if (inRegion.length) list = inRegion;
  }
  let best: Instancer | null = null,
    bs = -1e9;
  const startPick = fr(i, 307) * list.length;
  const j0 = Math.floor(startPick);
  for (let j = 0; j < list.length; j++) {
    const I = list[(j0 + j) % list.length];
    if (I.n >= cap) continue;
    let dm = 500;
    for (const o of DECO)
      if (o.I === I) {
        const d = o.v.angleTo(v) * S.R;
        if (d < dm) dm = d;
      }
    const score = dm - I.n * 3 - j * 2;
    if (score > bs) {
      bs = score;
      best = I;
    }
  }
  return best;
}

function add(x: PlaceCtx, o: Deco) {
  const { DECO, near } = x;
  DECO.push(o);
  const reach = o.r + 1;
  near.add(o.v, reach);
}

// 조형물 하나(높이 14 이상은 큰 것에서 고른다). k 는 곁을 비우는 배율 — 주면 솎지 않는다
function putD(x: PlaceCtx, v: THREE.Vector3, H: number, i: number, k?: number) {
  const { regions, between, DK, DKB, occ, terrain } = x;
  // 지역마다 빽빽함이 다르고, 어느 지역도 아닌 사이는 성기다(기준탑·문·외딴 것·높이 사다리는 솎지 않는다)
  if (!k && (i < 9800 || i >= 9900)) {
    const at = regions.of(v);
    const skipRoll = fr(i, 403);
    if (skipRoll < at.region.skip * at.w) return false;
    if (at.w < 0.1 && fr(i, 404) < between.skip) return false;
  }
  const I = H >= 14 && DKB.length ? pick(x, DKB, v, i, LARGE_N) : pick(x, DK, v, i, SMALL_N);
  if (!I) return false;
  const r = I.rw * H;
  const spacing = k || 0.8;
  const clearance = r * spacing + 1.5;
  const corridorPad = H > 25 ? r * 0.7 : 1;
  if (!occ.isFree(v, clearance) || !clearHub(x, v, r) || occ.nearCorridor(v, corridorPad))
    return false;
  const set = SCULPTURES[I.key];
  const gr = terrain.groundAt(v),
    yaw = 6.28 * fr(i, 308),
    o: Deco = {
      v,
      g: gr,
      H,
      I,
      yaw,
      r,
      sq: 0,
      i: 0,
      gate: Boolean(set?.isGate) && set?.size === "large",
      spins: Boolean(set?.isSpinning),
      bounce: set?.bounce ?? 1,
      floats: false,
    };
  const base = gr - H * 0.02;
  const tilt = (fr(i, 309) - 0.5) * 0.08;
  o.i = I.stamp(v, base, H, yaw, tilt);
  add(x, o);
  const occR = r * 0.8;
  occ.fill(v, occR);
  return true;
}

// 숲의 나무 하나(가로수·높이 사다리의 나무도)
function putT(x: PlaceCtx, v: THREE.Vector3, H: number, i: number) {
  const { regions, between, trees, TKS, occ } = x;
  const at = regions.of(v);
  // 숲의 나무(가로수·높이 사다리는 빼고): 지역마다 솎는 비율과 키가 다르다
  if (i >= 4000 && i < 9900) {
    const skipRoll = fr(i, 405);
    if (skipRoll < at.region.treeSkip * at.w) return false;
    if (at.w < 0.1 && fr(i, 406) < between.treeSkip) return false;
    H *= 1 + (at.region.treeHeight - 1) * at.w;
  }
  const own = at.w > REGION_POOL ? trees.kindOf(at.region.tree) : null;
  const T = own ?? TKS[i % TKS.length];
  if (!T || T.I.n >= 300 || !occ.isFree(v, 7) || !clearHub(x, v, 6) || occ.nearCorridor(v, 3))
    return false;
  const canopyR = T.I.rw * H;
  if (H < 86 && occ.nearCorridor(v, canopyR)) H = 88 + 24 * fr(i, 339); // 통로 위에 걸리는 갓은 지나갈 수 있게 높인다
  const yaw = 6.28 * fr(i, 337);
  trees.plant(v, H, T, yaw);
  return true;
}

// 떠 있는 열기구 하나(alt 는 땅에서 띄우는 높이)
function putB(x: PlaceCtx, v: THREE.Vector3, alt: number, H: number, i: number) {
  const { regions, DBAL, terrain } = x;
  // 높이 사다리의 열기구는 솎지 않는다
  if (i < 500 || i >= 560) {
    const at = regions.of(v);
    const skipRoll = fr(i, 407);
    if (skipRoll < at.region.balloonSkip * at.w) return false;
  }
  if (!DBAL || DBAL.n >= BALLOON_N) return false;
  const gr = terrain.groundAt(v) + alt,
    yaw = 6.28 * fr(i, 355),
    o: Deco = {
      v,
      g: gr,
      H,
      I: DBAL,
      yaw,
      r: DBAL.rw * H,
      sq: 0,
      i: 0,
      gate: false,
      spins: false,
      bounce: 1,
      floats: true,
    };
  o.i = DBAL.stamp(v, gr, H, yaw);
  add(x, o);
  return true;
}
