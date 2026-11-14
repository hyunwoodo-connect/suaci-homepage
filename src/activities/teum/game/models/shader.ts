import * as THREE from "three";

import { GLOWING_LIME, MODEL_STRIPES, MODEL_TINT } from "../../assets/settings";
import type { LookUniforms } from "../look";
import { LOOK } from "../look";

// 모델 재질의 톤 셰이더: 채도·색조·줄무늬·라임 물들기, 그리고 생물·날개는 뼈대 없이 몸을 휜다
// (1 네발 걸음·고갯짓, 2 꼬리 헤엄, 3 날갯짓, 4 해파리 갓과 촉수, 5 두 발).
// 같은 키의 모델은 재질 하나를 같이 쓴다. 몸 휘기 값(uAn)·라임(uLime)이 저마다 다른 것은 여러 개를 한 번에 그리는 묶음(batch)으로
// 그리고, 그때는 같은 값이 인스턴스마다의 속성(aAn·aLime)으로 온다 — 셰이더 갈래는 이 둘뿐이다

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
    sh.vertexShader = VERTEX_HEAD + sh.vertexShader.replace("#include <begin_vertex>", BEND_GLSL);
    sh.fragmentShader =
      FRAGMENT_HEAD + sh.fragmentShader.replace("#include <map_fragment>", TONE_GLSL);
  };
  mat.customProgramCacheKey = () => (o.batch ? "teum-look8-batch" : "teum-look8");
  mat.needsUpdate = true;
}

/* ─── 내부 ─────────────────────────── */

const VERTEX_HEAD = `varying vec3 vOp; uniform float uAk; uniform float uAx;
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

const FRAGMENT_HEAD = `uniform float uSat; uniform float uWash; uniform vec3 uTint; uniform float uTK; uniform float uPat; uniform float uPY; uniform vec3 uTint2; varying vec3 vOp;
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
