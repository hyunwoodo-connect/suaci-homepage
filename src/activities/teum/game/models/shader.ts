import * as THREE from "three";

import { GLOWING_LIME, MODEL_STRIPES, MODEL_TINT } from "../../assets/settings";
import { AVATAR_BODY, PARTS } from "../avatar/parts";
import type { LookUniforms } from "../look";
import { LOOK } from "../look";

// 모델 재질의 톤 셰이더: 채도·색조·줄무늬·라임 물들기, 그리고 생물·날개는 뼈대 없이 몸을 휜다
// (1 네발 걸음·고갯짓, 2 꼬리 헤엄, 3 날갯짓, 4 해파리 갓과 촉수, 5 두 발).
// 같은 키의 모델은 재질 하나를 같이 쓴다. 몸 휘기 값(uAn)·라임(uLime)이 저마다 다른 것은 여러 개를 한 번에 그리는 묶음(batch)으로
// 그리고, 그때는 같은 값이 인스턴스마다의 속성(aAn·aLime)으로 온다 — 셰이더 갈래는 이 둘뿐이다.
// 아바타 몸만 하나 더: 몸과 옷이 한 덩어리인 모델이라 옷 자리를 색으로 가려 무늬·색을 덮는다(OUTFIT_GLSL)

/** 몸 휘기 값: x 고유 위상, y 걸음 위상, z 움직임 세기, w 고개 */
export interface MotionUniforms {
  uAn: { value: THREE.Vector4 };
  /** 몸 휘는 방식(0 이면 휘지 않는다) */
  uAk: { value: number };
  /** 앞이 x 축(0)인지 z 축(1)인지 */
  uAx: { value: number };
}

/** 모델 재질 하나가 갖는 톤 값 */
export interface ModelLookOptions {
  key: string;
  lookU: LookUniforms;
  /** 라임으로 물드는 정도(묶음이면 쓰지 않는다) */
  lime: { value: number };
  motion: MotionUniforms;
  /** 묶음(인스턴스마다 aAn·aLime) */
  batch: boolean;
}

/** 지역 색을 돌리지 않는 모델: 나(몸·입는 부품)·고래·숨바꼭질 라임 상자(어느 마을에서도 라임과 흰 리본) */
const PART_KEYS = Object.keys(PARTS);
const REGION_FREE = new Set([AVATAR_BODY, ...PART_KEYS, "whale", "limebox"]);

/** 같은 묶음 셰이더(인스턴스 속성)를 쓰는지 */
const BATCH_DEFINE = "TEUM_BATCH";

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
  mat.metalnessMap = null;
  mat.roughnessMap = null;
  mat.roughness = LOOK.modelRough;
  if (GLOWING_LIME.has(o.key)) {
    // 라임은 그늘에서도 쨍하게
    mat.emissive.set(0x6fae12);
    mat.emissiveIntensity = 0.5;
  }
  if (o.batch) mat.defines = { ...mat.defines, [BATCH_DEFINE]: "" };
  const { uAn, uAk, uAx } = o.motion;
  const isBody = o.key === AVATAR_BODY;
  // 지역 색: 물건이 선 자리의 지역 색으로 색상을 돌린다(나·고래는 돌리지 않는다, 생물은 몸 휘기 uAk 로 셰이더가 뺀다)
  const uRegK = { value: REGION_FREE.has(o.key) ? 0 : 1 };
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
    if (isBody) Object.assign(sh.uniforms, o.lookU.outfit);
    const regions = regionCount();
    const regionHead = `#define TEUM_REGIONS ${regions}\n`;
    const vertexHead = VERTEX_HEAD + (isBody ? BODY_VERTEX_HEAD : ""),
      bend = BEND_GLSL + (isBody ? BODY_VERTEX : "");
    sh.vertexShader =
      regionHead + vertexHead + sh.vertexShader.replace("#include <begin_vertex>", bend);
    // 몸은 톤을 칠하기 전의 텍스처 색(rawC)으로 옷 자리를 가린다
    const tone = isBody
      ? TONE_GLSL.replace("#include <map_fragment>", BODY_RAW) + OUTFIT_GLSL + REGION_GLSL
      : TONE_GLSL + REGION_GLSL;
    const fragmentHead = FRAGMENT_HEAD + (isBody ? BODY_FRAGMENT_HEAD : "");
    sh.fragmentShader =
      regionHead + fragmentHead + sh.fragmentShader.replace("#include <map_fragment>", tone);
  };
  mat.customProgramCacheKey = () => {
    const regions = regionCount();
    const kind = isBody ? "teum-look9-body-r" : o.batch ? "teum-look9-batch-r" : "teum-look9-r";
    return kind + regions;
  };
  mat.needsUpdate = true;
}

