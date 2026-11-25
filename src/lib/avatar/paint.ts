import type * as THREE from "three";

import { dropUnusedMaps, KEY_HOLD_GLSL } from "@/lib/asset-kit/material";

import type { OutfitUniforms } from "./outfit-shader";
import {
  BODY_FRAGMENT_HEAD,
  BODY_RAW,
  BODY_VERTEX,
  BODY_VERTEX_HEAD,
  OUTFIT_GLSL,
} from "./outfit-shader";

// 아바타의 칠: 몸과 부품 모델의 재질을 어느 놀이에서든 같은 톤으로 칠한다 — 채도를 올린 매끈한 팝 톤이고, 라임은 조명에도 제 색 그대로다.
// 몸만 하나 더: 몸과 옷이 한 덩어리인 모델이라 옷 자리를 색으로 가려 무늬·색을 덮는다(outfit-shader).
// 놀이가 세상에 거는 효과(지역 색·물들기 같은 것)는 아바타에 닿지 않는다 — 아바타는 제 색을 지킨다

/** 광택(거칠기): 바람 넣은 풍선처럼 매끈하게 */
const ROUGHNESS = 0.32;
/** 채도 배수. 재질마다 같은 값을 같이 쓴다 */
const SATURATION = { value: 1.35 };

/** 몸 조각 셰이더 머리, map_fragment 자리에 넣는 것: 텍스처 색의 채도를 올린다 */
const TONE_HEAD = `uniform float uSat;
`;
const TONE_GLSL = `
      float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, uSat);`;

/**
 * 아바타 모델의 재질을 칠한다(제자리에서 고친다). outfit 을 주면 몸이다 — 그 옷 값으로 옷 자리를 덮는다.
 * 부품(머리·안경·가방…)은 outfit 없이 톤만 입는다
 */
export function paintAvatar(mat: THREE.MeshStandardMaterial, outfit: OutfitUniforms | null) {
  mat.metalness = 0;
  dropUnusedMaps(mat);
  mat.roughness = ROUGHNESS;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSat = SATURATION;
    let head = TONE_HEAD,
      paint = `#include <map_fragment>${TONE_GLSL}`;
    if (outfit) {
      Object.assign(sh.uniforms, outfit);
      sh.vertexShader =
        BODY_VERTEX_HEAD + sh.vertexShader.replace("#include <begin_vertex>", BODY_VERTEX);
      head = TONE_HEAD + BODY_FRAGMENT_HEAD;
      // 몸은 톤을 칠하기 전의 텍스처 색(rawC)으로 옷 자리를 가린다
      paint = BODY_RAW + TONE_GLSL + OUTFIT_GLSL;
    }
    sh.fragmentShader =
      head +
      sh.fragmentShader
        .replace("#include <map_fragment>", paint)
        .replace("#include <opaque_fragment>", `${KEY_HOLD_GLSL}\n#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => (outfit ? "avatar-body1" : "avatar-part1");
  mat.needsUpdate = true;
}
