import * as THREE from "three";

import { LOOK } from "../look";
import { LIME } from "../settings";

// 물풍선의 생김새(에셋 없이 코드로): 통통한 물방울 몸 + 꼭지 매듭, 그리고 멀리서 찾게 해 주는 물빛 기둥.
// 몸도 기둥도 한 묶음(InstancedMesh)씩이라 물풍선이 몇 개든 그리기 호출은 둘이다

/** 물풍선 색: 하늘·핫핑크·노랑·라임을 자리 차례대로 돌린다 */
export const BALLOON_TINTS: readonly number[] = [0x35c8ff, 0xff4f9a, 0xffd21f, LIME];

/** 물빛 기둥이 물풍선 위로 더 솟는 길이(m) — 행성이 작아 금방 지평선에 가리므로 높이 세워야 멀리서 보인다 */
export const BEAM_ABOVE = 120;

/**
 * 기둥: 반지름(m) · 가장 밝을 때의 진하기 · 나나 카메라가 이 거리(m) 안이면 안 보이고 → 이 거리부터 다 보인다.
 * 멀수록 진하게 — 먼 기둥은 몇 픽셀 굵기라 진해야 보이고, 가까운 기둥은 옅어야 풍경을 가리지 않는다
 */
const BEAM_RADIUS = 2.4,
  BEAM_GLOW = 0.7,
  BEAM_NEAR: readonly [number, number] = [16, 160];
/** 기둥 색에 섞는 흰색(물빛) */
const BEAM_WHITE = 0.25;
const WHITE = new THREE.Color(0xffffff);

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

// 몸의 반짝임(카메라 기준 법선 normal 로 잰다 — 풍선이 흔들려도 반짝임은 늘 왼쪽 위에 붙어 있다):
// 콩 모양 하나(wbBig)와 그 아래 점 하나(wbDot), 가장자리의 물빛(wbRim), 그늘에서도 색이 죽지 않게 제 색을 조금 더한다
const BALLOON_SHINE_GLSL = `
  vec3 wbAt = normalize(vec3(-0.50, 0.36, 0.79));
  vec3 wbAlong = normalize(cross(wbAt, vec3(0.0, 0.0, 1.0)));
  vec3 wbAcross = cross(wbAt, wbAlong);
  vec3 wbOff = normal - wbAt;
  vec2 wbBean = vec2(dot(wbOff, wbAlong) / 0.36, dot(wbOff, wbAcross) / 0.15);
  float wbBig = 1.0 - smoothstep(0.82, 1.0, length(wbBean));
  float wbDot = 1.0 - smoothstep(0.075, 0.095, length(normal - normalize(vec3(-0.74, -0.10, 0.66))));
  float wbRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.4);
  outgoingLight += diffuseColor.rgb * 0.2 + vec3(0.32 * wbRim);
  outgoingLight = mix(outgoingLight, vec3(1.0), 0.94 * max(wbBig, wbDot));
`;

// 기둥 꼭짓점: 칸(인스턴스)의 세로 눈금이 곧 기둥 길이(m)다. 나(uEye)와 카메라 가운데 가까운 쪽에서 기둥 축까지의 거리로 옅게 한다
const BEAM_VERTEX_GLSL = `
  uniform vec3 uEye;
  uniform vec2 uNear;
  uniform float uAbove;
  varying float vHeight;
  varying float vAbove;
  varying float vNear;
  varying vec3 vTint;
  varying vec3 vSide;
  varying vec3 vView;
  void main() {
    mat4 world = modelMatrix * instanceMatrix;
    vec3 foot = world[3].xyz;
    float len = length(world[1].xyz);
    vec3 axis = world[1].xyz / len;
    vec3 toEye = uEye - foot;
    vec3 toCamera = cameraPosition - foot;
    float awayEye = length(toEye - axis * dot(toEye, axis));
    float awayCamera = length(toCamera - axis * dot(toCamera, axis));
    vNear = smoothstep(uNear.x, uNear.y, min(awayEye, awayCamera));
    vHeight = position.y * len;
    vAbove = (vHeight - (len - uAbove)) / uAbove;
    vTint = instanceColor;
    vec4 view = viewMatrix * world * vec4(position, 1.0);
    vView = view.xyz;
    vSide = mat3(viewMatrix * world) * vec3(normal.x, 0.0, normal.z);
    gl_Position = projectionMatrix * view;
  }
`;

// 기둥 색: 옆에서 본 가장자리로 갈수록 옅게(facing), 물풍선 위로는 사라지게(fade), 물결처럼 위로 흐르는 일렁임(shimmer)
const BEAM_FRAGMENT_GLSL = `
  uniform float uT;
  uniform float uGlow;
  varying float vHeight;
  varying float vAbove;
  varying float vNear;
  varying vec3 vTint;
  varying vec3 vSide;
  varying vec3 vView;
  void main() {
    float facing = abs(dot(normalize(vSide), normalize(vView)));
    float fade = 1.0 - smoothstep(0.3, 1.0, vAbove);
    float foot = smoothstep(0.0, 2.0, vHeight);
    float shimmer = 0.86 + 0.14 * sin(vHeight * 0.35 - uT * 2.4);
    float a = uGlow * facing * facing * facing * fade * foot * shimmer * vNear;
    gl_FragColor = vec4(vTint, a);
    #include <colorspace_fragment>
  }
`;

/** 물빛 기둥의 셰이더 값: 시계 · 나의 자리 */
export interface BeamUniforms {
  uT: { value: number };
  uEye: { value: THREE.Vector3 };
}

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
 * 물풍선 재질: 풍선처럼 매끈한 팝 톤에, 카메라에서 본 왼쪽 위의 흰 반짝임과 물빛 가장자리를 얹는다.
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

/** 물빛 기둥 모양: 바닥이 원점, 높이 1, 반지름은 기둥 굵기 — 칸마다 세로로 늘여 쓴다(뚜껑 없는 원통) */
export function createBeamGeometry(): THREE.CylinderGeometry {
  const geo = new THREE.CylinderGeometry(BEAM_RADIUS, BEAM_RADIUS, 1, 20, 1, true);
  geo.translate(0, 0.5, 0);
  return geo;
}

/**
 * 물빛 기둥 재질: 더해지는 빛(뒤를 가리지 않는다). 가장자리로 갈수록 옅어 관이 아니라 빛줄기로 보이고,
 * 물풍선 위로는 서서히 사라지고, 내가 가까이 가면 사라져 시야를 막지 않는다. 안개는 타지 않는다 — 멀리서 찾으라고 세운 것이다
 */
export function createBeamMaterial(uniforms: BeamUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: "waterBalloonBeam",
    uniforms: {
      ...uniforms,
      uAbove: { value: BEAM_ABOVE },
      uGlow: { value: BEAM_GLOW },
      uNear: { value: new THREE.Vector2(...BEAM_NEAR) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: BEAM_VERTEX_GLSL,
    fragmentShader: BEAM_FRAGMENT_GLSL,
  });
}

/** 물풍선 색(자리 차례 i)의 기둥 색을 out 에: 물빛이 돌게 흰색을 섞는다 */
export function beamTintInto(out: THREE.Color, i: number): THREE.Color {
  const hex = BALLOON_TINTS[i % BALLOON_TINTS.length];
  return out.set(hex).lerp(WHITE, BEAM_WHITE);
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
