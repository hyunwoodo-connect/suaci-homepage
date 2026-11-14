import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { Game } from "../state";
import { S } from "../state";
import { UP } from "./sphere";
import { FLN } from "./terrain";

// 바닥의 꽃: 한 송이 = 꽃잎 여섯 장 + 가운데 심 + 줄기. 지나가면 라임으로 부풀어 피고, 천천히 제 색으로 돌아온다

type FlowerMesh<G extends THREE.BufferGeometry> = THREE.InstancedMesh<
  G,
  THREE.MeshStandardMaterial
>;

/** 꽃 그리기 */
export interface Flowers {
  petals: FlowerMesh<THREE.BufferGeometry>;
  core: FlowerMesh<THREE.SphereGeometry>;
  stem: FlowerMesh<THREE.CylinderGeometry>;
  petalMat: THREE.MeshStandardMaterial;
  coreMat: THREE.MeshStandardMaterial;
  stemMat: THREE.MeshStandardMaterial;
  /** 가까운 꽃만 그린다: 꽃 번호 → 그리는 칸(-1 이면 안 그림) */
  slot: Int32Array;
}

const flQ = new THREE.Quaternion(),
  flQ2 = new THREE.Quaternion(),
  flAx = new THREE.Vector3(),
  q = new THREE.Quaternion(),
  m4 = new THREE.Matrix4(),
  sc = new THREE.Vector3(),
  ps = new THREE.Vector3(),
  tc = new THREE.Color();

/** 꽃마다 고정된 난수(번호 k, 갈래 n) — 0..1 */
export function fr(k: number, n: number): number {
  const phase = k * 12.9898 + n * 78.233;
  const x = Math.sin(phase) * 43758.5453;
  return x - Math.floor(x);
}

