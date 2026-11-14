import * as THREE from "three";

import { say } from "../hud";
import type { Game } from "../state";
import { GREY_TOY, S } from "../state";
import type { GreyMesh } from "../world/materials";
import { grey } from "../world/materials";
import { from, refT, UP } from "../world/sphere";
import { featGround } from "../world/terrain";

// 상승 기류 — 소용돌이치며 올라가는 바람 기둥. 안에 있는 동안 계속 떠오른다.
// 기류 기둥: 비스듬한 띠가 돌면서 올라가는 반투명 원통. 위로 갈수록 넓어지며 사라진다. 그 안을 꽃잎이 나선으로 오른다

/** 기류 하나 */
export interface Thermal {
  dist: number;
  bear: number;
  v: THREE.Vector3;
  t1: THREE.Vector3;
  t2: THREE.Vector3;
  g: number;
  col: THREE.Mesh<THREE.CylinderGeometry, THREE.ShaderMaterial>;
  ring: GreyMesh;
  base: THREE.Group;
}

/** 기류 전체 */
export interface Thermals {
  list: Thermal[];
  /** 기류에 말려 올라가는 꽃잎 */
  thermM: THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>;
  thermMat: THREE.ShaderMaterial;
  inTh: boolean;
}

/** 기류 하나에 도는 꽃잎 수 */
const TH_N = 30;

const ps = new THREE.Vector3(),
  q = new THREE.Quaternion(),
  yq3 = new THREE.Quaternion(),
  hy = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  sc = new THREE.Vector3();

/** 기류를 만든다 */
export function createThermals(g: Game): Thermals {
  const data = g.L.thermal.map(({ dist, bear }) => ({
    dist,
    bear,
    v: new THREE.Vector3(),
    t1: new THREE.Vector3(),
    t2: new THREE.Vector3(),
    g: 0,
  }));
  const petalGeo = new THREE.SphereGeometry(1, 10, 8);
  const petalMat = new THREE.MeshBasicMaterial({ color: 0xffffff }) as THREE.Material;
  const petalCount = data.length * TH_N;
  const thermM = new THREE.InstancedMesh(petalGeo, petalMat, petalCount);
  const thermMat = new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color(0xffffff) } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader:
      "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `varying vec2 vUv; uniform float uT; uniform vec3 uCol;
    void main() { float band = 0.5 + 0.5 * sin(vUv.x * 18.85 + vUv.y * 15.0 - uT * 3.2), band2 = 0.5 + 0.5 * sin(vUv.x * 12.57 - vUv.y * 9.0 + uT * 1.7);
      float a = (0.06 + 0.3 * pow(band, 3.0) + 0.1 * pow(band2, 4.0)) * (1.0 - vUv.y) * smoothstep(0.0, 0.05, vUv.y);
      gl_FragColor = vec4(uCol, a);
      #include <colorspace_fragment>
    }`,
  });
  const thColGeo = new THREE.CylinderGeometry(8.5, 3.4, 64, 32, 1, true);
  const list: Thermal[] = data.map((th) => {
    const col = new THREE.Mesh(thColGeo, thermMat);
    col.frustumCulled = false;
    col.renderOrder = 2;
    const ringGeo = new THREE.TorusGeometry(5.2, 0.45, 10, 40);
    const ringMat = grey(g.mats, GREY_TOY);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    const base = new THREE.Group();
    base.add(ring);
    g.scene.add(col, base);
    return { ...th, col, ring, base };
  });
  thermM.frustumCulled = false;
  g.scene.add(thermM);
  return { list, thermM, thermMat, inTh: false };
}

/** 기류 자리: 기둥과 바닥 고리 */
export function layoutThermals(g: Game, keep: THREE.Vector3[]) {
  for (const th of g.thermals.list) {
    const spot = from(th.dist, th.bear);
    th.v.copy(spot);
    th.g = featGround(g, th.v);
    const tangent = refT(th.v);
    th.t1.copy(tangent);
    th.t2.crossVectors(th.v, th.t1).normalize();
    keep.push(th.v);
    const groundR = S.R + th.g;
    // 기둥(높이 64)의 가운데가 땅 위 32.5 에 오게 세운다
    const columnR = groundR + 32.5;
    const baseR = groundR + 0.5;
    th.col.position.copy(th.v).multiplyScalar(columnR);
    th.col.quaternion.setFromUnitVectors(UP, th.v);
    th.base.position.copy(th.v).multiplyScalar(baseR);
    th.base.quaternion.setFromUnitVectors(UP, th.v);
  }
}

/** 상승 기류: 안에 있는 동안 떠오르고, 꽃잎이 나선을 그리며 올라간다 */
export function thermalsFrame(g: Game) {
  const { pl, t, time } = g,
    p = pl.p,
    dt = t.dt,
    T = g.thermals,
    TC = g.mats.toy,
    lime = g.mats.lime;
  let th0 = false;
  if (!t.held)
    for (const th of T.list)
      if (pl.air < 64 && p.angleTo(th.v) * S.R < 5.5) {
        th0 = true;
        const liftRate = -4 * dt;
        const liftEase = 1 - Math.exp(liftRate);
        pl.vy += (6 - pl.vy) * liftEase;
        if (pl.air <= 0) pl.air = 0.01;
        break;
      }
  if (th0 && !T.inTh) say(g, "상승 기류 — 안에 있는 동안 계속 떠오릅니다");
  T.inTh = th0;
  let ti = 0;
  T.thermMat.uniforms.uT.value = time;
  for (const th of T.list) {
    const isInside = th0 && p.angleTo(th.v) * S.R < 5.5;
    const ringGlow = isInside ? 1 : 0;
    th.ring.material.color.copy(TC.whirl).lerp(lime, ringGlow);
    for (let k = 0; k < TH_N; k++) {
      // 꽃잎이 나선을 그리며 올라가고, 위로 갈수록 넓게 퍼지며 작아진다
      const ph = (time * (0.16 + (k % 5) * 0.025) + k * 0.618) % 1,
        a = ph * 13 + k * 2.4 + time * 0.6,
        r = 2.2 + ph * 5.5 + (k % 3) * 0.5;
      const across = (Math.cos(a) * r) / S.R;
      const along = (Math.sin(a) * r) / S.R;
      ps.copy(th.v).addScaledVector(th.t1, across).addScaledVector(th.t2, along).normalize();
      q.setFromUnitVectors(UP, ps);
      // 꽃잎마다 기운 축으로 굴러 돈다
      const tiltX = Math.sin(k);
      const tiltZ = Math.cos(k);
      const tumbleAxis = hy.set(tiltX, 0.3, tiltZ).normalize();
      const tumble = time * 3 + k;
      yq3.setFromAxisAngle(tumbleAxis, tumble);
      q.multiply(yq3);
      const petalR = S.R + th.g + 0.8 + ph * 60;
      ps.multiplyScalar(petalR);
      const fadeInRaw = ph * 8;
      const fadeIn = Math.min(1, fadeInRaw);
      const w = (0.55 + (k % 4) * 0.12) * (1 - ph * 0.55) * fadeIn;
      const petalSize = w * 1.5;
      sc.setScalar(petalSize);
      m4.compose(ps, q, sc);
      T.thermM.setMatrixAt(ti, m4);
      ti++;
    }
  }
  T.thermM.instanceMatrix.needsUpdate = true;
}
