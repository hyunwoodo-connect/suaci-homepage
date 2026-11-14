import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { GreyMesh } from "../look";
import { LOOK } from "../look";
import type { Services } from "../services";
import { GREY_TOY, S } from "../settings";
import { from, refTInto, UP } from "../world/sphere";

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

/** 날아다니는 꽃잎 모양(바람길과 같이 쓴다) */
export interface PetalLook {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
}

/** 기류 하나에 도는 꽃잎 수 */
const TH_N = 30;

const ps = new THREE.Vector3(),
  q = new THREE.Quaternion(),
  yq3 = new THREE.Quaternion(),
  hy = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  sc = new THREE.Vector3(),
  tc = new THREE.Color();

/** 상승 기류 전체 */
export class Thermals implements Thing {
  readonly list: Thermal[];
  /** 기류에 말려 올라가는 꽃잎 */
  readonly thermM: THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>;
  private readonly thermMat: THREE.ShaderMaterial;
  private inTh = false;
  private readonly colGeo = new THREE.CylinderGeometry(8.5, 3.4, 64, 32, 1, true);
  private readonly ringGeo = new THREE.TorusGeometry(5.2, 0.45, 10, 40);
  /** 꽃잎 모양이 오기 전의 자리 채움(usePetals 가 바꾼다) */
  private readonly stubGeo = new THREE.SphereGeometry(1, 10, 8);
  private readonly stubMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  constructor(private readonly s: Services) {
    const data = s.layout.thermal.map(({ dist, bear }) => ({
      dist,
      bear,
      v: new THREE.Vector3(),
      t1: new THREE.Vector3(),
      t2: new THREE.Vector3(),
      g: 0,
    }));
    const petalCount = data.length * TH_N;
    this.thermM = new THREE.InstancedMesh(this.stubGeo, this.stubMat, petalCount);
    this.thermMat = new THREE.ShaderMaterial({
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
    this.list = data.map((th) => {
      const col = new THREE.Mesh(this.colGeo, this.thermMat);
      col.frustumCulled = false;
      col.renderOrder = 2;
      // 기류마다 안에 든 것만 라임으로 물들어 고리 재질은 따로
      const ringMat = s.mats.grey(GREY_TOY);
      const ring = new THREE.Mesh(this.ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      const base = new THREE.Group();
      base.add(ring);
      s.scene.add(col, base);
      return { ...th, col, ring, base };
    });
    this.thermM.frustumCulled = false;
    s.scene.add(this.thermM);
  }

  /** 자리: 기둥과 바닥 고리 */
  layout(keep: THREE.Vector3[]) {
    const { terrain, culler } = this.s;
    for (const th of this.list) {
      const spot = from(th.dist, th.bear);
      th.v.copy(spot);
      th.g = terrain.featGround(th.v);
      refTInto(th.t1, th.v);
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
      culler.track(th.col, th.v);
      culler.track(th.base, th.v);
    }
  }

  /** 자리 차지: 기둥 둘레, 그리고 떠오르는 길(비행 통로) */
  claim() {
    for (const th of this.list) {
      this.s.occ.fill(th.v, 5);
      this.s.occ.addCorridor(th.v, 8);
    }
  }

  /** 꽃잎 모양을 받는다(바람길과 같은 얇은 잎). 꽃잎마다 꽃밭 색을 돌려 칠한다 */
  usePetals(petals: PetalLook) {
    const thermM = this.thermM;
    thermM.geometry = petals.geo;
    thermM.material = petals.mat;
    const FL = LOOK.fl;
    for (let k = 0; k < thermM.count; k++) {
      const hex = FL[k % FL.length];
      tc.set(hex);
      thermM.setColorAt(k, tc);
    }
    thermM.instanceColor!.needsUpdate = true;
    this.thermMat.uniforms.uCol.value.set(0xffffff);
  }

  /** 안에 있는 동안 떠오르고, 꽃잎이 나선을 그리며 올라간다 */
  update(f: Frame) {
    const { player, mats, hud } = this.s,
      p = player.p,
      dt = f.dt,
      time = f.time;
    let th0 = false;
    if (!player.held)
      for (const th of this.list)
        if (player.air < 64 && p.angleTo(th.v) * S.R < 5.5) {
          th0 = true;
          const liftEase = ease(4, dt);
          player.easeLift(6, liftEase);
          break;
        }
    if (th0 && !this.inTh) hud.say("상승 기류 — 안에 있는 동안 계속 떠오릅니다");
    this.inTh = th0;
    let ti = 0;
    this.thermMat.uniforms.uT.value = time;
    for (const th of this.list) {
      const isInside = th0 && p.angleTo(th.v) * S.R < 5.5;
      const ringGlow = isInside ? 1 : 0;
      th.ring.material.color.copy(mats.toy.whirl).lerp(mats.lime, ringGlow);
      for (let k = 0; k < TH_N; k++) {
        // 꽃잎이 나선을 그리며 올라가고, 위로 갈수록 넓게 퍼지며 작아진다
        const ph = (time * (0.16 + (k % 5) * 0.025) + k * 0.618) % 1,
          a = ph * 13 + k * 2.4 + time * 0.6,
          r = 2.2 + ph * 5.5 + (k % 3) * 0.5;
        const across = (Math.cos(a) * r) / S.R;
        const alongT2 = (Math.sin(a) * r) / S.R;
        ps.copy(th.v).addScaledVector(th.t1, across).addScaledVector(th.t2, alongT2).normalize();
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
        this.thermM.setMatrixAt(ti, m4);
        ti++;
      }
    }
    this.thermM.instanceMatrix.needsUpdate = true;
  }

  /** 치운다(꽃잎 모양은 바람길과 같이 쓰는 것이라 두고 간다) */
  dispose() {
    for (const th of this.list) {
      th.col.removeFromParent();
      th.base.removeFromParent();
      th.ring.material.dispose();
    }
    this.thermM.removeFromParent();
    this.thermM.dispose();
    this.colGeo.dispose();
    this.ringGeo.dispose();
    this.stubGeo.dispose();
    this.stubMat.dispose();
    this.thermMat.dispose();
  }
}
