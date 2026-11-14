import * as THREE from "three";

import { S } from "../settings";
import type { LayoutHill } from "./layout";
import { from } from "./sphere";
import { chordOf, SphereGrid } from "./sphereGrid";

// 지형(높이만): 꽃 자리, 완만한 둔덕, 하늘의 뭉게구름 자리, 큰 언덕과 등대 산.
// 자리는 시드 7 의 난수로 뽑는다 — 뽑는 순서(꽃 자리 → 둔덕 → 구름 → 큰 언덕)가 곧 지형이라 바꾸지 않는다.
// 그리는 것은 world/terrainView·world/clouds·world/flowers 가 이 값을 보고 한다

/** 꽃 자리 수 */
export const FLN = 5200;
/** 둔덕 수 */
export const HLN = 700;
/** 뭉게구름 수 */
export const CLOUD_N = 260;
/** 큰 언덕 비탈에 얹는 솜 뭉치 수 */
const FEATURE_TUFTS = 16;

/** 바닥의 꽃 자리: 자리(v)·크기(s)·피어난 정도(lit)·제 색(base)·땅 높이(g) */
export interface FlowerSpots {
  v: THREE.Vector3[];
  s: number[];
  lit: Float32Array;
  base: number[];
  g: Float32Array;
}

/** 둔덕: 자리·크기·켜짐(놀이 자리를 덮는 것은 끈다)·둘레 솜 다섯 [방향, 거리, 크기] */
export interface Hills {
  v: THREE.Vector3[];
  s: number[];
  on: boolean[];
  c: [number, number, number][][];
}

/** 뭉게구름 자리: 크기·높이·방향·덩이마다 흔들림·가운데·흩어진 정도 */
export interface CloudSpots {
  v: THREE.Vector3[];
  s: number[];
  h: number[];
  b: number[];
  j: number[][];
  c: THREE.Vector3[];
  burst: Float32Array;
}

/** 큰 언덕(첫째는 등대 산): 반지름 s, 높이 H, 비탈 솜 뭉치 [방향, 거리, 크기] */
export interface Feature {
  s: number;
  H: number;
  v: THREE.Vector3;
  c: [number, number, number][];
  /** 자리를 정하는 법(첫째는 등대 자리) */
  at: () => THREE.Vector3;
}

/** 둔덕을 끌 때 피하는 둥근 자리 */
interface Round {
  v: THREE.Vector3;
  r: number;
}

/** 지형 높이. 둔덕은 settle 전까지 높이에 들어가지 않는다(놀이기구 자리는 큰 언덕만 보고 정한다) */
export class Terrain {
  readonly flowers: FlowerSpots;
  readonly hills: Hills;
  readonly clouds: CloudSpots;
  readonly features: Feature[];
  private seed = 7;
  private readonly grid = new SphereGrid(0.08);
  private readonly flowerGrid = new SphereGrid(0.04);
  private readonly hillChord: number;
  private readonly near: number[] = [];

  /** lighthouseAt: 등대 자리(첫 큰 언덕이 그 아래 선다) */
  constructor(hillSpots: readonly LayoutHill[], lighthouseAt: () => THREE.Vector3) {
    // ---- 꽃 자리 ----
    const fv: THREE.Vector3[] = [],
      fs: number[] = [];
    for (let i = 0; i < FLN; i++) {
      const v = this.rv();
      fv.push(v);
      const size = 0.35 + this.rnd() * 1.0;
      fs.push(size);
    }
    for (const v of fv) this.flowerGrid.add(v);
    this.flowers = {
      v: fv,
      s: fs,
      lit: new Float32Array(FLN),
      base: new Array<number>(FLN).fill(0xffffff),
      g: new Float32Array(FLN),
    };
    // ---- 둔덕 ----
    const hills: Hills = { v: [], s: [], on: [], c: [] };
    for (let i = 0; i < HLN; i++) {
      const v = this.rv();
      hills.v.push(v);
      const size = 6 + this.rnd() * this.rnd() * 34;
      hills.s.push(size);
      const c: [number, number, number][] = [];
      for (let j = 0; j < 5; j++) {
        // [방향, 거리, 크기] — 세 값을 이 순서로 뽑는다
        const dir = j * 72 + this.rnd() * 40,
          far = 0.42 + this.rnd() * 0.2,
          size2 = 0.3 + this.rnd() * 0.14;
        c.push([dir, far, size2]);
      }
      hills.c.push(c);
    }
    this.hills = hills;
    let maxS = 0;
    for (const s of hills.s) maxS = Math.max(maxS, s);
    const hillAngle = maxS / S.R;
    this.hillChord = chordOf(hillAngle);
    for (const v of hills.v) this.grid.add(v);
    // ---- 뭉게구름 ----
    const clouds: CloudSpots = {
      v: [],
      s: [],
      h: [],
      b: [],
      j: [],
      c: [],
      burst: new Float32Array(CLOUD_N),
    };
    for (let i = 0; i < CLOUD_N; i++) {
      const center = new THREE.Vector3();
      clouds.c.push(center);
    }
    for (let i = 0; i < CLOUD_N; i++) {
      const v = this.rv();
      clouds.v.push(v);
      const size = 5 + this.rnd() * 7;
      clouds.s.push(size);
      const height = 70 + this.rnd() * 110;
      clouds.h.push(height);
      const bearing = this.rnd() * 360;
      clouds.b.push(bearing);
      const wobble = [this.rnd(), this.rnd(), this.rnd(), this.rnd(), this.rnd()];
      clouds.j.push(wobble);
    }
    this.clouds = clouds;
    // ---- 큰 언덕 ----
    this.features = hillSpots.map((h, i) => {
      const c: [number, number, number][] = [];
      for (let j = 0; j < FEATURE_TUFTS; j++) {
        // 비탈의 솜 뭉치 [방향, 거리, 크기] — 세 값을 이 순서로 뽑는다
        const dir = this.rnd() * 360,
          far = 0.2 + this.rnd() * 0.72,
          size = 0.09 + this.rnd() * 0.1;
        c.push([dir, far, size]);
      }
      const at = i ? () => from(h.dist, h.bear) : lighthouseAt;
      return { s: h.s, H: h.H, v: new THREE.Vector3(), c, at };
    });
  }

