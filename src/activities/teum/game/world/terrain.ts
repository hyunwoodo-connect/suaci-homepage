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
  const u = rnd(g) * 2 - 1,
    a = rnd(g) * Math.PI * 2,
    r = Math.sqrt(1 - u * u);
  return new THREE.Vector3(r * Math.cos(a), u, r * Math.sin(a));
}

/** 꽃 자리(작은 솜 뭉치) 밭을 뽑는다 — 지형 난수의 첫 순서 */
export function createBumps(g: Game): Bumps {
  g.terrain = { seed: 7 } as Terrain;
  const f = field(g, FLN, new THREE.SphereGeometry(1, 14, 10), puffMat(g.ground, 0xcfd3d2)); // 바닥의 작은 솜 뭉치
  for (let i = 0; i < FLN; i++) {
    f.v.push(rv(g));
    f.s.push(0.35 + rnd(g) * 1.0);
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
  const f = field(g, HLN, bumpGeo(20, 40), hillMat);
  const hills: Hills = { ...f, c: [] };
  for (let i = 0; i < HLN; i++) {
    hills.v.push(rv(g));
    hills.s.push(6 + rnd(g) * rnd(g) * 34);
    const c: [number, number, number][] = [];
    for (let j = 0; j < 5; j++)
      c.push([j * 72 + rnd(g) * 40, 0.42 + rnd(g) * 0.2, 0.3 + rnd(g) * 0.14]);
    hills.c.push(c);
  }
  g.terrain.hills = hills;
  g.terrain.hillMat = hillMat;
}

/** 뭉게구름을 뽑는다(덩이 다섯이 뭉친 구름) */
export function createClouds(g: Game) {
  const f = field(g, CLOUD_N * 5, new THREE.SphereGeometry(1, 14, 10), puffMat(g.ground, 0xffffff));
  const clouds: Clouds = { ...f, b: [], j: [], c: [], burst: new Float32Array(CLOUD_N) };
  for (let i = 0; i < CLOUD_N; i++) clouds.c.push(new THREE.Vector3());
  for (let i = 0; i < CLOUD_N; i++) {
    clouds.v.push(rv(g));
    clouds.s.push(5 + rnd(g) * 7);
    clouds.h.push(70 + rnd(g) * 110);
    clouds.b.push(rnd(g) * 360);
    clouds.j.push([rnd(g), rnd(g), rnd(g), rnd(g), rnd(g)]);
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
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    g.scene.add(mesh);
    const c: [number, number, number][] = [];
    for (let j = 0; j < 16; j++) c.push([rnd(g) * 360, 0.2 + rnd(g) * 0.72, 0.09 + rnd(g) * 0.1]);
    const at = i ? () => from(h.dist, h.bear) : () => PLACES[3].at();
    return { at, s: h.s, H: h.H, mesh, v: new THREE.Vector3(), c };
  });
  g.terrain.features = features;
  const clump = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 12, 9),
    puffMat(g.ground, 0xf2f3f3),
    CL_H + features.length * 16,
  );
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
    const y = f.H * 0.5 * (Math.cos((Math.PI * r) / f.s) + 1);
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
    const y = 0.15 * s * (Math.cos((Math.PI * r) / s) + 1);
    if (y > gr) gr = y;
  }
  return gr;
}

/** 뭉게구름 하나(덩이 다섯)를 놓는다. b 가 0 보다 크면 흩어진 상태다 */
export function setCloud(g: Game, i: number, b: number) {
  const clouds = g.terrain.clouds;
  for (let j = 0; j < 5; j++) {
    const cs = clouds.s[i],
      sz = cs * (1.3 - Math.abs(j - 2) * 0.3) * (0.85 + 0.3 * clouds.j[i][j]) * (1 - 0.35 * b);
    const v = offset(clouds.v[i], (j - 2) * cs * 1.05 * (1 + 1.2 * b), clouds.b[i]);
    q.setFromUnitVectors(UP, v);
    ps.copy(v).multiplyScalar(
      S.R + clouds.h[i] + sz * 0.5 + (j % 2) * cs * 0.2 + b * cs * 0.6 * ((j % 3) - 1),
    );
    sc.set(sz * 1.15, sz * 0.82, sz);
    m4.compose(ps, q, sc);
    clouds.m.setMatrixAt(i * 5 + j, m4);
    clouds.m.setColorAt(i * 5 + j, tc.set(0xffffff).lerp(g.mats.lime, b * 0.6));
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
  ps.copy(v).multiplyScalar(S.R + lift);
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
      burst(g, P.clone(), 6, 5);
      say(g, "뭉게구름 — 뚫고 지나가면 흩어집니다");
    } else if (b > 0) b = Math.max(0, b - t.dt * 0.3);
    else continue;
    clouds.burst[i] = b;
    setCloud(g, i, b * b * (3 - 2 * b));
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
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const r = i / seg;
    pts.push(new THREE.Vector2(r, 0.5 * (Math.cos(Math.PI * r) + 1) - 0.12 * r * r));
  }
  return new THREE.LatheGeometry(pts, around);
}
