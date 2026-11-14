import * as THREE from "three";

import { burst } from "../fx/sparks";
import { say } from "../hud";
import type { Game } from "../state";
import { S } from "../state";
import { groundify, puffMat } from "./ground";
import { grey } from "./materials";
import { from, offset, UP } from "./sphere";

// 지형: 바닥의 작은 솜 뭉치(꽃 자리), 완만한 둔덕, 하늘의 뭉게구름, 큰 언덕과 등대 산.
// 자리는 시드 7 의 난수로 뽑는다 — 뽑는 순서가 곧 지형이라 순서를 바꾸지 않는다

/** 같은 도형을 여럿 찍는 밭: 자리(v)·크기(s)·높이(h)·켜짐(on) */
export interface Field {
  m: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  v: THREE.Vector3[];
  s: number[];
  h: number[];
  on: boolean[];
}

/** 바닥의 솜 뭉치 = 꽃 자리. lit 은 피어난 정도, g 는 땅 높이 */
export interface Bumps extends Field {
  lit: Float32Array;
  base: number[];
  g: Float32Array;
}

/** 둔덕: c 는 둘레 솜 다섯 [방향, 거리, 크기] */
export interface Hills extends Field {
  c: [number, number, number][][];
}

/** 뭉게구름: b 방향, j 덩이마다 흔들림, c 가운데, burst 흩어진 정도 */
export interface Clouds extends Field {
  b: number[];
  j: number[][];
  c: THREE.Vector3[];
  burst: Float32Array;
}

/** 큰 언덕(첫째는 등대 산) */
export interface Feature {
  at: () => THREE.Vector3;
  s: number;
  H: number;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  v: THREE.Vector3;
  c: [number, number, number][];
}

/** 지형 전체 */
export interface Terrain {
  /** 지형 난수의 현재 값 */
  seed: number;
  bumps: Bumps;
  hills: Hills;
  hillMat: THREE.MeshStandardMaterial;
  clouds: Clouds;
  features: Feature[];
  clump: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
}

/** 꽃 자리 수 */
export const FLN = 5200;
/** 둔덕 수 */
export const HLN = 700;
/** 뭉게구름 수 */
export const CLOUD_N = 260;
/** 솜 덩어리 중 둔덕 몫(둔덕 하나에 여섯) */
export const CL_H = HLN * 6;

const q = new THREE.Quaternion(),
  m4 = new THREE.Matrix4(),
  sc = new THREE.Vector3(),
  ps = new THREE.Vector3(),
  tc = new THREE.Color();

/** 지형 난수(시드 7) */
export function rnd(g: Game): number {
  const t = g.terrain;
  t.seed = (t.seed * 16807) % 2147483647;
  return t.seed / 2147483647;
}

/** 공 전체에 고르게 뽑은 단위 벡터 */
export function rv(g: Game): THREE.Vector3 {
  // 높이(u)를 먼저, 둘레 각(a)을 다음에 뽑는다 — 이 순서가 지형을 정한다
  const u = rnd(g) * 2 - 1,
    a = rnd(g) * Math.PI * 2;
  const ringSq = 1 - u * u;
  const r = Math.sqrt(ringSq);
  const x = r * Math.cos(a),
    z = r * Math.sin(a);
  return new THREE.Vector3(x, u, z);
}

/** 꽃 자리(작은 솜 뭉치) 밭을 뽑는다 — 지형 난수의 첫 순서 */
export function createBumps(g: Game): Bumps {
  g.terrain = { seed: 7 } as Terrain;
  // 바닥의 작은 솜 뭉치
  const tuftGeo = new THREE.SphereGeometry(1, 14, 10);
  const tuftMat = puffMat(g.ground, 0xcfd3d2);
  const f = field(g, FLN, tuftGeo, tuftMat);
  for (let i = 0; i < FLN; i++) {
    const v = rv(g);
    f.v.push(v);
    const size = 0.35 + rnd(g) * 1.0;
    f.s.push(size);
  }
  const bumps: Bumps = {
    ...f,
    lit: new Float32Array(FLN),
    base: new Array(FLN).fill(0xffffff),
    g: new Float32Array(FLN),
  };
  // 꽃: 지나가면 라임으로 피어난다. 솜 뭉치 자체는 그리지 않고 그 자리에 꽃을 그린다(world/flowers)
  bumps.m.visible = false;
  g.terrain.bumps = bumps;
  return bumps;
}

