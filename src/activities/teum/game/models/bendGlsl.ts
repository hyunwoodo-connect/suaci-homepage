import { KEY_AT_GLSL } from "../keyColor";

// 모델 꼭짓점 셰이더 조각: 생물·날개는 뼈대 없이 몸을 휜다
// (1 네발 걸음·고갯짓, 2 꼬리 헤엄, 3 날갯짓, 4 해파리 갓과 촉수, 5 두 발).
// 몸 휘기 값이 저마다 다른 것을 한 번에 그리는 묶음(batch)에서는 같은 값이 인스턴스마다의 속성(aAn·aLime)으로 온다

/** 같은 묶음 셰이더(인스턴스 속성)를 쓰는지 알리는 정의 이름 */
export const BATCH_DEFINE = "TEUM_BATCH";

/**
 * 꼭짓점 셰이더 머리: 조각 셰이더로 넘기는 값(처음 자리 vOp · 물건 원점 vRo · 세계 자리 vKeyAt · 지역 색 값 vReg·vRegPaint)과 몸 휘기 값.
 * 지역 색 값: vReg 의 xy 는 색상을 돌리는 각의 코사인·사인, z 는 그 지역다운 정도(0..1), w 가 1 이면 지역 색을 입는다.
 * vRegPaint 는 그 마을의 물감 방향(분홍 0.52rad 이 돌아간 자리)
 */
export const VERTEX_HEAD = `varying vec3 vOp; varying vec3 vRo; varying vec3 vKeyAt; uniform float uAk; uniform float uAx;
#if TEUM_REGIONS > 0
uniform vec3 uHubV[TEUM_REGIONS]; uniform float uRegH[TEUM_REGIONS]; uniform vec2 uRegE; uniform float uRegK;
varying vec4 vReg; varying vec2 vRegPaint;
#endif
#ifdef ${BATCH_DEFINE}
attribute vec4 aAn; attribute float aLime; varying float vLime;
#define TEUM_AN aAn
#else
uniform vec4 uAn;
#define TEUM_AN uAn
#endif
`;

/**
 * begin_vertex 자리에 넣는다: 넘길 값을 채우고, 몸 휘는 방식(uAk)에 따라 꼭짓점을 옮긴다.
 * 지역 색 값(가장 가까운 마을·돌리는 각)은 물건이 선 자리로 정해져 물건마다 하나다 — 조각마다 마을을 찾지 않게 여기서 한 번만 센다
 * (나·고래·탈 것·라임은 uRegK 0, 생물은 몸 휘기 uAk 로, 몸에 붙은 것은 원점이라 빠진다)
 */
export const BEND_GLSL = `#include <begin_vertex>
  vOp = position;
  #ifdef USE_INSTANCING
  vRo = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #else
  vRo = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif
  #if TEUM_REGIONS > 0
  vReg = vec4(1.0, 0.0, 0.0, 0.0); vRegPaint = vec2(0.8678, 0.4969);
  if (uRegK > 0.5 && uAk < 0.5 && dot(vRo, vRo) > 1.0) {
    vec3 rn = normalize(vRo); float rb = -1.0, rh = 0.0;
    for (int i = 0; i < TEUM_REGIONS; i++) { float dH = dot(rn, uHubV[i]); if (dH > rb) { rb = dH; rh = uRegH[i]; } }
    float rw = smoothstep(uRegE.x, uRegE.x + uRegE.y, rb), ra = rh * rw;
    vReg = vec4(cos(ra), sin(ra), rw, 1.0); vRegPaint = vec2(cos(0.52 + ra), sin(0.52 + ra));
  }
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
  }${KEY_AT_GLSL}`;
