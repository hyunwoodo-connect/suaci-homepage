import { FLOOD_GLSL, keyPaintGlsl } from "../keyColor";
import { BATCH_DEFINE } from "./bendGlsl";

// 모델 조각 셰이더의 색 조각: 톤(채도·색조·줄무늬) → 지역 색(마을마다 색상을 돌리고 라임 둘레 색을 거른다) → 라임 물들기.
// 이 차례가 뜻이 있다 — 지역 색이 라임 둘레 색을 돌려세우므로 라임 물들기는 그 뒤에 와야 한다

/** 조각 셰이더 머리: 톤·지역·라임·물결 값. 라임 물드는 정도는 묶음이면 인스턴스 값(vLime), 아니면 재질 값(uLime) */
export const FRAGMENT_HEAD = `uniform float uSat; uniform float uWash; uniform vec3 uTint; uniform float uTK; uniform float uPat; uniform float uPY; uniform vec3 uTint2; varying vec3 vOp; varying vec3 vRo; varying vec3 vKeyAt; uniform float uAk; uniform vec4 uFlood; uniform float uFloodK; uniform float uKeyK;
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

/** map_fragment 자리에 넣는다: 채도, 그리고 정해진 색조·줄무늬로 칠하기 */
export const TONE_GLSL = `#include <map_fragment>
      float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
      diffuseColor.rgb = mix(vec3(lum), diffuseColor.rgb, uSat);
      // 색 배합: 에셋의 명암과 채도는 그대로 두고 색상만 정해진 색으로 바꾼다. 원래 흰 부분은 희게 남아 '정해진 색 + 흰색' 두 톤이 된다
      float mx = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)), mn = min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b));
      float sK = smoothstep(0.04, 0.4, mx > 0.0 ? (mx - mn) / mx : 0.0);
      vec3 tC = uTint; if (uPat > 0.5 && vOp.y < uPY) { tC = fract(atan(vOp.z, vOp.x) * 1.5915) < 0.5 ? uTint2 : vec3(1.0); sK = 1.0; } // 줄기는 세로 줄무늬(열 줄)
      vec3 mapped = mix(vec3(1.0), tC, sK) * mix(mx, 1.0, 0.24);
      mapped = mix(mapped, vec3(mix(mx, 1.0, 0.62)), step(2.95, uTint.r + uTint.g + uTint.b) * (1.0 - step(0.5, uPat) * step(vOp.y, uPY))); // 흰색으로 정한 것은 밝은 회색~흰색 명암만 남긴다
      diffuseColor.rgb = mix(diffuseColor.rgb, mapped, uTK);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), uWash);`;

/**
 * 지역 색: 물건이 선 자리(인스턴스 원점 vRo)에서 가장 가까운 마을의 각만큼 YIQ 색상을 돌린다. 흰색은 그대로(색이 없다).
 * 그러고도 라임 둘레에 남는 색(노랑·초록·청록 — YIQ 에서 라임 쪽 반원)은 그 마을의 물감(분홍이 돌아간 자리, 분홍은 0.52rad) 쪽으로
 * 돌려세운다: 라임은 키컬러만 쓴다(look.ts 톤 규칙 ①).
 * 노랑 쪽(rs 가 양수)은 더 넓게 거른다 — 호박색 같은 주황빛 노랑도 화면에서는 조명을 받아 노랑으로 보인다. 주황(0.28rad)·귤색은 남는다.
 * 지역 사이에서는 채도를 조금 낮춰 지역이 더 또렷하다
 */
export const REGION_GLSL = `
      #if TEUM_REGIONS > 0
      if (uRegK > 0.5 && uAk < 0.5 && dot(vRo, vRo) > 1.0) {
        // 가장 가까운 마을(rb 는 그 마을과 이루는 각의 코사인)과 그 마을이 돌리는 각
        vec3 rn = normalize(vRo), rc = diffuseColor.rgb; float rb = -1.0, rh = 0.0;
        for (int i = 0; i < TEUM_REGIONS; i++) { float dH = dot(rn, uHubV[i]); if (dH > rb) { rb = dH; rh = uRegH[i]; } }
        float rw = smoothstep(uRegE.x, uRegE.x + uRegE.y, rb), ra = rh * rw, cs = cos(ra), sn = sin(ra);
        // 색을 YIQ 로 옮겨 색상(iq)만 돌린다
        vec3 yiq = vec3(dot(rc, vec3(0.299, 0.587, 0.114)), dot(rc, vec3(0.596, -0.274, -0.322)), dot(rc, vec3(0.211, -0.523, 0.312)));
        vec2 iq = vec2(yiq.y * cs - yiq.z * sn, yiq.y * sn + yiq.z * cs);
        // 라임 둘레 색인가(rk: 라임 쪽과 이루는 각의 코사인, rs: 노랑 쪽이면 양수) → 그 마을의 물감 쪽으로
        float rm = length(iq); vec2 ru = iq / max(rm, 0.0001); float rk = dot(ru, vec2(-0.118, -0.993)), rs = 0.993 * ru.x - 0.118 * ru.y;
        float rival = mix(smoothstep(-0.05, 0.12, rk), smoothstep(-0.2, -0.08, rk), step(0.0, rs)) * smoothstep(0.02, 0.08, rm);
        iq = mix(iq, vec2(cos(0.52 + ra), sin(0.52 + ra)) * rm, rival);
        rc = vec3(yiq.x + 0.956 * iq.x + 0.621 * iq.y, yiq.x - 0.272 * iq.x - 0.647 * iq.y, yiq.x - 1.106 * iq.x + 1.703 * iq.y);
        diffuseColor.rgb = clamp(mix(vec3(yiq.x), rc, mix(0.6, 1.0, rw)), 0.0, 1.0);
      }
      #endif`;

/**
 * 라임 물들기: 반응한 것과 라임 과일(uKeyK)은 키컬러 그대로가 된다(어두운 무늬만 남긴다). 끝 장면의 물결(FLOOD_GLSL)도 여기서 닿는다 —
 * 등장인물(uFloodK 0)과 생물(uAk)은 물들지 않는다
 */
export const LIME_GLSL = `
      { float lmLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(diffuseColor.rgb, ${keyPaintGlsl("lmLum")}, max(TEUM_LIME, uKeyK)); }
      if (uFloodK > 0.5 && uAk < 0.5) {${FLOOD_GLSL}
      }`;
