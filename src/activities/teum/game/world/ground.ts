import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { LOOK } from "../look";
import type { Services } from "../services";
import { S } from "../settings";

// 구름 바닥과 부푼 구름:
// 바닥은 단색 대신 두 색이 얼룩지게 번지고, 느린 구름 그림자가 지나가고, 비스듬히 보이는 가장자리는 하늘빛으로 밝아진다.
// 부푼 구름(동산·둔덕·하늘 구름)은 가장자리가 밝게 번져 솜처럼 보인다.
// 땅 셰이더 값은 행성·둔덕·큰 언덕이 같이 쓴다(구름 그림자 시간이 함께 흐른다)

/** 땅 셰이더가 같이 쓰는 값 */
export interface GroundUniforms {
  [name: string]: THREE.IUniform;
  uA: { value: THREE.Color };
  uB: { value: THREE.Color };
  uRim: { value: THREE.Color };
  uRimK: { value: number };
  uInvR: { value: number };
  uT: { value: number };
  uGrass: { value: number };
  uPk: { value: THREE.Color };
  /** 마을 중심 여섯(체커 색을 바꾸는 자리) */
  uHubV: { value: THREE.Vector3[] };
  uHubC: { value: THREE.Color[] };
}

/** 부푼 구름 셰이더가 같이 쓰는 값 */
export interface PuffUniforms {
  [name: string]: THREE.IUniform;
  uRim: { value: THREE.Color };
  uRimK: { value: number };
}

const RIM_GLSL = `
  float teumFr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uRim, teumFr * uRimK);
  #include <dithering_fragment>`;

/** 행성과 땅 재질 */
export class Ground implements Thing {
  readonly GND: GroundUniforms;
  readonly PUF: PuffUniforms;
  /** 행성 공(칙이 땅을 맞히는 곳) */
  readonly planet: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;

  constructor(private readonly s: Services) {
    // 반지름 1 로 만들고 배치에서 S.R 만큼 키운다
    const planetGeo = new THREE.SphereGeometry(1, 256, 180);
    const planetMat = s.mats.matte(0xdadddc);
    this.planet = new THREE.Mesh(planetGeo, planetMat);
    s.scene.add(this.planet);
    const hubV = [0, 1, 2, 3, 4, 5].map((i) => {
      const hub = s.occ.hubs[i];
      return hub ? hub.clone() : new THREE.Vector3(0, 1, 0);
    });
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
      uHubC: {
        value: [0xff5fa8, 0x8a5cff, 0x3f8cff, 0xff7a4a, 0xffffff, 0xb07cff].map(
          (c) => new THREE.Color(c),
        ),
      },
    };
    this.PUF = { uRim: { value: new THREE.Color(0xffffff) }, uRimK: { value: 0.55 } };
    this.groundify(planetMat);
  }

  /** 행성을 세계 크기로 키운다 */
  layout() {
    this.planet.scale.setScalar(S.R);
    this.GND.uInvR.value = 1 / S.R;
  }

  /** 땅 재질: 체커 무늬 땅, 마을마다 다른 색 광장, 구름 그림자, 가까운 곳의 잔디 결 */
  groundify(mat: THREE.MeshStandardMaterial) {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.GND);
      sh.vertexShader =
        "varying vec3 vWp;\n" +
        sh.vertexShader.replace(
          "#include <project_vertex>",
          "#include <project_vertex>\n  #ifdef USE_INSTANCING\n  vWp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n  #else\n  vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  #endif",
        );
      sh.fragmentShader =
        `varying vec3 vWp; uniform vec3 uA; uniform vec3 uB; uniform vec3 uRim; uniform float uRimK; uniform float uInvR; uniform float uT; uniform float uGrass; uniform vec3 uPk; uniform vec3 uHubV[6]; uniform vec3 uHubC[6];
        float teumH(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float teumN(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(teumH(i), teumH(i + vec3(1, 0, 0)), f.x), mix(teumH(i + vec3(0, 1, 0)), teumH(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(teumH(i + vec3(0, 0, 1)), teumH(i + vec3(1, 0, 1)), f.x), mix(teumH(i + vec3(0, 1, 1)), teumH(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
        ` +
        sh.fragmentShader
          .replace(
            "#include <color_fragment>",
            `#include <color_fragment>
        vec3 tq = vWp * uInvR; float tn = teumN(tq * 14.0) * 0.65 + teumN(tq * 47.0) * 0.35;
        float tsh = smoothstep(0.5, 0.8, teumN(tq * 4.0 + vec3(uT * 0.012, 0.0, uT * 0.008)));
        vec3 aW = abs(normalize(vWp)); vec2 cuv = (aW.y >= aW.x && aW.y >= aW.z) ? vWp.xz : (aW.x >= aW.z ? vWp.yz : vWp.xy); // 공 전체에서 체커가 되게: 가장 가까운 축 면에 펴서 그린다
        vec2 cq = floor(cuv / 13.0); float ck = mod(cq.x + cq.y, 2.0); // 체커 무늬 땅: 광장 둘레는 분홍·초록, 그 밖은 진초록·연초록
        vec3 cB = uB, nW = normalize(vWp); for (int i = 0; i < 6; i++) if (dot(nW, uHubV[i]) > 0.9912) cB = uHubC[i]; // 마을 광장마다 다른 색 체커
        diffuseColor.rgb = mix(uA, cB, ck) * (0.96 + 0.07 * tn) * (1.0 - 0.05 * tsh);
        // 잔디 결: 가까운 곳에서만 잘게 얼룩지고, 군데군데 햇빛 받은 연두가 섞인다
        float gf = (1.0 - smoothstep(16.0, 85.0, length(vViewPosition))) * uGrass;
        float g1 = teumN(vWp * 4.5), g2 = teumN(vWp * 17.0), g3 = teumN(vWp * 46.0);
        diffuseColor.rgb *= 1.0 + gf * ((g3 - 0.5) * 0.16 + (g2 - 0.5) * 0.12 + (g1 - 0.5) * 0.06);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.16, 1.08, 0.7), gf * smoothstep(0.6, 0.9, g1) * 0.2);`,
          )
          .replace("#include <dithering_fragment>", RIM_GLSL);
    };
    mat.customProgramCacheKey = () => "teum-ground4";
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
