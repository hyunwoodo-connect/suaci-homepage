import * as THREE from "three";

import { GREY_TOY, LIME } from "./settings";

// 톤: 키컬러(라임 #A9FF39)가 주인공인 초현실 팝. 판이 끝난 뒤 머리에 남는 색이 라임이게 한다 — 규칙 넷:
// ① 혼자 둔다: 라임 둘레 색(노랑·초록·청록)은 세상에 쓰지 않는다. 비슷한 것들 사이에서 혼자 다른 하나가 기억에 남는다
// ② 아껴 쓴다: 라임은 수아시의 것에만 — 물풍선 · 내가 건드려 반응한 것 · 로고 · 고양이
// ③ 맞은편에 바탕을 깐다: 세상은 라임의 맞은편 색(분홍·보라·파랑)과 흰색. 탈 것만 주황·귤색이다
// ④ 제 색 그대로 보인다: 라임인 면은 조명에 밀려 누렇게 뜨지 않게 칠하고(KEY_HOLD_GLSL), 판의 끝에는 온 섬이 라임으로 물든다
//    (FLOOD_GLSL — 마지막 장면이 기억에 남는다).
// 색 배합 — 바탕 = 코발트 하늘 + 마을마다 분홍·보라·파랑 체커 땅(마을 사이는 옅은 보랏빛) / 큰 덩어리(나무·꽃·랜드마크·구름) = 그 마을의 색과 흰색 /
// 탈 것 = 주황과 귤색 / 수아시의 것 = 라임.
// 톤이 하나로 정해져 있어 다 만든 뒤 한꺼번에 칠하지 않고, 각자 만들 때 이 값으로 칠한다

/** 놀이기구 종류(색을 따로 두는 갈래) */
type ToyKind =
  | "ring"
  | "pillar"
  | "chime"
  | "bumper"
  | "cannon"
  | "hole"
  | "sling"
  | "swing"
  | "funnel"
  | "plank"
  | "ramp"
  | "rail"
  | "whirl"
  | "seed"
  | "rocket"
  | "comet";

/** 확정된 톤의 색 배합 */
export const LOOK = Object.freeze({
  sat: 1.35,
  wash: 0,
  light: 2.0,
  sunI: 1.3,
  gA: 0x6a5cf0,
  gB: 0xc4c2ff,
  rim: 0x9db4f2,
  top: 0x002afd,
  glow: 0xe6ffa6,
  lake: 0x2f6fe6,
  bg: 0x7896ec,
  cloud: 0xff9ccb,
  /** 놀이기구 바탕색(반응하면 라임으로 넘어간다) */
  toy: {
    ring: 0xff5a1f,
    pillar: 0xff8a2b,
    chime: 0xff5a1f,
    bumper: 0xff5a1f,
    cannon: 0xff5a1f,
    hole: 0xff8a2b,
    sling: 0xff5a1f,
    swing: 0xff5a1f,
    funnel: 0xff5a1f,
    plank: 0xff8a2b,
    ramp: 0xff8a2b,
    rail: 0xff5a1f,
    whirl: 0xff8a2b,
    seed: 0xff8a2b,
    rocket: 0xff5a1f,
    comet: 0xff8a2b,
  } satisfies Record<ToyKind, number>,
  /** 바닥 꽃·기류·바람길의 꽃잎 색 */
  fl: [0xff5fa2, 0xffffff, 0xff8fbd, 0xffffff],
  pad: 0xff8a2b,
  core: 0xff8a2b,
  stem: 0xf4f0ff,
  /** 팝 톤의 광택: 놀이기구·모델은 풍선처럼 매끈, 땅은 보송 */
  toyRough: 0.2,
  modelRough: 0.32,
});

