import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { LookUniforms } from "../look";
import { KEY_GLSL, KEY_HOLD_GLSL, LOOK } from "../look";
import type { Services } from "../services";
import { S } from "../settings";

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
  /** 끝 장면의 라임 물결(톤 값과 같은 것 — look.ts) */
  uFlood: LookUniforms["flood"];
}

/** 부푼 구름 셰이더가 같이 쓰는 값 */
interface PuffUniforms {
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
          "#include <project_vertex>\n  #ifdef USE_INSTANCING\n  vWp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;\n  #else\n  vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;\n  #endif",
        );
      sh.fragmentShader =
        `#define TEUM_REGIONS ${regions}
        #define TEUM_SEA ${sea}
        #if TEUM_SEA > 0
        uniform vec3 uLandC; uniform float uLandCos;
        #endif
        varying vec3 vWp; uniform vec3 uA; uniform vec3 uB; uniform vec3 uRim; uniform float uRimK; uniform float uInvR; uniform float uT; uniform float uGrass; uniform vec3 uPk; uniform vec4 uFlood;
        #if TEUM_REGIONS > 0
        uniform vec3 uHubV[TEUM_REGIONS]; uniform vec3 uRegA[TEUM_REGIONS]; uniform vec3 uRegB[TEUM_REGIONS]; uniform vec2 uRegE;
        #endif
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
        vec2 cq = floor(cuv / 13.0); float ck = mod(cq.x + cq.y, 2.0); // 체커 무늬 땅
        vec3 cA = uA, cB = uB;
        #if TEUM_REGIONS > 0
        { vec3 nW = normalize(vWp), rA = uA, rB = uB; float rb = -1.0; for (int i = 0; i < TEUM_REGIONS; i++) { float dH = dot(nW, uHubV[i]); if (dH > rb) { rb = dH; rA = uRegA[i]; rB = uRegB[i]; } } float rw = smoothstep(uRegE.x, uRegE.x + uRegE.y, rb); // 지역마다 다른 색 체커, 사이는 옅게
          cA = mix(mix(uA, vec3(0.93), 0.45), rA, rw); cB = mix(mix(uB, vec3(0.93), 0.45), rB, rw); }
        #endif
        // 끝 장면의 라임 물결: 닿은 자리는 라임과 옅은 라임 체커(물결 끝은 얼룩 결을 따라 울퉁불퉁하다)
        float fdAt = dot(normalize(vWp), uFlood.xyz) + (tn - 0.5) * 0.0012;
        float fdOn = smoothstep(uFlood.w, uFlood.w + 0.0004, fdAt);
        cA = mix(cA, ${KEY_GLSL}, fdOn); cB = mix(cB, mix(${KEY_GLSL}, vec3(1.0), 0.55), fdOn);
        diffuseColor.rgb = mix(cA, cB, ck) * (0.96 + 0.07 * tn) * (1.0 - 0.05 * tsh);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), (1.0 - smoothstep(0.0, 0.0016, abs(fdAt - uFlood.w))) * 0.9);
        float seaK = 0.0;
        #if TEUM_SEA > 0
        { // 물가 밖은 바다: 파란 물 타일이 일렁이고, 물가 안쪽 20m 는 모래, 물가 선에는 거품이 드나든다(코사인 0.002 가 약 1m)
          float lc = dot(normalize(vWp), uLandC) - uLandCos;
          float wave = 0.004 * sin(uT * 0.9 + tn * 9.0);
          seaK = 1.0 - smoothstep(-0.006, 0.006, lc + wave);
          float swell = teumN(tq * 70.0 + vec3(uT * 0.06, uT * 0.04, 0.0));
          vec3 water = mix(vec3(0.07, 0.4, 0.95), vec3(0.2, 0.56, 1.0), ck) * (0.9 + 0.2 * swell);
          vec3 sand = vec3(1.0, 0.95, 0.81) * (0.97 + 0.06 * tn);
          diffuseColor.rgb = mix(sand, diffuseColor.rgb, smoothstep(0.0, 0.04, lc));
          diffuseColor.rgb = mix(diffuseColor.rgb, water, seaK);
          float foam = 1.0 - smoothstep(0.0, 0.005, abs(lc + wave));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), foam * 0.85); }
        #endif
        // 잔디 결: 가까운 곳에서만 잘게 얼룩지고, 군데군데 햇빛 받은 자리가 밝다(바다에는 없다). 연두를 섞지 않는다 — 라임 둘레 색은 쓰지 않는다
        float gf = (1.0 - smoothstep(16.0, 85.0, length(vViewPosition))) * uGrass * (1.0 - seaK);
        float g1 = teumN(vWp * 4.5), g2 = teumN(vWp * 17.0), g3 = teumN(vWp * 46.0);
        diffuseColor.rgb *= 1.0 + gf * ((g3 - 0.5) * 0.16 + (g2 - 0.5) * 0.12 + (g1 - 0.5) * 0.06);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.1, gf * smoothstep(0.6, 0.9, g1) * 0.2);`,
          )
          .replace("#include <opaque_fragment>", `${KEY_HOLD_GLSL}\n#include <opaque_fragment>`)
          .replace("#include <dithering_fragment>", RIM_GLSL);
    };
    mat.customProgramCacheKey = () => "teum-ground7-r" + regions + "-s" + sea;
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
