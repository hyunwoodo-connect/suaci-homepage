import * as THREE from "three";

import { SCULPTURES, sculptureKeys } from "../../assets/settings";
import type { Frame, Thing } from "../core/frame";
import { within } from "../maps/map";
import { sculptureBody, treeBody } from "../maps/placed";
import type { Body } from "../maps/tangles";
import type { Instancer } from "../models/instancer";
import type { Cannons } from "../rides/cannons";
import { NearSet, trunkOf } from "../scenery/trees";
import type { Trees } from "../scenery/trees";
import type { Services } from "../services";
import { S } from "../settings";
import type { BodyField } from "../world/bodyField";
import { fr } from "../world/hash";
import { along, offset } from "../world/sphere";
import type { Height, HasHeights } from "../world/tall";

// 조형물: 고르게 뿌리지 않는다. 마을 기준탑(그 마을의 랜드마크) → 길목의 문 → 가로수 터널 → 숲 덩어리 → 높이 사다리 → 열기구 왕관 → 사이 채움
// → 외딴 거대 조형물 → 지역의 하늘 열기구. 큰 것(14 이상)은 크게 놓으려고 뽑은 열두 가지에서, 작은 것은 여섯 가지에서 —
// 지역 한가운데 쪽이면 그 지역에 서는 종류만. 같은 것이 가까이 또 나오지 않게 가장 멀리 떨어진 종류를 고른다.
// 지역마다 빽빽함·나무 키가 다르고 지역 사이는 성기다(지도 regions). 놓는 차례·고르는 셈이 곧 배치라 시제품 그대로 둔다. 단계마다의 수와 크기는 지도(sculptures)가 정한다

/** 놓인 조형물·열기구 하나 */
export interface Deco {
  v: THREE.Vector3;
  g: number;
  H: number;
  I: Instancer;
  yaw: number;
  r: number;
  sq: number;
  i: number;
  cool?: number;
  /** 막지 않는 문(지나가면 빨라진다) */
  gate: boolean;
  /** 곁에 가면 돈다 */
  spins: boolean;
  /** 꼭대기를 밟으면 튀는 높이 배율 */
  bounce: number;
  /** 떠 있는 열기구 장식(바닥에 묻지 않는다) */
  floats: boolean;
}

/** 놓은 수 — 무엇을 몇 개 놓았는지(시험이 본다) */
interface PlaceStats {
  anchor: number;
  gate: number;
  avenue: number;
  grove: number;
  ladder: number;
  crown: number;
  fill: number;
  lone: number;
  sky: number;
  /** 손으로 놓은 것과 엉켜 곁으로 옮긴 틀(기준탑·문·높이 사다리) */
  moved: number;
}

/** 조형물 몸통이 막는 반지름: 너비 반의 이 몫(둥글지 않은 것도 있어 조금 안쪽까지는 들어간다) */
const BODY_SHARE = 0.85;

/** 지역 한가운데 쪽으로 이만큼 넘으면 그 지역 종류만 고른다 */
const REGION_POOL = 0.25;

/** 작은 것·큰 것·열기구 한 종류에 찍는 수 */
/** 엉킨 틀을 옮길 때 찾아보는 거리(m — 가까운 고리부터) · 고리마다 방향 수 */
const NUDGE_RINGS = [8, 16, 24, 32, 40, 50, 60, 72, 86, 100, 116, 132, 150],
  NUDGE_TURNS = 12;
/** 옮겨도 되는 가장 먼 거리(m): 문·높이 사다리는 제 틀을 벗어나지 않게 가까이만, 마을 기준탑은 그 마을 안이면 된다 */
const NUDGE_REACH = 40,
  NUDGE_ANCHOR = 150;
/** 기준탑이 둘레를 비우는 몫(다른 것보다 붙어 서도 된다) — 기준탑인지도 이 값으로 안다 */
const ANCHOR_SPACING = 0.35;
/** 엉키는 자리를 거를 때 외딴 것을 더 찾아보는 배수 */
const LONE_MORE = 3;
const SMALL_N = 520,
  LARGE_N = 120,
  BALLOON_N = 160;

