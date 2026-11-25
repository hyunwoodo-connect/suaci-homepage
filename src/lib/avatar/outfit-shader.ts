import * as THREE from "three";

// 아바타 몸의 옷 갈아입히기: 몸과 옷이 한 덩어리인 모델이라 옷 자리를 색으로 가려 무늬·색을 덮는다.
// 셰이더 조각과, 그 셰이더가 읽는 옷 값(OutfitUniforms)이 여기 있다 — 아바타의 칠(paint)이 몸 재질에 이 조각과 값을 물리고, 옷장(wardrobe)이 값을 바꾼다

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

/** 아무 옷도 덮지 않은 값. 무늬 자리는 흰 점 하나(그림이 오기 전에도 셰이더가 읽을 것이 있게) */
export function blankOutfit(): OutfitUniforms {
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

/** 몸 꼭짓점 셰이더 머리: 조각 셰이더로 넘기는 처음 선 자세의 자리(vOp — 옷 자리의 높이, 무늬 좌표)와 법선(vOn — 무늬를 세 방향에서 입힌다) */
export const BODY_VERTEX_HEAD = `varying vec3 vOp; varying vec3 vOn;
`;

/** begin_vertex 자리에 넣는다: 처음 자리와 법선을 넘긴다 */
export const BODY_VERTEX = `#include <begin_vertex>
  vOp = position;
  vOn = normal;`;

/** 몸 조각 셰이더 머리: 넘겨받는 값과 옷 값(OutfitUniforms) */
export const BODY_FRAGMENT_HEAD = `varying vec3 vOp; varying vec3 vOn; uniform sampler2D uPrT; uniform sampler2D uPrB; uniform float uPrTon; uniform float uPrBon; uniform float uPrS; uniform vec3 uSkC; uniform float uSkOn; uniform vec3 uShC; uniform float uShOn;
`;

/** map_fragment 자리에 넣는다: 톤을 칠하기 전의 텍스처 색(rawC)을 잡아 둔다 — 옷 자리를 이 색으로 가린다 */
export const BODY_RAW = `#include <map_fragment>
      vec3 rawC = diffuseColor.rgb;`;

/**
 * 옷 자리 = 원래 텍스처 색 + 처음 선 자세의 높이(vOp.y, 키 1.2). 분홍·라임 스웨터와 그 둘이 만나는 경계색은 윗옷(0.44~0.84 — 앞섶 밑단까지),
 * 허리께 흰색은 치마(0.34~0.68), 발께 흰색은 신발(0.22 아래). 살색은 파랑이 많아서 경계색에서 빠진다.
 * 무늬는 몸에 붙은 좌표로 세 방향에서 입혀서(삼면 투영) 움직여도 미끄러지지 않는다. 명암은 원래 옷의 밝기를 따른다
 */
export const OUTFIT_GLSL = `
      { float yy = vOp.y, rmx = max(rawC.r, max(rawC.g, rawC.b)), rmn = min(rawC.r, min(rawC.g, rawC.b)), rl = dot(rawC, vec3(0.3, 0.59, 0.11)), rsat = (rmx - rmn) / max(rmx, 0.001);
        float isPink = step(0.1, rawC.r) * step(rawC.g, rawC.r * 0.4) * step(rawC.b, rawC.r * 0.7), isLime = step(0.25, rawC.g) * step(rawC.r, rawC.g * 0.85) * step(rawC.b, rawC.g * 0.35);
        float isMix = step(0.25, rsat) * step(rawC.b, rmx * 0.55);
        float topM = max(max(isPink, isLime), isMix) * step(0.44, yy) * step(yy, 0.84), wh = step(0.22, rmx) * step(rsat, 0.2), botM = wh * step(0.34, yy) * step(yy, 0.68), shoeM = wh * step(yy, 0.22);
        vec3 an = pow(abs(normalize(vOn)), vec3(4.0)); an /= (an.x + an.y + an.z); vec3 q = vOp * uPrS;
        if (uPrTon > 0.5 && topM > 0.5) { vec3 pt = texture2D(uPrT, q.zy).rgb * an.x + texture2D(uPrT, q.xz).rgb * an.y + texture2D(uPrT, q.xy).rgb * an.z; float pl = dot(pt, vec3(0.3, 0.59, 0.11)); pt = clamp(mix(vec3(pl), pt, 1.3), 0.0, 1.0); diffuseColor.rgb = pt * (isLime > 0.5 ? 0.98 : mix(1.0, clamp(rl / 0.24, 0.6, 1.15), 0.55)); }
        if (botM > 0.5) { if (uPrBon > 0.5) { vec3 pb = texture2D(uPrB, q.zy).rgb * an.x + texture2D(uPrB, q.xz).rgb * an.y + texture2D(uPrB, q.xy).rgb * an.z; float pl2 = dot(pb, vec3(0.3, 0.59, 0.11)); pb = clamp(mix(vec3(pl2), pb, 1.3), 0.0, 1.0); diffuseColor.rgb = pb * clamp(rl / 0.75, 0.5, 1.1); } else if (uSkOn > 0.5) diffuseColor.rgb = uSkC * clamp(rl / 0.75, 0.45, 1.1); }
        if (shoeM > 0.5 && uShOn > 0.5) diffuseColor.rgb = uShC * clamp(rl / 0.75, 0.45, 1.1); }`;
