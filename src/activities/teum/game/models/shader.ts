import * as THREE from "three";

import { dropUnusedMaps, KEY_HOLD_GLSL } from "@/lib/asset-kit/material";

import { LIME_FRUITS, MODEL_STRIPES, MODEL_TINT } from "../../assets/settings";
import type { LookUniforms } from "../look";
import { LOOK } from "../look";
import { BATCH_DEFINE, BEND_GLSL, VERTEX_HEAD } from "./bendGlsl";
import { FRAGMENT_HEAD, LIME_GLSL, REGION_GLSL, TONE_GLSL } from "./toneGlsl";

// 모델 재질의 톤 셰이더를 짠다: 색 조각(toneGlsl — 채도·색조·줄무늬·지역 색·라임 물들기)과 몸 휘기(bendGlsl)를 재질에 덧입힌다.
// 같은 키의 모델은 재질 하나를 같이 쓴다. 몸 휘기 값(uAn)·라임(uLime)이 저마다 다른 것은 여러 개를 한 번에 그리는 묶음(batch)으로
// 그리고, 그때는 같은 값이 인스턴스마다의 속성(aAn·aLime)으로 온다 — 셰이더 갈래는 이 둘뿐이다.
// 나(아바타의 몸·끼우는 부품)는 여기서 칠하지 않는다 — 어느 놀이에서든 같은 아바타의 칠(lib/avatar/paint)을 쓴다

/** 몸 휘기 값: x 고유 위상, y 걸음 위상, z 움직임 세기, w 고개 */
export interface MotionUniforms {
  uAn: { value: THREE.Vector4 };
  /** 몸 휘는 방식(0 이면 휘지 않는다) */
  uAk: { value: number };
  /** 앞이 x 축(0)인지 z 축(1)인지 */
  uAx: { value: number };
}

/** 모델 재질 하나가 갖는 톤 값 */
interface ModelLookOptions {
  key: string;
  lookU: LookUniforms;
  /** 라임으로 물드는 정도(묶음이면 쓰지 않는다) */
  lime: { value: number };
  motion: MotionUniforms;
  /** 묶음(인스턴스마다 aAn·aLime) */
  batch: boolean;
}

/** 제 색을 지키는 등장인물: 고래 — 지역 색으로 돌리지도, 끝 장면에 물들이지도 않는다 */
const CAST = new Set(["whale"]);
/**
 * 탈 것(어느 마을에서든 주황·귤색이라 탈 것인 줄 안다)과 라임(키컬러 그대로): 지역 색으로 돌리지 않는다.
 * 깔때기의 소용돌이 판과 봉오리는 여기 넣지 않는다 — 무늬가 두 색이라 그 마을의 색을 따르는 쪽이 낫다(한 색으로 칠하면 소용돌이가 사라진다)
 */
const RIDES = ["cannon", "bell", "bumper", "star", "balloon", "slide", "hotairballoon"];
const REGION_FREE = new Set([...CAST, ...RIDES, "d_hotairballoon", ...LIME_FRUITS]);

/** 모델 재질에 톤을 칠하고 셰이더를 덧입힌다(제자리에서 고친다) */
export function styleModel(mat: THREE.MeshStandardMaterial, o: ModelLookOptions) {
  const tint = MODEL_TINT[o.key],
    stripes = MODEL_STRIPES[o.key];
  const tintHex = tint ? tint[0] : 0xffffff,
    stripeHex = stripes ? stripes[1] : 0xffffff;
  const uTint = { value: new THREE.Color(tintHex) },
    uTK = { value: tint ? tint[1] : 0 },
    uPat = { value: stripes ? 1 : 0 },
    uPY = { value: stripes ? stripes[0] : 0 },
    uTint2 = { value: new THREE.Color(stripeHex) };
  // 어떤 에셋의 재질인지(그리기 호출을 셀 때 이름으로 본다)
  mat.name = o.key;
  mat.metalness = 0;
  dropUnusedMaps(mat);
  mat.roughness = LOOK.modelRough;
  if (o.batch) mat.defines = { ...mat.defines, [BATCH_DEFINE]: "" };
  const { uAn, uAk, uAx } = o.motion;
  // 지역 색: 물건이 선 자리의 지역 색으로 색상을 돌린다(고래·탈 것·라임은 돌리지 않는다, 생물은 몸 휘기 uAk 로 셰이더가 뺀다)
  const uRegK = { value: REGION_FREE.has(o.key) ? 0 : 1 };
  // 끝 장면의 라임 물결: 등장인물은 물들지 않는다(생물은 셰이더가 뺀다)
  const uFloodK = { value: CAST.has(o.key) ? 0 : 1 };
  // 라임 과일은 과일 껍질의 초록이 아니라 늘 키컬러다
  const uKeyK = { value: LIME_FRUITS.has(o.key) ? 1 : 0 };
  // 지역 수는 셰이더를 만들 때 센다(그 전에 지도가 마을을 채운다)
  const regionCount = () => o.lookU.regionHub.value.length;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSat = o.lookU.sat;
    sh.uniforms.uWash = o.lookU.wash;
    sh.uniforms.uLime = o.lime;
    sh.uniforms.uTint = uTint;
    sh.uniforms.uTK = uTK;
    sh.uniforms.uPat = uPat;
    sh.uniforms.uPY = uPY;
    sh.uniforms.uTint2 = uTint2;
    sh.uniforms.uAn = uAn;
    sh.uniforms.uAk = uAk;
    sh.uniforms.uAx = uAx;
    sh.uniforms.uHubV = o.lookU.regionHub;
    sh.uniforms.uRegH = o.lookU.regionHue;
    sh.uniforms.uRegE = o.lookU.regionEdge;
    sh.uniforms.uRegK = uRegK;
    sh.uniforms.uFlood = o.lookU.flood;
    sh.uniforms.uFloodK = uFloodK;
    sh.uniforms.uKeyK = uKeyK;
    const regions = regionCount();
    const regionHead = `#define TEUM_REGIONS ${regions}\n`;
    sh.vertexShader =
      regionHead + VERTEX_HEAD + sh.vertexShader.replace("#include <begin_vertex>", BEND_GLSL);
    // 라임 물들기는 지역 색 뒤에 — 지역 색이 라임 둘레 색을 돌려세우기 때문이다
    const tone = TONE_GLSL + REGION_GLSL + LIME_GLSL;
    sh.fragmentShader =
      regionHead +
      FRAGMENT_HEAD +
      sh.fragmentShader
        .replace("#include <map_fragment>", tone)
        .replace("#include <opaque_fragment>", `${KEY_HOLD_GLSL}\n#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => {
    const regions = regionCount();
    const kind = o.batch ? "teum-look13-batch-r" : "teum-look13-r";
    return kind + regions;
  };
  mat.needsUpdate = true;
}
