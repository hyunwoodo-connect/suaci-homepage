import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import type { Frame, Thing } from "../core/frame";
import type { Tap, Tappable } from "../core/tap";
import { LOOK } from "../look";
import type { Services } from "../services";
import { S } from "../settings";
import { fr } from "./hash";
import { UP } from "./sphere";
import { SphereGrid } from "./sphereGrid";
import { FLN } from "./terrain";

// 바닥의 꽃 5200 송이: 한 송이 = 꽃잎 여섯 장 + 가운데 심 + 줄기. 지나가면 라임으로 부풀어 피고, 천천히 제 색으로 돌아온다.
// 꽃 자리·피어난 정도는 world/terrain 의 꽃 자리 값(lit)이고, 다른 것(종·장소·칙)이 피우면 그 값만 바꾼다.
// 가까운 꽃만 칸에 담아 그린다(20 프레임마다, 시제품의 v·p > 0.86)

type FlowerMesh<G extends THREE.BufferGeometry> = THREE.InstancedMesh<
  G,
  THREE.MeshStandardMaterial
>;

/** 꽃이 피는 거리(m)의 가장 큰 값: 1.3 + 가장 큰 자리 크기(1.35) × 1.5 */
const MAX_REACH = 1.3 + 1.35 * 1.5 + 0.05;

const flQ = new THREE.Quaternion(),
  flQ2 = new THREE.Quaternion(),
  flAx = new THREE.Vector3(),
  q = new THREE.Quaternion(),
  m4 = new THREE.Matrix4(),
  sc = new THREE.Vector3(),
  ps = new THREE.Vector3(),
  tc = new THREE.Color();

/** 바닥의 꽃 */
export class Flowers implements Thing, Tappable {
  private readonly petals: FlowerMesh<THREE.BufferGeometry>;
  private readonly core: FlowerMesh<THREE.SphereGeometry>;
  private readonly stem: FlowerMesh<THREE.CylinderGeometry>;
  /** 가까운 꽃만 그린다: 꽃 번호 → 그리는 칸(-1 이면 안 그림) */
  private readonly slot = new Int32Array(FLN).fill(-1);
  private readonly grid = new SphereGrid(0.02);
  private readonly near: number[] = [];
  /** 이번 프레임에 피운 꽃(같은 프레임에 다시 시들게 하지 않는다) */
  private readonly touched = new Uint32Array(FLN);
  private frameNo = 0;

  constructor(private readonly s: Services) {
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
        envMapIntensity: 0.5,
      }),
      coreMat = new THREE.MeshStandardMaterial({ color: LOOK.core, roughness: 0.25 }),
      stemMat = new THREE.MeshStandardMaterial({ color: LOOK.stem, roughness: 0.9 });
    this.petals = new THREE.InstancedMesh(flGeo, petalMat, FLN);
    const coreGeo = new THREE.SphereGeometry(0.36, 14, 10).scale(1, 0.75, 1).translate(0, 0.14, 0);
    this.core = new THREE.InstancedMesh(coreGeo, coreMat, FLN);
    const stemGeo = new THREE.CylinderGeometry(0.045, 0.06, 1, 6).translate(0, 0.5, 0);
    this.stem = new THREE.InstancedMesh(stemGeo, stemMat, FLN);
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
    for (const m of [this.petals, this.core, this.stem]) {
      m.frustumCulled = false;
      m.count = 0;
      s.scene.add(m);
    }
    // 초현실 팝에서는 바닥의 작은 뭉치가 네 가지 색 꽃밭이 된다
    const spots = s.terrain.flowers;
    for (let k = 0; k < FLN; k++) {
      spots.base[k] = LOOK.fl[k % LOOK.fl.length];
      this.grid.add(spots.v[k]);
    }
    s.culler.onCull(() => this.cull());
  }

  /** 꽃은 언덕 위에도 땅 높이에 맞춰 핀다(둔덕이 정해진 뒤) */
  settle() {
    const spots = this.s.terrain.flowers;
    for (let k = 0; k < FLN; k++) spots.g[k] = this.s.terrain.groundAt(spots.v[k]);
    this.cull();
  }

  /** 칙 둘레의 꽃이 한꺼번에 핀다 */
  onTap(tap: Tap) {
    if (tap.ground) this.s.terrain.lightFlowers(tap.ground, 144);
  }

  /** 낮게 스치면 라임으로 부풀어 피고, 천천히 제 색으로 돌아온다. 지나온 길이 라임 꽃길로 남는다 */
  update(f: Frame) {
    const spots = this.s.terrain.flowers,
      lit = spots.lit,
      { p, air } = this.s.player,
      dt = f.dt;
    this.frameNo++;
    let dirty = false;
    if (air < 5) {
      const reachChord = MAX_REACH / S.R;
      for (const k of this.grid.query(p, reachChord, this.near)) {
        const reach = 1.3 + spots.s[k] * 1.5;
        if (2 * (1 - p.dot(spots.v[k])) * S.R * S.R >= reach * reach) continue;
        lit[k] = 1;
        this.touched[k] = this.frameNo;
        dirty = true;
        this.setFlower(k, 1);
      }
    }
    for (let k = 0; k < FLN; k++) {
      const l = lit[k];
      if (l <= 0 || this.touched[k] === this.frameNo) continue;
      const faded = l - dt * 0.14;
      const nl = Math.max(0, faded);
      lit[k] = nl;
      dirty = true;
      const bloom = nl * nl * (3 - 2 * nl);
      this.setFlower(k, bloom);
    }
    if (dirty) {
      for (const m of [this.petals, this.core, this.stem]) m.instanceMatrix.needsUpdate = true;
      this.petals.instanceColor!.needsUpdate = true;
    }
  }

  /** 치운다 */
  dispose() {
    for (const m of [this.petals, this.core, this.stem]) {
      m.removeFromParent();
      m.geometry.dispose();
      m.material.dispose();
      m.dispose();
    }
  }

  // 가까운 꽃만 칸에 담아 다시 그린다
  private cull() {
    const spots = this.s.terrain.flowers,
      p = this.s.player.p,
      slot = this.slot;
    let n = 0;
    for (let k = 0; k < FLN; k++) slot[k] = spots.v[k].dot(p) > 0.86 ? n++ : -1;
    for (let k = 0; k < FLN; k++)
      if (slot[k] >= 0) {
        const l = spots.lit[k];
        const bloom = l * l * (3 - 2 * l);
        this.setFlower(k, bloom);
      }
    for (const m of [this.petals, this.core, this.stem]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
    }
    if (this.petals.instanceColor) this.petals.instanceColor.needsUpdate = true;
  }

  // 꽃 하나를 그린다. e: 0 평소, 1 활짝 핀 상태
  private setFlower(k: number, e: number) {
    const sl = this.slot[k];
    if (sl < 0) return;
    const spots = this.s.terrain.flowers;
    const v = spots.v[k],
      gr = spots.g[k],
      st = (0.45 + fr(k, 1) * 0.9) * (1 + 0.3 * e),
      sz = (spots.s[k] * 0.75 + 0.4) * (1 + 0.35 * e),
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
    this.petals.setMatrixAt(sl, m4);
    this.core.setMatrixAt(sl, m4);
    const stemRadius = S.R + gr - 0.15;
    ps.copy(v).multiplyScalar(stemRadius);
    const stemLength = st + 0.15;
    sc.set(1, stemLength, 1);
    m4.compose(ps, q, sc);
    this.stem.setMatrixAt(sl, m4);
    const petalColor = tc.set(spots.base[k]).lerp(this.s.mats.lime, e);
    this.petals.setColorAt(sl, petalColor);
  }
}
