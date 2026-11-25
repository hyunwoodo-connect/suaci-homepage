import * as THREE from "three";

import { AVATAR_BODY, PARTS } from "@/lib/avatar/parts";

import { LIME_FRUITS, MODEL_STRIPES, MODEL_TINT } from "../../assets/settings";
import { KEY_HOLD_GLSL } from "../keyColor";
import type { LookUniforms } from "../look";
import { LOOK } from "../look";
import { BATCH_DEFINE, BEND_GLSL, VERTEX_HEAD } from "./bendGlsl";
import {
  BODY_FRAGMENT_HEAD,
  BODY_RAW,
  BODY_VERTEX,
  BODY_VERTEX_HEAD,
  OUTFIT_GLSL,
} from "./outfitGlsl";
import { FRAGMENT_HEAD, LIME_GLSL, REGION_GLSL, TONE_GLSL } from "./toneGlsl";

// 모델 재질의 톤 셰이더를 짠다: 색 조각(toneGlsl — 채도·색조·줄무늬·지역 색·라임 물들기)과 몸 휘기(bendGlsl)를 재질에 덧입힌다.
// 같은 키의 모델은 재질 하나를 같이 쓴다. 몸 휘기 값(uAn)·라임(uLime)이 저마다 다른 것은 여러 개를 한 번에 그리는 묶음(batch)으로
// 그리고, 그때는 같은 값이 인스턴스마다의 속성(aAn·aLime)으로 온다 — 셰이더 갈래는 이 둘뿐이다.
// 아바타 몸만 하나 더: 몸과 옷이 한 덩어리인 모델이라 옷 자리를 색으로 가려 무늬·색을 덮는다(outfitGlsl)

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

/** 모델 재질에서 쓰지 않는 그림 */
const UNUSED_MAPS = ["metalnessMap", "roughnessMap", "normalMap"] as const;

/** 제 색을 지키는 등장인물: 나(몸·입는 부품)와 고래 — 지역 색으로 돌리지도, 끝 장면에 물들이지도 않는다 */
const PART_KEYS = Object.keys(PARTS);
const CAST = new Set([AVATAR_BODY, ...PART_KEYS, "whale"]);
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
  // 금속·거칠기·요철 그림은 쓰지 않는다: 톤이 광택을 정하고, 요철 그림은 넣어도 화면에서 구별되지 않는데 모델마다 한 장씩 GPU 에 올라가고
  // 조각마다 셈이 든다. 풀어 낸 그림은 모델마다 두 장(1~4MB 씩)이라 놓기만 하지 않고 바로 비운다 — 폰은 메모리가 차면 끊긴다
  for (const unused of UNUSED_MAPS) dropMap(mat, unused);
  mat.roughness = LOOK.modelRough;
  if (o.batch) mat.defines = { ...mat.defines, [BATCH_DEFINE]: "" };
  const { uAn, uAk, uAx } = o.motion;
  const isBody = o.key === AVATAR_BODY;
  // 지역 색: 물건이 선 자리의 지역 색으로 색상을 돌린다(나·고래·탈 것·라임은 돌리지 않는다, 생물은 몸 휘기 uAk 로 셰이더가 뺀다)
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
    if (isBody) Object.assign(sh.uniforms, o.lookU.outfit);
    const regions = regionCount();
    const regionHead = `#define TEUM_REGIONS ${regions}\n`;
    const vertexHead = VERTEX_HEAD + (isBody ? BODY_VERTEX_HEAD : ""),
      bend = BEND_GLSL + (isBody ? BODY_VERTEX : "");
    sh.vertexShader =
      regionHead + vertexHead + sh.vertexShader.replace("#include <begin_vertex>", bend);
    // 몸은 톤을 칠하기 전의 텍스처 색(rawC)으로 옷 자리를 가린다
    const paint = isBody
      ? TONE_GLSL.replace("#include <map_fragment>", BODY_RAW) + OUTFIT_GLSL + REGION_GLSL
      : TONE_GLSL + REGION_GLSL;
    // 라임 물들기는 지역 색 뒤에 — 지역 색이 라임 둘레 색을 돌려세우기 때문이다
    const tone = paint + LIME_GLSL;
    const fragmentHead = FRAGMENT_HEAD + (isBody ? BODY_FRAGMENT_HEAD : "");
    sh.fragmentShader =
      regionHead +
      fragmentHead +
      sh.fragmentShader
        .replace("#include <map_fragment>", tone)
        .replace("#include <opaque_fragment>", `${KEY_HOLD_GLSL}\n#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => {
    const regions = regionCount();
    const kind = isBody ? "teum-look13-body-r" : o.batch ? "teum-look13-batch-r" : "teum-look13-r";
    return kind + regions;
  };
  mat.needsUpdate = true;
}

/* ─── 내부 ─────────────────────────── */

// 재질에서 그림 하나를 떼고 비운다(풀어 낸 비트맵도 닫는다 — 같은 그림을 금속·거칠기가 같이 써도 두 번 비워서 탈 날 것은 없다)
function dropMap(mat: THREE.MeshStandardMaterial, key: (typeof UNUSED_MAPS)[number]) {
  const tex = mat[key];
  if (!tex) return;
  mat[key] = null;
  // 남겨 쓰는 칸(색·그늘·빛·투명)이 같은 그림을 가리키면 떼기만 한다(그늘을 금속·거칠기 그림에 같이 담는 에셋이 올 수 있다)
  const kept = [mat.map, mat.aoMap, mat.emissiveMap, mat.alphaMap];
  if (kept.includes(tex)) return;
  tex.dispose();
  const image: unknown = tex.image;
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) image.close();
}
