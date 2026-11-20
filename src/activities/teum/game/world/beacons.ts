import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { LayoutLandmark } from "../maps/layout";
import type { Services } from "../services";
import { LIME, S } from "../settings";
import { from } from "./sphere";

// 빛 기둥(기획 MAP-02 3장): 아직 안 한 게임의 랜드마크 꼭대기 위로 높이 120m, 그 지역 색의 반투명 기둥.
// 기둥 끝에 라임 리본이 펄럭인다(리본이라 라임 허용). 경계에 들어서면 기둥 끝이 먼저 보이고 다가갈수록 랜드마크가 솟는다.
// 3단 디저트 스탠드는 모델이 오기 전까지 임시 모델(케이크) 둘레에 도형 접시 셋을 함께 세운다

/** 기둥 높이(m)·반지름(m) · 끝 리본 크기(m) */
const PILLAR = { height: 120, radius: 5.5 } as const;
const RIBBON = { w: 9, h: 3.2 } as const;
/** 3단 디저트 스탠드의 임시 접시: [높이 m, 지름 m] (기획 MAP-02 3장) · 접시 두께(m) */
const STAND_PLATES: readonly (readonly [number, number])[] = [
  [16, 68],
  [34, 48],
  [50, 28],
];
const PLATE_THICK = 1.6;
const STAND_NAME = "3단 디저트 스탠드";
const UP = new THREE.Vector3(0, 1, 0);

/** 빛 기둥 하나 */
interface Beacon {
  root: THREE.Group;
  ribbon: THREE.Mesh;
  phase: number;
}

/** 랜드마크마다 빛 기둥 */
export class Beacons implements Thing {
  private readonly list: Beacon[] = [];
  private readonly geo: THREE.CylinderGeometry;
  private readonly ribbonGeo: THREE.PlaneGeometry;
  private readonly ribbonMat: THREE.MeshBasicMaterial;
  private readonly mats: THREE.ShaderMaterial[] = [];
  private readonly extras: { dispose(): void }[] = [];
  private readonly extraRoots: THREE.Object3D[] = [];

  constructor(private readonly s: Services) {
    this.geo = new THREE.CylinderGeometry(PILLAR.radius, PILLAR.radius, PILLAR.height, 24, 1, true);
    const half = PILLAR.height / 2;
    this.geo.translate(0, half, 0);
    this.ribbonGeo = new THREE.PlaneGeometry(RIBBON.w, RIBBON.h, 10, 2);
    const ribbonHalf = RIBBON.w / 2;
    this.ribbonGeo.translate(ribbonHalf, 0, 0);
    this.ribbonMat = new THREE.MeshBasicMaterial({ color: LIME, side: THREE.DoubleSide });
    for (const land of s.layout.landmark ?? []) {
      const beacon = this.build(land);
      this.list.push(beacon);
      if (land.name === STAND_NAME) this.standPlates(land);
    }
  }

  /** 리본이 펄럭이고 기둥이 숨 쉬듯 일렁인다 */
  update(f: Frame) {
    for (const b of this.list) {
      const wave = f.time * 3 + b.phase;
      b.ribbon.rotation.y = Math.sin(wave) * 0.5;
    }
    for (const m of this.mats) (m.uniforms.uT as { value: number }).value = f.time;
  }

  /** 치운다 */
  dispose() {
    for (const b of this.list) b.root.removeFromParent();
    this.geo.dispose();
    this.ribbonGeo.dispose();
    this.ribbonMat.dispose();
    for (const m of this.mats) m.dispose();
    for (const r of this.extraRoots) r.removeFromParent();
    for (const e of this.extras) e.dispose();
  }

  // 임시 스탠드 접시 셋(흰 도자기 원판)
  private standPlates(land: LayoutLandmark) {
    const { s } = this;
    const v = from(land.dist, land.bear);
    const ground = s.terrain.featGround(v);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
    const root = new THREE.Group();
    for (const [h, d] of STAND_PLATES) {
      const radius = d / 2;
      const under = radius * 0.92;
      const geo = new THREE.CylinderGeometry(radius, under, PLATE_THICK, 48);
      const plate = new THREE.Mesh(geo, mat);
      plate.position.y = h;
      root.add(plate);
      this.extras.push(geo);
    }
    this.extras.push(mat);
    const at = S.R + ground;
    root.position.copy(v).multiplyScalar(at);
    root.quaternion.setFromUnitVectors(UP, v);
    s.scene.add(root);
    this.extraRoots.push(root);
  }

  // 랜드마크 꼭대기(떠 있는 섬은 뜬 높이 위)에서 하늘로
  private build(land: LayoutLandmark): Beacon {
    const { s } = this;
    const v = from(land.dist, land.bear);
    const ground = s.terrain.featGround(v);
    const region = s.map.regions[land.region];
    const sky = region ? region.sky : 0xffffff;
    const color = new THREE.Color(sky);
    const mat = pillarMaterial(color);
    this.mats.push(mat);
    const pillar = new THREE.Mesh(this.geo, mat);
    pillar.renderOrder = 3;
    pillar.frustumCulled = false;
    const ribbon = new THREE.Mesh(this.ribbonGeo, this.ribbonMat);
    ribbon.position.y = PILLAR.height;
    const root = new THREE.Group();
    root.add(pillar, ribbon);
    const radius = S.R + ground + land.height;
    root.position.copy(v).multiplyScalar(radius);
    root.quaternion.setFromUnitVectors(UP, v);
    s.scene.add(root);
    const phase = land.region * 1.3;
    return { root, ribbon, phase };
  }
}

/* ─── 내부 ─────────────────────────── */

// 천천히 오르는 결이 있는 반투명 기둥 — 지평선 너머에서 끝만 보일 때도 읽히게 위쪽도 거의 옅어지지 않는다
function pillarMaterial(color: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uCol: { value: color } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader:
      "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `varying vec2 vUv; uniform float uT; uniform vec3 uCol;
    void main() { float band = 0.5 + 0.5 * sin(vUv.y * 40.0 - uT * 2.0);
      float a = (0.6 + 0.2 * band) * (1.0 - vUv.y * 0.25) * smoothstep(0.0, 0.04, vUv.y);
      gl_FragColor = vec4(mix(uCol, vec3(1.0), 0.12), a);
      #include <colorspace_fragment>
    }`,
  });
}