/* ─── 내부 ─────────────────────────── */

const VERTEX_HEAD = `varying vec3 vOp; varying vec3 vRo; uniform float uAk; uniform float uAx;
#ifdef ${BATCH_DEFINE}
attribute vec4 aAn; attribute float aLime; varying float vLime;
#define TEUM_AN aAn
#else
uniform vec4 uAn;
#define TEUM_AN uAn
#endif
`;

const BEND_GLSL = `#include <begin_vertex>
  vOp = position;
  #ifdef USE_INSTANCING
  vRo = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #else
  vRo = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif
  #ifdef ${BATCH_DEFINE}
  vLime = aLime;
  #endif
  if (uAk > 0.5) {
    vec4 an = TEUM_AN;
    float s = uAx < 0.5 ? transformed.x : transformed.z, w = uAx < 0.5 ? transformed.z : -transformed.x, y = transformed.y, dF = 0.0, dW = 0.0, dY = 0.0, ph = an.y, am = an.z;
    if (uAk < 1.5) {
      float L = smoothstep(-0.12, -0.38, y), off = (s * w > 0.0) ? 0.0 : 3.14159;
      dF += L * 0.17 * am * sin(ph + off); dY += L * 0.08 * am * max(0.0, cos(ph + off)); dY += 0.022 * am * sin(2.0 * ph) * (1.0 - L);
      float Hm = smoothstep(0.1, 0.42, s) * (1.0 - L);
      dY += Hm * (0.11 * an.w + 0.02 * am * sin(2.0 * ph + 1.0)); dF += Hm * 0.05 * max(0.0, -an.w);
      float Tm = smoothstep(-0.3, -0.5, s); dW += Tm * 0.05 * sin(ph * 1.5 + an.x);
    } else if (uAk < 2.5) {
      float Tm = smoothstep(0.2, -0.5, s); dW += Tm * (0.05 + 0.17 * am) * sin(ph - s * 5.0) + 0.03 * sin(ph) * s;
    } else if (uAk < 3.5) {
      float Wm = smoothstep(0.1, 0.42, abs(w)); dY += Wm * abs(w) * (0.12 + 1.2 * am) * sin(ph); dY -= 0.05 * am * sin(ph) * (1.0 - Wm);
      float Tm = smoothstep(-0.2, -0.5, s) * (1.0 - Wm); dY += Tm * 0.08 * sin(ph * 0.5);
    } else if (uAk > 4.5) {
      float L = smoothstep(-0.24, -0.42, y), off = w > 0.0 ? 0.0 : 3.14159;
      dF += L * 0.2 * am * sin(ph + off); dY += L * 0.09 * am * max(0.0, cos(ph + off));
      dW += 0.035 * am * sin(ph) * (y + 0.5); dY += 0.02 * am * abs(sin(ph)) * (1.0 - L);
      float Am = smoothstep(0.3, 0.42, abs(w)) * (1.0 - L); dF -= Am * 0.12 * am * sin(ph + off);
    } else {
      float B = smoothstep(-0.05, 0.15, y), pu = sin(ph), Tm = smoothstep(0.02, -0.5, y);
      transformed.xz *= 1.0 + B * 0.11 * pu; dY -= B * 0.05 * pu;
      transformed.x += Tm * 0.07 * sin(ph * 0.8 + y * 9.0 + transformed.z * 6.0 + an.x); transformed.z += Tm * 0.07 * cos(ph * 0.7 + y * 9.0 + transformed.x * 6.0);
      transformed.xz *= 1.0 - Tm * 0.2 * sin(ph - 1.2); dY += Tm * 0.07 * sin(ph - 1.2) * (-y);
    }
    if (uAx < 0.5) { transformed.x += dF; transformed.z += dW; } else { transformed.z += dF; transformed.x -= dW; }
    transformed.y += dY;
  }`;

