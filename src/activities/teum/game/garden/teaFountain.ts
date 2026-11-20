import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Services } from "../services";
import { S } from "../settings";
import { from } from "../world/sphere";
import { SPARKLE_DOT, SparklePoints } from "../zones/sparkles";

// 티 분수(기획 MAP-03 3장 광장): 분수 탑(fountaintower)에 물 대신 분홍 차가 그릇마다 고이고 그릇 끝에서 흘러내리며, 김이 오른다.
// 그릇 자리는 분수 탑 모델(키 1)을 재 둔 값 — 그릇 윗면 높이·차 수면 반지름·흘러내리는 가장자리 반지름(키의 몫)

/** 그릇 셋(아래부터): 수면 높이 · 수면 반지름 · 흘러내리는 가장자리 반지름 · 흘러내려 닿는 높이(키의 몫) */
const BOWLS: readonly { y: number; r: number; rim: number; to: number }[] = [
  { y: 0.22, r: 0.31, rim: 0.35, to: 0.02 },
  { y: 0.52, r: 0.24, rim: 0.27, to: 0.22 },
  { y: 0.77, r: 0.15, rim: 0.18, to: 0.52 },
];
/** 차 색(분홍) · 김 수 · 김이 다 오르는 시간(초) · 오르는 높이(m) */
const TEA = 0xff9ec4;
const STEAM = { count: 42, climb: 4.5, rise: 9 } as const;

/** 김 하나 */
interface Puff {
  a: number;
  r: number;
  from: number;
  phase: number;
}

/** 티 분수 */
export class TeaFountain implements Thing {
  private readonly root = new THREE.Group();
  private readonly v: THREE.Vector3;
  private readonly h: number;
  private readonly flowMat: THREE.ShaderMaterial;
  private readonly steam: SparklePoints;
  private readonly puffs: Puff[] = [];
  private readonly owned: { dispose(): void }[] = [];
  private readonly tmp = new THREE.Vector3();
  private readonly white = new THREE.Color(0xffffff);

  /** 꾸밈의 분수 탑 자리(v)·키(h, m) */
  constructor(
    private readonly s: Services,
    v: THREE.Vector3,
    h: number,
  ) {
    this.v = v;
    this.h = h;
    const pool = new THREE.MeshStandardMaterial({ color: TEA, roughness: 0.15 });
    const teaColor = new THREE.Color(TEA);
    this.flowMat = flowMaterial(teaColor);
    this.owned.push(pool, this.flowMat);
    for (const bowl of BOWLS) {
      const radius = bowl.r * h;
      const surfaceGeo = new THREE.CircleGeometry(radius, 40);
      const flat = -Math.PI / 2;
      surfaceGeo.rotateX(flat);
      const surface = new THREE.Mesh(surfaceGeo, pool);
      surface.position.y = bowl.y * h;
      const drop = (bowl.y - bowl.to) * h;
      const rimR = bowl.rim * h;
      const rimLow = rimR * 1.04;
      const curtainGeo = new THREE.CylinderGeometry(rimR, rimLow, drop, 40, 1, true);
      const halfDrop = drop / 2;
      curtainGeo.translate(0, -halfDrop, 0);
      const curtain = new THREE.Mesh(curtainGeo, this.flowMat);
      curtain.position.y = bowl.y * h;
      curtain.renderOrder = 2;
      this.root.add(surface, curtain);
      this.owned.push(surfaceGeo, curtainGeo);
    }
    this.steam = new SparklePoints(STEAM.count);
    this.root.add(this.steam.points);
    const rng = s.rng.fork("tea");
    for (let i = 0; i < STEAM.count; i++) {
      const bowl = BOWLS[i % BOWLS.length];
      const a = rng.next() * Math.PI * 2;
      const r = rng.next() * bowl.r * h;
      const phase = rng.next();
      const start = bowl.y * h;
      this.puffs.push({ a, r, from: start, phase });
    }
    s.scene.add(this.root);
  }

  /** 땅 높이가 정해진 뒤 자리를 잡는다 */
  layout() {
    const ground = this.s.terrain.featGround(this.v);
    const radius = S.R + ground;
    this.root.position.copy(this.v).multiplyScalar(radius);
    this.root.quaternion.setFromUnitVectors(UP, this.v);
  }

  /** 차가 흘러내리고 김이 오른다 */
  update(f: Frame) {
    (this.flowMat.uniforms.uT as { value: number }).value = f.time;
    this.puffs.forEach((puff, i) => {
      const lap = f.time / STEAM.climb + puff.phase;
      const share = lap - Math.floor(lap);
      const y = puff.from + share * STEAM.rise;
      const drift = puff.r + share * 1.5;
      const x = Math.cos(puff.a) * drift,
        z = Math.sin(puff.a) * drift;
      this.tmp.set(x, y, z);
      const arc = share * Math.PI;
      const alpha = Math.sin(arc) * 0.35;
      const size = 1.4 + share * 1.6;
      this.steam.set(i, this.tmp, this.white, SPARKLE_DOT, size, alpha);
    });
    const cam = this.s.camera.camera;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const viewHeight = innerHeight * dpr;
    this.steam.commit(viewHeight, cam.fov);
  }

  /** 치운다 */
  dispose() {
    this.root.removeFromParent();
    this.steam.dispose();
    for (const o of this.owned) o.dispose();
  }
}

/** 꾸밈에서 분수 탑을 찾아 티 분수를 만든다(없으면 null) */
export function teaFountainOf(s: Services): TeaFountain | null {
  const spot = s.layout.decor?.find((d) => d.model === "fountaintower");
  if (!spot) return null;
  const v = from(spot.dist, spot.bear);
  return new TeaFountain(s, v, spot.h);
}

/* ─── 내부 ─────────────────────────── */

const UP = new THREE.Vector3(0, 1, 0);

// 흘러내리는 차: 아래로 흐르는 결, 아래로 갈수록 옅게
function flowMaterial(color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uCol: { value: color } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader:
      "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `varying vec2 vUv; uniform float uT; uniform vec3 uCol;
    void main() { float flow = 0.5 + 0.5 * sin(vUv.y * 28.0 + uT * 7.0 + sin(vUv.x * 60.0) * 1.5);
      float a = (0.4 + 0.25 * flow) * (0.35 + 0.65 * vUv.y);
      gl_FragColor = vec4(mix(uCol, vec3(1.0), 0.15 * flow), a);
      #include <colorspace_fragment>
    }`,
  });
}