  /** 큰 언덕 자리를 정한다(장소 자리가 정해진 뒤) */
  placeFeatures() {
    for (const f of this.features) {
      const center = f.at();
      f.v.copy(center);
    }
  }

  /** 놀이·장소·호수·넓은 놀이 자리를 덮는 둔덕은 끈다. 이 뒤로 둔덕이 높이에 들어간다 */
  settle(keep: readonly THREE.Vector3[], lakes: readonly Round[], zones: readonly Round[]) {
    const { hills, features } = this;
    for (let i = 0; i < hills.v.length; i++) {
      const hv = hills.v[i],
        hs = hills.s[i];
      hills.on[i] =
        !keep.some((k) => k.angleTo(hv) * S.R < hs + 10) &&
        !features.some((f) => f.v.angleTo(hv) * S.R < hs + f.s) &&
        !lakes.some((l) => l.v.angleTo(hv) * S.R < hs + l.r) &&
        !zones.some((z) => z.v.angleTo(hv) * S.R < hs + z.r);
    }
  }

  /** 큰 언덕이 올린 땅 높이 */
  featGround(v: THREE.Vector3): number {
    let gr = 0;
    for (const f of this.features) {
      const r = v.angleTo(f.v) * S.R;
      if (r >= f.s) continue;
      const phase = (Math.PI * r) / f.s;
      const y = f.H * 0.5 * (Math.cos(phase) + 1);
      if (y > gr) gr = y;
    }
    return gr;
  }

  /** 그 자리의 땅 높이(큰 언덕 + 켜진 둔덕). 둔덕은 칸 나눔으로 가까운 것만 본다 */
  groundAt(v: THREE.Vector3): number {
    const hills = this.hills;
    let gr = this.featGround(v);
    if (!hills.on.length) return gr;
    const near = this.grid.query(v, this.hillChord, this.near);
    for (const i of near) {
      if (!hills.on[i]) continue;
      const s = hills.s[i],
        r = v.angleTo(hills.v[i]) * S.R;
      if (r >= s) continue;
      const phase = (Math.PI * r) / s;
      const y = 0.15 * s * (Math.cos(phase) + 1);
      if (y > gr) gr = y;
    }
    return gr;
  }

  /** v 둘레(현 길이² × R² < distSq)의 꽃이 한꺼번에 핀다 — 시제품의 2(1 − v·b)R² < d² 와 같은 셈 */
  lightFlowers(v: THREE.Vector3, distSq: number) {
    const fl = this.flowers,
      reach = Math.sqrt(distSq) / S.R;
    for (const k of this.flowerGrid.query(v, reach, this.near)) {
      const chordSq = 2 * (1 - v.dot(fl.v[k]));
      if (chordSq * S.R * S.R < distSq) fl.lit[k] = 1;
    }
  }

  // 지형 난수(시드 7)
  private rnd(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  // 공 전체에 고르게 뽑은 단위 벡터: 높이(u)를 먼저, 둘레 각(a)을 다음에 뽑는다 — 이 순서가 지형을 정한다
  private rv(): THREE.Vector3 {
    const u = this.rnd() * 2 - 1,
      a = this.rnd() * Math.PI * 2;
    const ringSq = 1 - u * u;
    const r = Math.sqrt(ringSq);
    const x = r * Math.cos(a),
      z = r * Math.sin(a);
    return new THREE.Vector3(x, u, z);
  }
}