/** 둔덕을 뽑는다: 땅과 같은 풀밭으로 이어지는 완만한 둔덕(솜 뭉치 덩어리는 쓰지 않는다) */
export function createHills(g: Game) {
  const hillMat = grey(g.mats, 0xd3d6d5);
  hillMat.side = THREE.DoubleSide;
  groundify(g.ground, hillMat);
  const hillGeo = bumpGeo(20, 40);
  const f = field(g, HLN, hillGeo, hillMat);
  const hills: Hills = { ...f, c: [] };
  for (let i = 0; i < HLN; i++) {
    const v = rv(g);
    hills.v.push(v);
    const size = 6 + rnd(g) * rnd(g) * 34;
    hills.s.push(size);
    const c: [number, number, number][] = [];
    for (let j = 0; j < 5; j++) {
      // [방향, 거리, 크기] — 세 값을 이 순서로 뽑는다
      const tuft: [number, number, number] = [
        j * 72 + rnd(g) * 40,
        0.42 + rnd(g) * 0.2,
        0.3 + rnd(g) * 0.14,
      ];
      c.push(tuft);
    }
    hills.c.push(c);
  }
  g.terrain.hills = hills;
  g.terrain.hillMat = hillMat;
}

/** 뭉게구름을 뽑는다(덩이 다섯이 뭉친 구름) */
export function createClouds(g: Game) {
  const puffCount = CLOUD_N * 5;
  const puffGeo = new THREE.SphereGeometry(1, 14, 10);
  const cloudMat = puffMat(g.ground, 0xffffff);
  const f = field(g, puffCount, puffGeo, cloudMat);
  const clouds: Clouds = { ...f, b: [], j: [], c: [], burst: new Float32Array(CLOUD_N) };
  for (let i = 0; i < CLOUD_N; i++) {
    const center = new THREE.Vector3();
    clouds.c.push(center);
  }
  for (let i = 0; i < CLOUD_N; i++) {
    const v = rv(g);
    clouds.v.push(v);
    const size = 5 + rnd(g) * 7;
    clouds.s.push(size);
    const height = 70 + rnd(g) * 110;
    clouds.h.push(height);
    const bearing = rnd(g) * 360;
    clouds.b.push(bearing);
    const wobble = [rnd(g), rnd(g), rnd(g), rnd(g), rnd(g)];
    clouds.j.push(wobble);
  }
  g.terrain.clouds = clouds;
}

/** 큰 언덕과 등대 산 — 오르면 멀리 보이고, 내려갈 때 미끄러진다. 비탈에 얹을 솜 덩어리도 같이 */
export function createFeatures(g: Game) {
  const PLACES = g.places.list;
  // 등대 산과 마을마다의 언덕. 모양은 layout 이 실제 크기로 만든다
  const features: Feature[] = g.L.hill.map((h, i) => {
    const mat = grey(g.mats, 0xd6d9d8);
    mat.side = THREE.DoubleSide;
    groundify(g.ground, mat);
    const emptyGeo = new THREE.BufferGeometry();
    const mesh = new THREE.Mesh(emptyGeo, mat);
    g.scene.add(mesh);
    const c: [number, number, number][] = [];
    for (let j = 0; j < 16; j++) {
      // 비탈의 솜 뭉치 [방향, 거리, 크기] — 세 값을 이 순서로 뽑는다
      const tuft: [number, number, number] = [
        rnd(g) * 360,
        0.2 + rnd(g) * 0.72,
        0.09 + rnd(g) * 0.1,
      ];
      c.push(tuft);
    }
    const at = i ? () => from(h.dist, h.bear) : () => PLACES[3].at();
    return { at, s: h.s, H: h.H, mesh, v: new THREE.Vector3(), c };
  });
  g.terrain.features = features;
  const clumpGeo = new THREE.SphereGeometry(1, 12, 9);
  const clumpMat = puffMat(g.ground, 0xf2f3f3);
  const clumpCount = CL_H + features.length * 16;
  const clump = new THREE.InstancedMesh(clumpGeo, clumpMat, clumpCount);
  clump.frustumCulled = false;
  clump.visible = false;
  g.scene.add(clump);
  g.terrain.clump = clump;
}

/** 큰 언덕이 올린 땅 높이 */
export function featGround(g: Game, v: THREE.Vector3): number {
  let gr = 0;
  for (const f of g.terrain.features) {
    const r = v.angleTo(f.v) * S.R;
    if (r >= f.s) continue;
    const phase = (Math.PI * r) / f.s;
    const y = f.H * 0.5 * (Math.cos(phase) + 1);
    if (y > gr) gr = y;
  }
  return gr;
}

