import * as THREE from "three";

import { LOOK } from "../look";
import { LIME } from "../settings";

// 물풍선의 생김새(에셋 없이 코드로): 통통한 물방울 몸 + 꼭지 매듭. 한 묶음(InstancedMesh)이라 몇 개든 그리기 호출은 하나다

/** 물풍선 색: suaci 키컬러 하나(오너 2026-11-23) — 길에 뜨는 방울(분홍·노랑·흰색·하늘)과 섞이지 않고, 라임은 먹을 것이다 */
export const BALLOON_TINT = LIME;

/** 몸 옆모습을 돌려 만드는 칸 수(세로 · 둘레) — 폰에서도 가볍게 */
const BODY_STEPS = 18,
  BODY_SIDES = 24;
/** 꼭지 옆모습([반지름, 몸 꼭대기에서 높이]): 가는 목 → 도톰하게 말린 매듭 */
const KNOT_PROFILE: readonly (readonly [number, number])[] = [
  [0.09, 0.0],
  [0.09, 0.07],
  [0.2, 0.1],
  [0.23, 0.17],
  [0.15, 0.23],
  [0, 0.23],
];

// 몸의 색과 반짝임(카메라 기준 법선 normal 로 잰다 — 풍선이 흔들려도 반짝임은 늘 왼쪽 위에 붙어 있다).
// 몸 색은 장면의 조명을 받지 않는다: 조명이 더해지면 라임이 누렇게 떠 키컬러로 보이지 않는다. 제 색을 그대로 쓰고
// 아래쪽·가장자리만 조금 어둡게 해 둥근 모양을 낸다(제 색보다 밝아지지 않는다). 흰 반짝임은 콩 모양 하나(wbBig)와 점 하나(wbDot)
const BALLOON_SHINE_GLSL = `
  vec3 wbAt = normalize(vec3(-0.50, 0.36, 0.79));
  vec3 wbAlong = normalize(cross(wbAt, vec3(0.0, 0.0, 1.0)));
  vec3 wbAcross = cross(wbAt, wbAlong);
  vec3 wbOff = normal - wbAt;
  vec2 wbBean = vec2(dot(wbOff, wbAlong) / 0.36, dot(wbOff, wbAcross) / 0.15);
  float wbBig = 1.0 - smoothstep(0.82, 1.0, length(wbBean));
  float wbDot = 1.0 - smoothstep(0.075, 0.095, length(normal - normalize(vec3(-0.74, -0.10, 0.66))));
  float wbRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.4);
  float wbShade = (0.84 + 0.16 * smoothstep(-0.7, 0.5, normal.y)) * (1.0 - 0.14 * wbRim);
  outgoingLight = diffuseColor.rgb * wbShade;
  outgoingLight = mix(outgoingLight, vec3(1.0), 0.94 * max(wbBig, wbDot));
`;

/**
 * 물풍선 몸(반지름 1, 가운데가 원점): 아래는 물이 고여 조금 납작하고 위는 물방울처럼 좁아지다가 꼭지에서 매듭으로 끝난다.
 * 옆모습 한 줄을 세로축으로 돌려 만든다
 */
export function createBalloonGeometry(): THREE.LatheGeometry {
  const profile: THREE.Vector2[] = [];
  // 몸 꼭대기의 뾰족한 끝 점은 빼고(i < BODY_STEPS) 거기서 꼭지로 잇는다
  for (let i = 0; i < BODY_STEPS; i++) {
    const [r, y] = bodyPoint(i);
    const point = new THREE.Vector2(r, y);
    profile.push(point);
  }
  const [, top] = bodyPoint(BODY_STEPS);
  for (const [r, lift] of KNOT_PROFILE) {
    const y = top + lift,
      point = new THREE.Vector2(r, y);
    profile.push(point);
  }
  return new THREE.LatheGeometry(profile, BODY_SIDES);
}

/**
 * 물풍선 재질: 키컬러가 조명에 밀리지 않게 제 색 그대로 칠하고, 카메라에서 본 왼쪽 위에 흰 반짝임을 얹는다.
 * 색은 묶음의 칸마다(instanceColor) 온다
 */
export function createBalloonMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: LOOK.toyRough,
    metalness: 0,
  });
  mat.name = "waterBalloon";
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `${BALLOON_SHINE_GLSL}\n#include <opaque_fragment>`,
    );
  };
  return mat;
}

/* ─── 내부 ─────────────────────────── */

// 몸 옆모습의 i 번째 점 [반지름, 높이]: 공에서 시작해 위쪽 절반만 늘이고 조인다(아래쪽은 눌러 물이 고인 배처럼)
function bodyPoint(i: number): [number, number] {
  const turn = (Math.PI * i) / BODY_STEPS,
    round = Math.sin(turn),
    rise = -Math.cos(turn),
    upper = Math.max(0, rise);
  const y = rise < 0 ? rise * 0.92 : rise * (1 + 0.34 * upper),
    r = round * (1 - 0.2 * upper * upper);
  return [r, y];
}
