import { KEY_GLSL } from "../keyColor";

// 땅 셰이더 조각: 체커 무늬 땅(지역마다 두 색, 지역 사이는 옅은 중립색) → 끝 장면의 라임 물결 → 바다·모래·거품 → 가까운 곳의 잔디 결.
// 땅 재질(행성·둔덕·큰 언덕)이 같이 쓴다 — 붙이는 곳은 ground.ts 의 groundify

/** 가장자리가 하늘빛으로 밝아진다(땅과 부푼 구름이 같이 쓴다) — dithering_fragment 자리에 넣는다 */
export const RIM_GLSL = `
  float teumFr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uRim, teumFr * uRimK);
  #include <dithering_fragment>`;

/** 세계 자리(vWp)를 조각 셰이더로 넘긴다 — project_vertex 뒤에 넣는다 */
export const GROUND_AT_GLSL = `
  #ifdef USE_INSTANCING
  vWp = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
  #else
  vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;
  #endif`;

/** 조각 셰이더 머리: 지역 수(regions)·바다가 있나(sea 0|1)에 맞춘 값 선언과 얼룩 결(teumN) */
export function groundHeadGlsl(regions: number, sea: number): string {
  return `#define TEUM_REGIONS ${regions}
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
        `;
}

// 체커 무늬 땅: 얼룩 결(tn)과 구름 그림자(tsh), 지역마다 다른 두 색, 끝 장면의 라임 물결
const CHECKER_GLSL = `
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
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), (1.0 - smoothstep(0.0, 0.0016, abs(fdAt - uFlood.w))) * 0.9);`;

// 물가 밖은 바다: 파란 물 타일이 일렁이고, 물가 안쪽 20m 는 모래, 물가 선에는 거품이 드나든다(코사인 0.002 가 약 1m).
// 바다가 없는 지도는 이 셈이 셰이더에 들어가지 않는다(TEUM_SEA 0)
const SEA_GLSL = `
        float seaK = 0.0;
        #if TEUM_SEA > 0
        { float lc = dot(normalize(vWp), uLandC) - uLandCos;
          float wave = 0.004 * sin(uT * 0.9 + tn * 9.0);
          seaK = 1.0 - smoothstep(-0.006, 0.006, lc + wave);
          // 물결 얼룩은 바다 조각에서만 센다(뭍에서는 쓰이지 않는다)
          float swell = 0.5; if (seaK > 0.0) swell = teumN(tq * 70.0 + vec3(uT * 0.06, uT * 0.04, 0.0));
          vec3 water = mix(vec3(0.07, 0.4, 0.95), vec3(0.2, 0.56, 1.0), ck) * (0.9 + 0.2 * swell);
          vec3 sand = vec3(1.0, 0.95, 0.81) * (0.97 + 0.06 * tn);
          diffuseColor.rgb = mix(sand, diffuseColor.rgb, smoothstep(0.0, 0.04, lc));
          diffuseColor.rgb = mix(diffuseColor.rgb, water, seaK);
          float foam = 1.0 - smoothstep(0.0, 0.005, abs(lc + wave));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), foam * 0.85); }
        #endif`;

// 잔디 결: 가까운 곳에서만 잘게 얼룩지고, 군데군데 햇빛 받은 자리가 밝다(바다에는 없다). 연두를 섞지 않는다 — 라임 둘레 색은 쓰지 않는다.
// 결이 보이지 않는 조각(85m 밖·바다)에서는 얼룩 셋을 세지 않는다 — 땅은 화면의 절반을 덮어서 조각마다의 셈이 그대로 비용이다
const GRASS_GLSL = `
        float gf = (1.0 - smoothstep(16.0, 85.0, length(vViewPosition))) * uGrass * (1.0 - seaK);
        if (gf > 0.0) {
          float g1 = teumN(vWp * 4.5), g2 = teumN(vWp * 17.0), g3 = teumN(vWp * 46.0);
          diffuseColor.rgb *= 1.0 + gf * ((g3 - 0.5) * 0.16 + (g2 - 0.5) * 0.12 + (g1 - 0.5) * 0.06);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.1, gf * smoothstep(0.6, 0.9, g1) * 0.2);
        }`;

/** 땅의 색 — color_fragment 자리에 넣는다: 체커 → 바다 → 잔디 결 */
export const GROUND_COLOR_GLSL = `#include <color_fragment>${CHECKER_GLSL}${SEA_GLSL}${GRASS_GLSL}`;
