import type * as THREE from "three";

// 키컬러(라임 #A9FF39)를 화면에 제 색으로 내는 셰이더 조각 둘(톤 규칙 ④ — look.ts):
// 1) 키컬러 지키기(KEY_HOLD_GLSL): 라임인 면은 조명에 밀려 누렇게 뜨지 않게 칠한다
// 2) 끝 장면의 라임 물결(FLOOD_GLSL): 한 자리에서 퍼지는 원이 닿은 면부터 라임이 된다
// 도형 재질은 keyify 로 둘을 한 번에 입고, 제 셰이더를 덧입히는 재질(꽃잎·땅·모델)은 조각을 골라 넣는다

/**
 * 끝 장면의 라임 물결 값: xyz 물결의 가운데(행성 위 방향), w 물결 끝의 코사인(가운데와 이루는 각).
 * w 가 FLOOD_OFF 면 아무것도 물들지 않고, FLOOD_ALL 이면 온 행성이 물든다
 */
export interface FloodUniform {
  value: THREE.Vector4;
}

/** 물결 끝의 코사인: 아무것도 물들지 않는 값 · 온 행성이 물드는 값 */
export const FLOOD_OFF = 2,
  FLOOD_ALL = -2;

/** 키컬러(셰이더가 셈하는 선형 색 공간의 #A9FF39) */
export const KEY_GLSL = "vec3(0.397, 1.0, 0.041)";

/**
 * 원래 색의 밝기(lum, 0..1)로 키컬러를 칠한다: 색이 있던 면은 키컬러 그대로, 어두운 무늬(눈·그늘 결)만 어둡게 남긴다 —
 * 온통 한 색이 되어도 생김새가 읽힌다
 */
export function keyPaintGlsl(lum: string): string {
  return `${KEY_GLSL} * (0.3 + 0.7 * smoothstep(0.03, 0.3, ${lum}))`;
}

/** 세계 자리(vKeyAt)를 조각 셰이더로 넘긴다 — project_vertex 뒤에 넣는다 */
export const KEY_AT_GLSL = `
  #ifdef USE_INSTANCING
  vKeyAt = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
  #else
  vKeyAt = (modelMatrix * vec4(transformed, 1.0)).xyz;
  #endif`;

/**
 * 끝 장면: 물결(가운데에서 퍼지는 원)이 닿은 자리의 색 있는 면은 라임이 된다. 흰 면은 희게 남아 '라임 + 흰색' 두 톤이 된다.
 * color_fragment 뒤에 넣는다(uFlood·vKeyAt 가 있어야 한다)
 */
export const FLOOD_GLSL = `
  { float fdMx = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)), fdMn = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
    float fdOn = smoothstep(uFlood.w, uFlood.w + 0.0004, dot(normalize(vKeyAt), uFlood.xyz)) * smoothstep(0.15, 0.45, (fdMx - fdMn) / max(fdMx, 0.001));
    float fdLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
    diffuseColor.rgb = mix(diffuseColor.rgb, ${keyPaintGlsl("fdLum")}, fdOn); }`;

/**
 * 키컬러 지키기: 라임인 면은 장면의 조명을 받지 않는다 — 조명이 더해지면 초록 채널이 먼저 차서 라임이 누렇게 뜬다.
 * 제 색에 완만한 음영(아래쪽·가장자리만 조금 어둡게, 제 색보다 밝아지지 않는다)만 얹는다. opaque_fragment 앞에 넣는다
 */
export const KEY_HOLD_GLSL = `
  { float khOn = smoothstep(0.12, 0.35, diffuseColor.g - max(diffuseColor.r * 0.75, diffuseColor.b)) * smoothstep(0.45, 0.8, diffuseColor.g);
    float khRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.4);
    float khShade = (0.84 + 0.16 * smoothstep(-0.7, 0.5, normal.y)) * (1.0 - 0.14 * khRim);
    outgoingLight = mix(outgoingLight, diffuseColor.rgb * khShade, khOn); }`;

/** 셰이더 하나에 키컬러 규칙 둘을 넣는다 — 제 셰이더를 덧입히는 재질은 그 끝에서 이것을 부른다 */
export function keyShader(
  sh: { uniforms: Record<string, THREE.IUniform>; vertexShader: string; fragmentShader: string },
  flood: FloodUniform,
) {
  sh.uniforms.uFlood = flood;
  sh.vertexShader =
    "varying vec3 vKeyAt;\n" +
    sh.vertexShader.replace("#include <project_vertex>", `#include <project_vertex>${KEY_AT_GLSL}`);
  sh.fragmentShader =
    "uniform vec4 uFlood; varying vec3 vKeyAt;\n" +
    sh.fragmentShader
      .replace("#include <color_fragment>", `#include <color_fragment>${FLOOD_GLSL}`)
      .replace("#include <opaque_fragment>", `${KEY_HOLD_GLSL}\n#include <opaque_fragment>`);
}

/**
 * 재질에 키컬러 규칙 둘을 입힌다: 라임인 면은 제 색 그대로(KEY_HOLD_GLSL), 끝 장면에는 물결이 닿은 자리부터 라임으로(FLOOD_GLSL).
 * 셰이더를 따로 덧입히는 재질은 keyShader 를 부르거나(꽃잎) 조각들을 제 셰이더에 직접 넣는다(땅·모델)
 */
export function keyify(mat: THREE.MeshStandardMaterial, flood: FloodUniform) {
  mat.onBeforeCompile = (sh) => keyShader(sh, flood);
  mat.customProgramCacheKey = () => "teum-key1";
}