const FRAGMENT_HEAD = `uniform float uSat; uniform float uWash; uniform vec3 uTint; uniform float uTK; uniform float uPat; uniform float uPY; uniform vec3 uTint2; varying vec3 vOp; varying vec3 vRo; uniform float uAk;
#if TEUM_REGIONS > 0
uniform vec3 uHubV[TEUM_REGIONS]; uniform float uRegH[TEUM_REGIONS]; uniform vec2 uRegE; uniform float uRegK;
#endif
#ifdef ${BATCH_DEFINE}
varying float vLime;
#define TEUM_LIME vLime
#else
uniform float uLime;
#define TEUM_LIME uLime
#endif
`;

const TONE_GLSL = `#include <map_fragment>
      float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, uSat);
      // 색 배합: 에셋의 명암과 채도는 그대로 두고 색상만 정해진 색으로 바꾼다. 원래 흰 부분은 희게 남아 '정해진 색 + 흰색' 두 톤이 된다
      float mx = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)), mn = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
      float sK = smoothstep(0.04, 0.4, mx > 0.0 ? (mx - mn) / mx : 0.0);
      vec3 tC = uTint; if (uPat > 0.5 && vOp.y < uPY) { tC = fract(atan(vOp.z, vOp.x) * 1.5915) < 0.5 ? uTint2 : vec3(1.0); sK = 1.0; } // 줄기는 세로 줄무늬(열 줄)
      vec3 mapped = mix(vec3(1.0), tC, sK) * mix(mx, 1.0, 0.24);
      mapped = mix(mapped, vec3(mix(mx, 1.0, 0.62)), step(2.95, uTint.r + uTint.g + uTint.b) * (1.0 - step(0.5, uPat) * step(vOp.y, uPY))); // 흰색으로 정한 것은 밝은 회색~흰색 명암만 남긴다
      diffuseColor.rgb = mix(diffuseColor.rgb, mapped, uTK);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), uWash);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.397, 1.0, 0.041), TEUM_LIME * 0.8);`;

// 지역 색: 물건이 선 자리(인스턴스 원점)에서 가장 가까운 마을의 각만큼 YIQ 색상을 돌린다. 흰색은 그대로(색이 없다), 라임은 알아보고 뺀다.
// 지역 사이에서는 채도를 조금 낮춰 지역이 더 또렷하다
const REGION_GLSL = `
      #if TEUM_REGIONS > 0
      if (uRegK > 0.5 && uAk < 0.5 && dot(vRo, vRo) > 1.0) { vec3 rn = normalize(vRo), rc = diffuseColor.rgb; float rb = -1.0, rh = 0.0; for (int i = 0; i < TEUM_REGIONS; i++) { float dH = dot(rn, uHubV[i]); if (dH > rb) { rb = dH; rh = uRegH[i]; } }
        float rw = smoothstep(uRegE.x, uRegE.x + uRegE.y, rb), lk = smoothstep(0.12, 0.35, rc.g - max(rc.r * 0.75, rc.b)), ra = rh * rw * (1.0 - lk), cs = cos(ra), sn = sin(ra);
        vec3 yiq = vec3(dot(rc, vec3(0.299, 0.587, 0.114)), dot(rc, vec3(0.596, -0.274, -0.322)), dot(rc, vec3(0.211, -0.523, 0.312))); vec2 iq = vec2(yiq.y * cs - yiq.z * sn, yiq.y * sn + yiq.z * cs);
        rc = vec3(yiq.x + 0.956 * iq.x + 0.621 * iq.y, yiq.x - 0.272 * iq.x - 0.647 * iq.y, yiq.x - 1.106 * iq.x + 1.703 * iq.y);
        diffuseColor.rgb = clamp(mix(vec3(yiq.x), rc, mix(0.6, 1.0, max(rw, lk))), 0.0, 1.0); }
      #endif`;