/** 꽃 세 겹(꽃잎·심·줄기)을 만든다 */
export function createFlowers(g: Game): Flowers {
  const flGeo = (() => {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      // 끝이 살짝 들린 둥근 꽃잎
      const pg = new THREE.SphereGeometry(1, 10, 7);
      pg.scale(0.5, 0.25, 0.34);
      pg.translate(0.6, 0, 0);
      pg.rotateZ(0.22);
      const turn = (i * Math.PI) / 3;
      pg.rotateY(turn);
      parts.push(pg);
    }
    return mergeGeometries(parts);
  })();
  const petalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.22,
      metalness: 0,
    }),
    coreMat = new THREE.MeshStandardMaterial({ color: 0xffd21f, roughness: 0.25 }),
    stemMat = new THREE.MeshStandardMaterial({ color: 0x2e8f45, roughness: 0.9 });
  const petals = new THREE.InstancedMesh(flGeo, petalMat, FLN);
  const coreGeo = new THREE.SphereGeometry(0.36, 14, 10).scale(1, 0.75, 1).translate(0, 0.14, 0);
  const core = new THREE.InstancedMesh(coreGeo, coreMat, FLN);
  const stemGeo = new THREE.CylinderGeometry(0.045, 0.06, 1, 6).translate(0, 0.5, 0);
  const stem = new THREE.InstancedMesh(stemGeo, stemMat, FLN);
  petalMat.onBeforeCompile = (sh) => {
    sh.vertexShader =
      "varying vec3 vFp;\n" +
      sh.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n  vFp = position;",
      );
    sh.fragmentShader =
      "varying vec3 vFp;\n" +
      sh.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
    { float fr0 = length(vFp.xz), an0 = atan(vFp.z, vFp.x); vec3 base = diffuseColor.rgb;
      float white = step(2.7, base.r + base.g + base.b);
      vec3 heart = mix(vec3(0.72, 0.05, 0.36), vec3(1.0, 0.25, 0.6), white);
      diffuseColor.rgb = mix(heart, base, smoothstep(0.28, 0.78, fr0)); // 가운데는 짙게 물든다
      diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(1.0), vec3(1.0, 0.62, 0.8), white), smoothstep(0.82, 1.05, fr0) * 0.75); // 꽃잎 끝은 다른 색 테두리
      float vein = smoothstep(0.12, 0.0, abs(sin(an0 * 3.0))) * smoothstep(0.3, 0.6, fr0) * (1.0 - smoothstep(0.75, 0.95, fr0));
      diffuseColor.rgb = mix(diffuseColor.rgb, heart, vein * 0.35); }`,
      );
  };
  for (const m of [petals, core, stem]) {
    m.frustumCulled = false;
    g.scene.add(m);
  }
  return { petals, core, stem, petalMat, coreMat, stemMat, slot: new Int32Array(FLN).fill(-1) };
}

/** 가까운 꽃만 칸에 담아 다시 그린다 */
export function flCull(g: Game) {
  const fl = g.flowers,
    bumps = g.terrain.bumps,
    p = g.pl.p;
  let n = 0;
  for (let k = 0; k < FLN; k++) fl.slot[k] = bumps.v[k].dot(p) > 0.86 ? n++ : -1;
  for (let k = 0; k < FLN; k++)
    if (fl.slot[k] >= 0) {
      const l = bumps.lit[k];
      const bloom = l * l * (3 - 2 * l);
      setFlower(g, k, bloom);
    }
  for (const m of [fl.petals, fl.core, fl.stem]) {
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  }
  if (fl.petals.instanceColor) fl.petals.instanceColor.needsUpdate = true;
}

/** 꽃 하나를 그린다. e: 0 평소, 1 활짝 핀 상태 */
export function setFlower(g: Game, k0: number, e: number) {
  const fl = g.flowers,
    bumps = g.terrain.bumps;
  const k = k0,
    sl = fl.slot[k0];
  if (sl < 0) return;
  const v = bumps.v[k],
    gr = bumps.g[k],
    st = (0.45 + fr(k, 1) * 0.9) * (1 + 0.3 * e),
    sz = (bumps.s[k] * 0.75 + 0.4) * (1 + 0.35 * e),
    yaw = fr(k, 2) * 6.283;
  q.setFromUnitVectors(UP, v);
  const yawCos = Math.cos(yaw),
    yawSin = Math.sin(yaw);
  flAx.set(yawCos, 0, yawSin);
  const tilt = 0.15 + fr(k, 3) * 0.55;
  flQ.setFromAxisAngle(flAx, tilt);
  // 기울기(flQ)를 먼저 곱한 뒤에 같은 flQ 를 돌림으로 바꿔 곱한다 — 순서를 바꾸면 기울기가 사라진다
  flQ2.copy(q).multiply(flQ);
  const yawTurn = yaw * 3;
  const spin = flQ.setFromAxisAngle(UP, yawTurn);
  flQ2.multiply(spin);
  const headRadius = S.R + gr + st;
  ps.copy(v).multiplyScalar(headRadius);
  sc.set(sz, sz, sz);
  m4.compose(ps, flQ2, sc);
  fl.petals.setMatrixAt(sl, m4);
  fl.core.setMatrixAt(sl, m4);
  const stemRadius = S.R + gr - 0.15;
  ps.copy(v).multiplyScalar(stemRadius);
  const stemLength = st + 0.15;
  sc.set(1, stemLength, 1);
  m4.compose(ps, q, sc);
  fl.stem.setMatrixAt(sl, m4);
  const petalColor = tc.set(bumps.base[k]).lerp(g.mats.lime, e);
  fl.petals.setColorAt(sl, petalColor);
}

/** 꽃: 낮게 스치면 라임으로 부풀어 피고, 천천히 제 색으로 돌아온다. 지나온 길이 라임 꽃길로 남는다 */
export function flowersFrame(g: Game) {
  const bumps = g.terrain.bumps,
    fl = g.flowers,
    { p, air } = g.pl,
    dt = g.t.dt;
  let flDirty = false;
  for (let k = 0; k < bumps.v.length; k++) {
    let l = bumps.lit[k];
    const reach = 1.3 + bumps.s[k] * 1.5;
    if (air < 5 && 2 * (1 - p.dot(bumps.v[k])) * S.R * S.R < reach * reach) l = 1;
    else if (l > 0) {
      const faded = l - dt * 0.14;
      l = Math.max(0, faded);
    } else continue;
    bumps.lit[k] = l;
    flDirty = true;
    const bloom = l * l * (3 - 2 * l);
    setFlower(g, k, bloom);
  }
  if (flDirty) {
    for (const m of [fl.petals, fl.core, fl.stem]) m.instanceMatrix.needsUpdate = true;
    fl.petals.instanceColor!.needsUpdate = true;
  }
}