/** 조형물 전체(숲의 나무는 Trees 가 갖는다) */
export class Sculptures implements Thing, HasHeights {
  readonly list: Deco[] = [];
  readonly stats: PlaceStats = {
    anchor: 0,
    gate: 0,
    avenue: 0,
    grove: 0,
    ladder: 0,
    crown: 0,
    fill: 0,
    lone: 0,
    sky: 0,
    moved: 0,
  };
  /** 마을마다의 랜드마크: 그 마을 기준탑(지역 종류에서 뽑힌 큰 조형물). 못 놓은 마을은 비어 있다 */
  readonly landmarks: (Deco | undefined)[] = [];
  private readonly near = new NearSet(30);
  private readonly squashing = new Set<Deco>();

  constructor(
    private readonly s: Services,
    trees: Trees,
    cannons: Cannons,
    field: BodyField | null,
  ) {
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
    const DBAL = models.inst("d_hotairballoon", BALLOON_N),
      DECO = this.list;
    if (!DK.length) return;
    const HV = occ.hubs,
      p = player.p,
      st = this.stats,
      plan = s.map.sculptures;
    const dv = (i: number, n: number) => {
      const up = 2 * fr(i, n) - 1;
      const nextSalt = n + 1;
      const a = 6.283 * fr(i, nextSalt);
      const ringSq = 1 - up * up;
      const r = Math.sqrt(ringSq);
      const x = r * Math.cos(a);
      const z = r * Math.sin(a);
      return new THREE.Vector3(x, up, z);
    };
    const clearHub = (v: THREE.Vector3, r: number) =>
      !HV.some((hv) => hv.angleTo(v) * S.R < 24 + r) && p.angleTo(v) * S.R > 16 + r;
    const regions = s.regions,
      between = plan.between;
    // 채우는 것(숲 나무·사이 채움·외딴 것)은 무엇과든 엉키면 놓지 않는다.
    // 틀을 잡는 것(기준탑·문·가로수·높이 사다리)은 손으로 놓은 것·숨바꼭질 자리와 엉킬 때만 다음 자리로 간다(틀끼리는 붙어 서도 된다)
    let isFiller = false;
    const isFixed = (other: Body) => other.layer !== "흩뿌림";
    // 지역 한가운데 쪽(0.25 넘게)이면 그 지역에 서는 종류 가운데서만 고른다
    const pick = (list0: Instancer[], v: THREE.Vector3, i: number, cap: number) => {
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
    };
    const add = (o: Deco) => {
      DECO.push(o);
      const reach = o.r + 1;
      this.near.add(o.v, reach);
    };
    const putD = (spot: THREE.Vector3, H: number, i: number, k?: number) => {
      // 지역마다 빽빽함이 다르고, 어느 지역도 아닌 사이는 성기다(기준탑·문·외딴 것·높이 사다리는 솎지 않는다)
      if (!k && (i < 9800 || i >= 9900)) {
        const at = regions.of(spot);
        const skipRoll = fr(i, 403);
        if (skipRoll < at.region.skip * at.w) return false;
        if (at.w < 0.1 && fr(i, 404) < between.skip) return false;
      }
      const I = H >= 14 && DKB.length ? pick(DKB, spot, i, LARGE_N) : pick(DK, spot, i, SMALL_N);
      if (!I) return false;
      const r = I.rw * H;
      const spacing = k || 0.8;
      const clearance = r * spacing + 1.5;
      const corridorPad = H > 25 ? r * 0.7 : 1;
      const isOpen = (at: THREE.Vector3) =>
        occ.isFree(at, clearance) && clearHub(at, r) && !occ.nearCorridor(at, corridorPad);
      if (!isOpen(spot)) return false;
      const sunk = -H * 0.02,
        isGate = isGateOf(I.key);
      const bodyAt = (at: THREE.Vector3) =>
        sculptureBody(DECO.length, I.key, I.rw, at, H, sunk, isGate);
      let v = spot,
        body = bodyAt(spot);
      if (isFiller) {
        if (field?.tangles(body)) return false;
      } else if (field?.tangles(body, isFixed)) {
        // 틀을 잡는 것: 종류·크기는 그대로, 손으로 놓은 것과 엉키지 않는 가장 가까운 자리로 조금 옮긴다(없으면 제자리)
        const reach = k === ANCHOR_SPACING ? NUDGE_ANCHOR : NUDGE_REACH,
          moved = nudge(spot, reach, (at) => isOpen(at) && !field.tangles(bodyAt(at), isFixed));
        if (moved) {
          v = moved;
          body = bodyAt(moved);
          st.moved++;
        }
      }
      field?.add(body);
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
          gate: isGateOf(I.key),
          spins: Boolean(set?.isSpinning),
          bounce: set?.bounce ?? 1,
          floats: false,
        };
      const base = gr - H * 0.02;
      const tilt = (fr(i, 309) - 0.5) * 0.08;
      o.i = I.stamp(v, base, H, yaw, tilt);
      add(o);
      const occR = r * 0.8;
      occ.fill(v, occR);
      return true;
    };
    const TKS = trees.kinds;
    const putT = (v: THREE.Vector3, H: number, i: number) => {
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
      if (!T || T.I.n >= 300 || !occ.isFree(v, 7) || !clearHub(v, 6) || occ.nearCorridor(v, 3))
        return false;
      const canopyR = T.I.rw * H;
      if (H < 86 && occ.nearCorridor(v, canopyR)) H = 88 + 24 * fr(i, 339); // 통로 위에 걸리는 갓은 지나갈 수 있게 높인다
      // 몸은 (통로 위로 높인 뒤의) 마지막 키로 잰다
      const shape = { H, tr: trunkOf(H), cr: T.I.rw * H, cb: T.cb * H },
        body = treeBody(trees.list.length, T.I.key, "흩뿌림", v, shape);
      const counted = isFiller ? undefined : isFixed;
      if (field?.tangles(body, counted)) return false;
      field?.add(body);
      const yaw = 6.28 * fr(i, 337);
      trees.plant(v, H, T, yaw);
      return true;
    };
    const putB = (v: THREE.Vector3, alt: number, H: number, i: number) => {
      // 높이 사다리의 열기구는 솎지 않는다
      if (i < 500 || i >= 560) {
        const at = regions.of(v);
        const skipRoll = fr(i, 407);
        if (skipRoll < at.region.balloonSkip * at.w) return false;
      }
      if (!DBAL || DBAL.n >= BALLOON_N) return false;
      // 채우는 열기구(숲 위·왕관·하늘)는 무엇과든 엉키면 띄우지 않는다. 높이 사다리의 열기구는 틀이라 손으로 놓은 것만 본다
      const body = sculptureBody(DECO.length, DBAL.key, DBAL.rw, v, H, alt, false),
        counted = isFiller ? undefined : isFixed;
      if (field?.tangles(body, counted)) return false;
      field?.add(body);
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
      add(o);
      return true;
    };
    // 1) 마을마다 기준탑 하나: 멀리서도 저기가 마을임을 안다
    for (let hk = 0; hk < HV.length; hk++)
      for (let t = 0; t < plan.anchorTries; t++) {
        const dist = 30 + t * 1.5;
        const bearing = 40 + hk * 67 + t * 37;
        const spot = occ.hubAt(hk, dist, bearing);
        const heightRoll = fr(hk, 361);
        const height = within(plan.anchorHeight, heightRoll);
        const seed = 9000 + hk * 50 + t;
        if (putD(spot, height, seed, ANCHOR_SPACING)) {
          st.anchor++;
          this.landmarks[hk] = DECO[DECO.length - 1];
          break;
        }
      }
    // 2) 다른 마을로 가는 길목마다 거대한 것 둘이 문이 된다
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
            if (putD(v, height, seed, 0.4)) {
              st.gate++;
              break;
            }
          }
      }
    // 3) 가로수 터널: 대포가 쏘아 보내는 길 양옆에 점점 키가 커지는 나무
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
          if (putT(v, height, seed)) st.avenue++;
        }
    });
    isFiller = true;
    // 4) 숲 덩어리: 가운데가 가장 높고 가장자리로 갈수록 낮다. 숲 위에는 열기구
    const grove = (c0: THREE.Vector3, gi: number) => {
      const topRoll = fr(gi, 371);
      const top = within(plan.groves.top, topRoll);
      const countSpread = 7 * fr(gi, 372);
      const n = 11 + Math.floor(countSpread);
      const centerSeed = 4000 + gi * 40;
      if (putT(c0, top, centerSeed)) st.grove++;
      for (let j = 0; j < n; j++) {
        const i = 4001 + gi * 40 + j;
        const ringFrac = (j + 0.5) / n;
        const d = 14 + 52 * Math.sqrt(ringFrac);
        const bearing = j * 137.5 + 360 * fr(gi, 373);
        const v = offset(c0, d, bearing);
        const taper = top * (1 - d / 78) * (0.75 + 0.5 * fr(i, 374));
        const height = Math.max(28, taper);
        if (putT(v, height, i)) st.grove++;
      }
      const balloonBearing = 360 * fr(gi, 375);
      const balloonAt = offset(c0, 18, balloonBearing);
      const balloonAlt = top + 25 + 30 * fr(gi, 376);
      const balloonSize = 26 + 14 * fr(gi, 377);
      putB(balloonAt, balloonAlt, balloonSize, gi);
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
    isFiller = false;
    // 5) 높이 사다리: 낮은 것 → 큰 것 → 나무 → 열기구. 밟고 올라간다
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
        if (putD(spot, H, seed)) st.ladder++;
      });
      const lowTreeAt = at(3.3);
      const lowTreeSeed = 9900 + hk * 3;
      if (putT(lowTreeAt, 70, lowTreeSeed)) st.ladder++;
      const highTreeAt = at(5.2);
      const highTreeSeed = 9901 + hk * 3;
      if (putT(highTreeAt, 105, highTreeSeed)) st.ladder++;
      const lowBalloonAt = at(6.6);
      const lowBalloonSeed = 500 + hk;
      if (putB(lowBalloonAt, 118, 30, lowBalloonSeed)) st.ladder++;
      const highBalloonAt = at(8);
      const highBalloonSeed = 520 + hk;
      if (putB(highBalloonAt, 150, 34, highBalloonSeed)) st.ladder++;
    }
    isFiller = true;
    // 6) 열기구 왕관: 마을 둘레 하늘에 높낮이를 달리해 두른다
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
        if (putB(spot, alt, size, seed)) st.crown++;
      }
    // 7) 사이 채움: 큰 것 하나에 작은 것 두세 개. 초원이 남도록 드문드문
    for (let c = 0; c < plan.fillTries; c++) {
      const c0 = dv(c, 321);
      const bigHeight = 18 + 34 * fr(c, 323) * fr(c, 324);
      const bigSeed = 1000 + c;
      if (putD(c0, bigHeight, bigSeed)) st.fill++;
      const extra = fr(c, 326) * 2;
      const n = 1 + Math.floor(extra);
      for (let j = 0; j < n; j++) {
        const i = 5000 + c * 7 + j;
        const dist = 8 + 17 * fr(i, 331);
        const bearing = 360 * fr(i, 332);
        const spot = offset(c0, dist, bearing);
        const height = 4 + 6 * fr(i, 333);
        if (putD(spot, height, i)) st.fill++;
      }
    }
    // 8) 외딴 곳의 거대한 조형물 몇 개
    const lone = plan.lone;
    // 엉키는 자리를 거르는 만큼 더 찾아본다(외딴 것은 본디 홀로 선다)
    const loneTries = field ? lone.tries * LONE_MORE : lone.tries;
    for (let i = 0; i < loneTries && st.lone < lone.count; i++) {
      const spot = dv(i, 311);
      const heightRoll = fr(i, 313);
      const height = within(lone.height, heightRoll);
      if (putD(spot, height, i, 0.4)) st.lone++;
    }
    // 9) 지역의 하늘 열기구(구름 마을은 하늘에 열기구가 가득)
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
        if (putB(spot, alt, size, seed)) st.sky++;
      }
    });
  }

  /** 고래 길을 정할 때 보는 꼭대기 높이 */
  pushHeights(out: Height[]) {
    for (const o of this.list) out.push([o.v, o.H]);
  }

  /** 눌리면 꿀렁, 꼭대기에 내려앉으면 통 튀고(푸딩은 더 높이), 문은 지나가면 빨라지고, 몸통은 막힌다. 팽이는 곁에 가면 돈다 */
  update(f: Frame) {
    const { player, fx } = this.s,
      p = player.p,
      P = player.P,
      dt = f.dt;
    const altA = P.length() - S.R;
    // 눌린 것만 다시 찍는다(먼 것도 다 펴질 때까지)
    for (const o of this.squashing) {
      const squashLeft = o.sq - dt * 1.5;
      o.sq = Math.max(0, squashLeft);
      const sink = o.floats ? 0 : o.H * 0.02;
      const base = o.g - sink;
      const wobblePhase = o.sq * Math.PI * 3;
      const squash = 1 - 0.08 * Math.sin(wobblePhase) * o.sq;
      o.I.restamp(o.i, o.v, base, o.H, o.yaw, squash);
      if (o.sq <= 0) this.squashing.delete(o);
    }
    if (player.held) return;
    for (const idx of this.near.around(p)) {
      const o = this.list[idx];
      if (o.v.dot(p) < 0.99) continue;
      const d = p.angleTo(o.v) * S.R,
        a = altA - o.g;
      if (d > o.r + 1 || a > o.H + 2 || a < -1) continue;
      if ((o.cool ?? 0) > 0) o.cool! -= dt;
      if (o.spins && d < o.r + 1) {
        o.yaw += dt * 2.5;
        if (o.sq <= 0) {
          const base = o.g - o.H * 0.02;
          o.I.restamp(o.i, o.v, base, o.H, o.yaw, 1);
        }
      } // 팽이는 곁에 가면 돈다
      if (player.vy <= 0.5 && a > o.H * 0.82 && d < o.r * 0.9) {
        const launch = (8.5 + o.H * 0.13) * o.bounce;
        const capped = Math.min(22, launch);
        player.bounce(capped);
        this.squash(o, 1);
        fx.burst(P, 7, 7);
      } // 꼭대기에 내려앉으면 통 튄다(푸딩은 더 높이)
      else if (o.gate) {
        if (a < o.H * 0.8 && d < o.r * 0.55 && !((o.cool ?? 0) > 0)) {
          player.boostAtLeast(1.4);
          o.cool = 2.5;
          this.squash(o, 1);
          fx.burst(P, 9, 9);
        }
      } // 도넛·사탕 문: 막지 않는다. 지나가면 휙 빨라진다
      else if (a < o.H * 0.82 && d < o.r * BODY_SHARE) {
        const blockR = o.r * BODY_SHARE;
        player.blockBody(o.v, blockR);
        if (o.sq < 0.3) this.squash(o, 0.5);
      } // 몸통은 막힌다
    }
  }

  /** at 둘레 reach(m) 안의 조형물이 꿀렁인다(숨바꼭질: 칙이 헛나가도 안개가 닿은 것은 반응한다) */
  shakeNear(at: THREE.Vector3, reach: number) {
    for (const o of this.list) {
      if (o.v.dot(at) < 0.99 || o.v.angleTo(at) * S.R > reach + o.r) continue;
      const pressed = Math.max(o.sq, 0.6);
      this.squash(o, pressed);
    }
  }

  /** 찍어 둔 묶음은 모델 자리(ModelLibrary)가 치운다 */
  dispose() {}

  private squash(o: Deco, k: number) {
    o.sq = k;
    this.squashing.add(o);
  }
}

// 지나가라고 세운 문인가(큰 조형물 가운데 문으로 정한 것)
function isGateOf(key: string): boolean {
  const set = SCULPTURES[key];
  return Boolean(set?.isGate) && set?.size === "large";
}

// 엉킨 자리 곁의 빈자리: reach(m) 안에서 가까운 고리부터 돌아가며 isOpen 인 첫 자리. 없으면 null
function nudge(
  spot: THREE.Vector3,
  reach: number,
  isOpen: (at: THREE.Vector3) => boolean,
): THREE.Vector3 | null {
  for (const ring of NUDGE_RINGS)
    for (let turn = 0; ring <= reach && turn < NUDGE_TURNS; turn++) {
      const bearing = (turn / NUDGE_TURNS) * 360,
        at = offset(spot, ring, bearing);
      if (isOpen(at)) return at;
    }
  return null;
}
