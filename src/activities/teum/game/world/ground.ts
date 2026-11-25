import * as THREE from "three";

import { KEY_HOLD_GLSL } from "@/lib/asset-kit/material";

import type { Frame, Thing } from "../core/frame";
import type { FloodUniform } from "../keyColor";
import { LOOK } from "../look";
import type { Services } from "../services";
import { S } from "../settings";
import { GROUND_AT_GLSL, GROUND_COLOR_GLSL, groundHeadGlsl, RIM_GLSL } from "./groundGlsl";

// 구름 바닥과 부푼 구름:
// 바닥은 단색 대신 두 색이 얼룩지게 번지고, 느린 구름 그림자가 지나가고, 비스듬히 보이는 가장자리는 하늘빛으로 밝아진다.
// 부푼 구름(동산·둔덕·하늘 구름)은 가장자리가 밝게 번져 솜처럼 보인다.
// 땅 셰이더 값은 행성·둔덕·큰 언덕이 같이 쓴다(구름 그림자 시간이 함께 흐른다)

/** 땅 셰이더가 같이 쓰는 값 */
interface GroundUniforms {
  [name: string]: THREE.IUniform;
  uA: { value: THREE.Color };
  uB: { value: THREE.Color };
  uRim: { value: THREE.Color };
  uRimK: { value: number };
  uInvR: { value: number };
  uT: { value: number };
  uGrass: { value: number };
  uPk: { value: THREE.Color };
  /** 마을 중심(지역 차례)과 지역마다 체커 두 색, 지역 테두리(코사인 from, width) */
  uHubV: { value: THREE.Vector3[] };
  uRegA: { value: THREE.Color[] };
  uRegB: { value: THREE.Color[] };
  uRegE: { value: THREE.Vector2 };
  /** 뭍의 가운데와 물가의 코사인(바다가 있는 지도만 쓴다) */
  uLandC: { value: THREE.Vector3 };
  uLandCos: { value: number };
  /** 끝 장면의 라임 물결(톤 값과 같은 것 — keyColor.ts) */
  uFlood: FloodUniform;
}

/** 부푼 구름 셰이더가 같이 쓰는 값 */
interface PuffUniforms {
  [name: string]: THREE.IUniform;
  uRim: { value: THREE.Color };
  uRimK: { value: number };
}

/** 행성과 땅 재질 */
export class Ground implements Thing {
  readonly GND: GroundUniforms;
  readonly PUF: PuffUniforms;
  /** 행성 공(칙이 땅을 맞히는 곳) */
  readonly planet: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;

  constructor(private readonly s: Services) {
    // 반지름 1 로 만들고 배치에서 S.R 만큼 키운다
    const planetGeo = new THREE.SphereGeometry(1, 192, 136);
    const planetMat = s.mats.matte(0xdadddc);
    this.planet = new THREE.Mesh(planetGeo, planetMat);
    s.scene.add(this.planet);
    const hubV = s.occ.hubs.map((hub) => hub.clone()),
      regions = s.map.regions,
      edge = s.map.regionEdge;
    this.GND = {
      uA: { value: new THREE.Color(LOOK.gA) },
      uB: { value: new THREE.Color(LOOK.gB) },
      uRim: { value: new THREE.Color(LOOK.rim) },
      uRimK: { value: 0.85 },
      uInvR: { value: 1 / S.R },
      uT: { value: 0 },
      // 초현실 팝: 가까운 곳에 잔디 결
      uGrass: { value: 1 },
      uPk: { value: new THREE.Color(0xff5fa8) },
      uHubV: { value: hubV },
      uRegA: { value: regions.map((r) => new THREE.Color(r.ground[0])) },
      uRegB: { value: regions.map((r) => new THREE.Color(r.ground[1])) },
      uRegE: { value: new THREE.Vector2(edge.from, edge.width) },
      uLandC: { value: s.land.centre?.clone() ?? new THREE.Vector3(0, 1, 0) },
      uLandCos: { value: s.land.cos },
      uFlood: s.mats.lookU.flood,
    };
    this.PUF = { uRim: { value: new THREE.Color(0xffffff) }, uRimK: { value: 0.55 } };
    this.groundify(planetMat);
  }

  /** 행성을 세계 크기로 키운다 */
  layout() {
    this.planet.scale.setScalar(S.R);
    this.GND.uInvR.value = 1 / S.R;
  }

  /**
   * 땅 재질: 체커 무늬 땅(지역마다 두 색, 지역 사이는 옅은 중립색), 구름 그림자, 가까운 곳의 잔디 결.
   * 끝 장면에는 라임 물결이 닿은 자리부터 체커가 라임과 옅은 라임이 된다(물결 끝에는 흰 거품 선, 바다는 물들지 않는다)
   */
  groundify(mat: THREE.MeshStandardMaterial) {
    const regions = this.GND.uRegA.value.length;
    // 바다가 없는 지도는 바다 셈을 셰이더에 넣지 않는다
    const sea = this.s.land.centre ? 1 : 0;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.GND);
      sh.vertexShader =
        "varying vec3 vWp;\n" +
        sh.vertexShader.replace(
          "#include <project_vertex>",
          `#include <project_vertex>${GROUND_AT_GLSL}`,
        );
      const head = groundHeadGlsl(regions, sea);
      sh.fragmentShader =
        head +
        sh.fragmentShader
          .replace("#include <color_fragment>", GROUND_COLOR_GLSL)
          .replace("#include <opaque_fragment>", `${KEY_HOLD_GLSL}\n#include <opaque_fragment>`)
          .replace("#include <dithering_fragment>", RIM_GLSL);
    };
    mat.customProgramCacheKey = () => "teum-ground8-r" + regions + "-s" + sea;
  }

  /** 부푼 구름 재질: 가장자리가 밝게 번진다 */
  puffify(mat: THREE.MeshStandardMaterial) {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.PUF);
      sh.fragmentShader =
        "uniform vec3 uRim; uniform float uRimK;\n" +
        sh.fragmentShader.replace("#include <dithering_fragment>", RIM_GLSL);
    };
    mat.customProgramCacheKey = () => "teum-puff";
  }

  /** 구름 그림자가 흐른다 */
  update(f: Frame) {
    this.GND.uT.value = f.time;
  }

  /** 치운다 */
  dispose() {
    this.planet.removeFromParent();
    this.planet.geometry.dispose();
    this.planet.material.dispose();
  }
}