/** 그 자리의 땅 높이(큰 언덕 + 켜진 둔덕) */
export function groundAt(g: Game, v: THREE.Vector3): number {
  const hills = g.terrain.hills;
  let gr = featGround(g, v);
  for (let i = 0; i < hills.v.length; i++) {
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

/** 뭉게구름 하나(덩이 다섯)를 놓는다. b 가 0 보다 크면 흩어진 상태다 */
export function setCloud(g: Game, i: number, b: number) {
  const clouds = g.terrain.clouds;
  for (let j = 0; j < 5; j++) {
    // 가운데 덩이(j=2)가 가장 크고, 흩어질수록 덩이 사이가 벌어진다
    const fromMiddle = j - 2;
    const cs = clouds.s[i],
      sz = cs * (1.3 - Math.abs(fromMiddle) * 0.3) * (0.85 + 0.3 * clouds.j[i][j]) * (1 - 0.35 * b);
    const spread = fromMiddle * cs * 1.05 * (1 + 1.2 * b);
    const v = offset(clouds.v[i], spread, clouds.b[i]);
    q.setFromUnitVectors(UP, v);
    const radius = S.R + clouds.h[i] + sz * 0.5 + (j % 2) * cs * 0.2 + b * cs * 0.6 * ((j % 3) - 1);
    ps.copy(v).multiplyScalar(radius);
    const sx = sz * 1.15,
      sy = sz * 0.82;
    sc.set(sx, sy, sz);
    m4.compose(ps, q, sc);
    const slot = i * 5 + j;
    clouds.m.setMatrixAt(slot, m4);
    const limeMix = b * 0.6;
    const color = tc.set(0xffffff).lerp(g.mats.lime, limeMix);
    clouds.m.setColorAt(slot, color);
  }
}

/** 솜 덩어리 하나를 놓는다(둔덕·언덕 비탈) */
export function putClump(
  g: Game,
  k: number,
  v: THREE.Vector3,
  lift: number,
  sx: number,
  sy: number,
) {
  q.setFromUnitVectors(UP, v);
  const radius = S.R + lift;
  ps.copy(v).multiplyScalar(radius);
  sc.set(sx, sy, sx);
  m4.compose(ps, q, sc);
  g.terrain.clump.setMatrixAt(k, m4);
}

/** 뭉게구름: 뚫고 지나가면 흩어졌다가 다시 뭉친다 */
export function cloudsFrame(g: Game) {
  const { pl, t } = g,
    P = pl.P,
    clouds = g.terrain.clouds;
  let clDirty = false;
  for (let i = 0; i < CLOUD_N; i++) {
    let b = clouds.burst[i];
    const rr = clouds.s[i] * 2.3;
    if (b < 0.4 && P.distanceToSquared(clouds.c[i]) < rr * rr) {
      b = 1;
      if (!t.held) pl.vy = Math.max(pl.vy, 2.6);
      const at = P.clone();
      burst(g, at, 6, 5);
      say(g, "뭉게구름 — 뚫고 지나가면 흩어집니다");
    } else if (b > 0) {
      const faded = b - t.dt * 0.3;
      b = Math.max(0, faded);
    } else continue;
    clouds.burst[i] = b;
    const scatter = b * b * (3 - 2 * b);
    setCloud(g, i, scatter);
    clDirty = true;
  }
  if (clDirty) {
    clouds.m.instanceMatrix.needsUpdate = true;
    clouds.m.instanceColor!.needsUpdate = true;
  }
}

/* ─── 내부 ─────────────────────────── */

function field(
  g: Game,
  n: number,
  geo: THREE.BufferGeometry,
  mat: THREE.MeshStandardMaterial,
): Field {
  const m = new THREE.InstancedMesh(geo, mat, n);
  g.scene.add(m);
  return { m, v: [], s: [], h: [], on: [] };
}

// 꼭대기와 자락이 모두 완만한 종 모양
function bumpGeo(seg: number, around: number) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= seg; i++) {
    const r = i / seg;
    const phase = Math.PI * r;
    const y = 0.5 * (Math.cos(phase) + 1) - 0.12 * r * r;
    const pt = new THREE.Vector2(r, y);
    pts.push(pt);
  }
  return new THREE.LatheGeometry(pts, around);
}