// ---- 아바타 몸: 옷 갈아입히기 ----

const BODY_VERTEX_HEAD = `varying vec3 vOn;
`;

const BODY_VERTEX = `
  vOn = normal;`;

const BODY_FRAGMENT_HEAD = `varying vec3 vOn; uniform sampler2D uPrT; uniform sampler2D uPrB; uniform float uPrTon; uniform float uPrBon; uniform float uPrS; uniform vec3 uSkC; uniform float uSkOn; uniform vec3 uShC; uniform float uShOn;
`;

const BODY_RAW = `#include <map_fragment>
      vec3 rawC = diffuseColor.rgb;`;

// 옷 자리 = 원래 텍스처 색 + 처음 선 자세의 높이(vOp.y, 키 1.2). 분홍·라임 스웨터와 그 둘이 만나는 경계색은 윗옷(0.44~0.84 — 앞섶 밑단까지),
// 허리께 흰색은 치마(0.34~0.68), 발께 흰색은 신발(0.22 아래). 살색은 파랑이 많아서 경계색에서 빠진다.
// 무늬는 몸에 붙은 좌표로 세 방향에서 입혀서(삼면 투영) 움직여도 미끄러지지 않는다. 명암은 원래 옷의 밝기를 따른다
const OUTFIT_GLSL = `
      { float yy = vOp.y, rmx = max(rawC.r, max(rawC.g, rawC.b)), rmn = min(rawC.r, min(rawC.g, rawC.b)), rl = dot(rawC, vec3(0.3, 0.59, 0.11)), rsat = (rmx - rmn) / max(rmx, 0.001);
        float isPink = step(0.1, rawC.r) * step(rawC.g, rawC.r * 0.4) * step(rawC.b, rawC.r * 0.7), isLime = step(0.25, rawC.g) * step(rawC.r, rawC.g * 0.85) * step(rawC.b, rawC.g * 0.35);
        float isMix = step(0.25, rsat) * step(rawC.b, rmx * 0.55);
        float topM = max(max(isPink, isLime), isMix) * step(0.44, yy) * step(yy, 0.84), wh = step(0.22, rmx) * step(rsat, 0.2), botM = wh * step(0.34, yy) * step(yy, 0.68), shoeM = wh * step(yy, 0.22);
        vec3 an = pow(abs(normalize(vOn)), vec3(4.0)); an /= (an.x + an.y + an.z); vec3 q = vOp * uPrS;
        if (uPrTon > 0.5 && topM > 0.5) { vec3 pt = texture2D(uPrT, q.zy).rgb * an.x + texture2D(uPrT, q.xz).rgb * an.y + texture2D(uPrT, q.xy).rgb * an.z; float pl = dot(pt, vec3(0.3, 0.59, 0.11)); pt = clamp(mix(vec3(pl), pt, 1.3), 0.0, 1.0); diffuseColor.rgb = pt * (isLime > 0.5 ? 0.98 : mix(1.0, clamp(rl / 0.24, 0.6, 1.15), 0.55)); }
        if (botM > 0.5) { if (uPrBon > 0.5) { vec3 pb = texture2D(uPrB, q.zy).rgb * an.x + texture2D(uPrB, q.xz).rgb * an.y + texture2D(uPrB, q.xy).rgb * an.z; float pl2 = dot(pb, vec3(0.3, 0.59, 0.11)); pb = clamp(mix(vec3(pl2), pb, 1.3), 0.0, 1.0); diffuseColor.rgb = pb * clamp(rl / 0.75, 0.5, 1.1); } else if (uSkOn > 0.5) diffuseColor.rgb = uSkC * clamp(rl / 0.75, 0.45, 1.1); }
        if (shoeM > 0.5 && uShOn > 0.5) diffuseColor.rgb = uShC * clamp(rl / 0.75, 0.45, 1.1); }`;