/** 모델 재질이 같이 쓰는 톤 값(채도·바램) */
export interface LookUniforms {
  sat: { value: number };
  wash: { value: number };
  /** 지역: 마을 중심들(지역 차례) · 물건 색상을 돌리는 각(라디안) · 테두리(코사인 from, width) */
  regionHub: { value: THREE.Vector3[] };
  regionHue: { value: number[] };
  regionEdge: { value: THREE.Vector2 };
  /**
   * 끝 장면의 라임 물결: xyz 물결의 가운데(행성 위 방향), w 물결 끝의 코사인(가운데와 이루는 각).
   * w 가 FLOOD_OFF 면 아무것도 물들지 않고, FLOOD_ALL 이면 온 행성이 물든다
   */
  flood: { value: THREE.Vector4 };
  /** 아바타 옷(몸 재질만 쓴다) */
  outfit: OutfitUniforms;
}

/**
 * 아바타 옷(몸 셰이더가 옷 자리를 덮는 값): 윗옷·치마 무늬 그림과 입었는지(on), 무늬 크기(uPrS),
 * 치마·신발 단색과 칠했는지(on). 옷을 갈아입으면 이 값만 바뀌고 셰이더는 그대로다
 */
export interface OutfitUniforms {
  uPrT: { value: THREE.Texture };
  uPrB: { value: THREE.Texture };
  uPrTon: { value: number };
  uPrBon: { value: number };
  uPrS: { value: number };
  uSkC: { value: THREE.Color };
  uSkOn: { value: number };
  uShC: { value: THREE.Color };
  uShOn: { value: number };
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
  flood: LookUniforms["flood"],
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
export function keyify(mat: THREE.MeshStandardMaterial, flood: LookUniforms["flood"]) {
  mat.onBeforeCompile = (sh) => keyShader(sh, flood);
  mat.customProgramCacheKey = () => "teum-key1";
}

/** 코드로 만든 도형의 재질 메시 */
export type GreyMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

/** 재질 만드는 곳: 놀이기구 바탕색, 반응한 라임, 톤 값 */
export class Mats {
  readonly toy: Record<ToyKind, THREE.Color>;
  readonly lime = new THREE.Color(LIME);
  readonly lookU: LookUniforms = {
    sat: { value: LOOK.sat },
    wash: { value: LOOK.wash },
    regionHub: { value: [] },
    regionHue: { value: [] },
    regionEdge: { value: new THREE.Vector2(0.78, 0.12) },
    flood: { value: new THREE.Vector4(0, 1, 0, FLOOD_OFF) },
    outfit: blankOutfit(),
  };

  constructor() {
    const toy = {} as Record<ToyKind, THREE.Color>;
    for (const [k, hex] of Object.entries(LOOK.toy)) toy[k as ToyKind] = new THREE.Color(hex);
    this.toy = toy;
  }

  /** 도형 재질: 팝 톤의 매끈한 광택 */
  grey(c: number = GREY_TOY): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color: c,
      roughness: LOOK.toyRough,
      metalness: 0,
    });
    keyify(mat, this.lookU.flood);
    return mat;
  }

  /** 기둥·받침처럼 반응하지 않는 부분(흰색) */
  pole(): THREE.MeshStandardMaterial {
    return this.grey(0xffffff);
  }

  /** 땅처럼 보송한 재질(반사 없음) */
  matte(c: number): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color: c,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0,
    });
    keyify(mat, this.lookU.flood);
    return mat;
  }
}

/* ─── 내부 ─────────────────────────── */

// 아무 옷도 덮지 않은 값. 무늬 자리는 흰 점 하나(그림이 오기 전에도 셰이더가 읽을 것이 있게)
function blankOutfit(): OutfitUniforms {
  const pixel = new Uint8Array([255, 255, 255, 255]),
    white = new THREE.DataTexture(pixel, 1, 1);
  white.needsUpdate = true;
  return {
    uPrT: { value: white },
    uPrB: { value: white },
    uPrTon: { value: 0 },
    uPrBon: { value: 0 },
    uPrS: { value: 1.5 },
    uSkC: { value: new THREE.Color(0xffffff) },
    uSkOn: { value: 0 },
    uShC: { value: new THREE.Color(0xffffff) },
    uShOn: { value: 0 },
  };
}
