import * as THREE from "three";

import { SCULPTURES, sculptureKeys } from "../../assets/settings";
import type { Frame, Thing } from "../core/frame";
import type { Instancer } from "../models/instancer";
import type { Cannons } from "../rides/cannons";
import { NearSet } from "../scenery/trees";
import type { Trees } from "../scenery/trees";
import type { Services } from "../services";
import { S } from "../settings";
import { fr } from "../world/hash";
import { along, offset } from "../world/sphere";
import type { Height, HasHeights } from "../world/tall";

// 조형물: 고르게 뿌리지 않는다. 마을 기준탑 → 길목의 문 → 가로수 터널 → 숲 덩어리 → 높이 사다리 → 열기구 왕관 → 사이 채움 → 외딴 거대 조형물.
// 큰 것(14 이상)은 크게 놓으려고 뽑은 열두 가지에서, 작은 것은 여섯 가지에서. 같은 것이 가까이 또 나오지 않게 가장 멀리 떨어진 종류를 고른다.
// 놓는 차례·고르는 셈이 곧 배치라 시제품 그대로 둔다

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
}

/** 작은 것·큰 것·열기구 한 종류에 찍는 수 */
const SMALL_N = 520,
  LARGE_N = 70,
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
  };
  private readonly near = new NearSet(30);
  private readonly squashing = new Set<Deco>();

  constructor(
    private readonly s: Services,
    trees: Trees,
    cannons: Cannons,
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
      st = this.stats;
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
    const pick = (list: Instancer[], v: THREE.Vector3, i: number, cap: number) => {
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
    const putD = (v: THREE.Vector3, H: number, i: number, k?: number) => {
      const I = H >= 14 && DKB.length ? pick(DKB, v, i, LARGE_N) : pick(DK, v, i, SMALL_N);
      if (!I) return false;
      const r = I.rw * H;
      const spacing = k || 0.8;
      const clearance = r * spacing + 1.5;
      const corridorPad = H > 25 ? r * 0.7 : 1;
      if (!occ.isFree(v, clearance) || !clearHub(v, r) || occ.nearCorridor(v, corridorPad))
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
      add(o);
      const occR = r * 0.8;
      occ.fill(v, occR);
      return true;
    };
    const TKS = trees.kinds;
    const putT = (v: THREE.Vector3, H: number, i: number) => {
      const T = TKS[i % TKS.length];
      if (!T || T.I.n >= 300 || !occ.isFree(v, 7) || !clearHub(v, 6) || occ.nearCorridor(v, 3))
        return false;
      const canopyR = T.I.rw * H;
      if (H < 86 && occ.nearCorridor(v, canopyR)) H = 88 + 24 * fr(i, 339); // 통로 위에 걸리는 갓은 지나갈 수 있게 높인다
      const yaw = 6.28 * fr(i, 337);
      trees.plant(v, H, T, yaw);
      return true;
    };
    const putB = (v: THREE.Vector3, alt: number, H: number, i: number) => {
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
      add(o);
      return true;
    };
    // 1) 마을마다 기준탑 하나: 멀리서도 저기가 마을임을 안다
    for (let hk = 0; hk < HV.length; hk++)
      for (let t = 0; t < 40; t++) {
        const dist = 30 + t * 1.5;
        const bearing = 40 + hk * 67 + t * 37;
        const spot = occ.hubAt(hk, dist, bearing);
        const height = 120 + 20 * fr(hk, 361);
        const seed = 9000 + hk * 50 + t;
        if (putD(spot, height, seed, 0.35)) {
          st.anchor++;
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
            const height = 60 + 30 * fr(pairSeed, pairSalt);
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
      for (let k = 1; k <= 3; k++)
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
    // 4) 숲 덩어리: 가운데가 가장 높고 가장자리로 갈수록 낮다. 숲 위에는 열기구
    const grove = (c0: THREE.Vector3, gi: number) => {
      const top = 110 + 45 * fr(gi, 371);
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
        for (const t of [0.36, 0.64]) {
          const between = HV[a].clone().lerp(HV[b], t).normalize();
          const bearing = 90 + gi * 61;
          const c0 = offset(between, 70, bearing);
          grove(c0, gi);
          gi++;
        }
      } // 마을 사이 길 옆으로
    for (let k = 0; k < 14; k++) {
      const c0 = dv(k, 381);
      grove(c0, gi);
      gi++;
    }
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
    // 6) 열기구 왕관: 마을 둘레 하늘에 높낮이를 달리해 두른다
    for (let hk = 0; hk < HV.length; hk++)
      for (let j = 0; j < 10; j++) {
        const ringSeed = hk * 10 + j;
        const dist = 62 + 8 * fr(ringSeed, 391);
        const bearing = j * 36 + hk * 11;
        const spot = occ.hubAt(hk, dist, bearing);
        const alt = 70 + 80 * fr(ringSeed, 392);
        const size = 22 + 22 * fr(ringSeed, 393);
        const seed = 600 + hk * 10 + j;
        if (putB(spot, alt, size, seed)) st.crown++;
      }
    // 7) 사이 채움: 큰 것 하나에 작은 것 두세 개. 초원이 남도록 드문드문
    for (let c = 0; c < 560; c++) {
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
    for (let i = 0; i < 600 && st.lone < 22; i++) {
      const spot = dv(i, 311);
      const height = 70 + 60 * fr(i, 313);
      if (putD(spot, height, i, 0.4)) st.lone++;
    }
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
      else if (a < o.H * 0.82 && d < o.r * 0.6) {
        const blockR = o.r * 0.6;
        player.blockBody(o.v, blockR);
        if (o.sq < 0.3) this.squash(o, 0.5);
      } // 몸통은 막힌다
    }
  }

  /** 찍어 둔 묶음은 모델 자리(ModelLibrary)가 치운다 */
  dispose() {}

  private squash(o: Deco, k: number) {
    o.sq = k;
    this.squashing.add(o);
  }
}
