import * as THREE from "three";

// 몸 둘레 윤곽선(뒤집은 껍데기): 모델의 각 면을 같은 모양 그대로 한 번 더 그리되 뒷면만, 화면에서 법선 쪽으로 px 만큼 밀어 낸다 —
// 거리와 상관없이 폰에서 같은 굵기로 몸 둘레에 테두리가 생긴다. 숨은 상자의 흰 테두리와 전설 고래의 금빛 테두리가 쓴다.
// 안개에 묻히지 않는다(배경이 무슨 색이든 떠 보이게)

/** 화면 크기(CSS px) — 굵기를 px 로 맞추는 데 쓴다. 판이 프레임마다 채운다 */
export const OUTLINE_VIEW = { value: new THREE.Vector2(390, 844) };

/** 윤곽선 재질에 정점 셰이더 조각을 더할 때(상자 귀처럼 몸이 휘는 모델 — 껍데기도 같이 휘어야 한다) */
export interface HullBend {
  /** 셰이더 머리에 둘 선언 */
  head: string;
  /** #include <begin_vertex> 를 갈음할 조각(transformed 를 고친다) */
  vertex: string;
  uniforms: Record<string, THREE.IUniform>;
  /** 프로그램을 나누는 이름 */
  key: string;
}

/** 윤곽선 하나의 손잡이: 색·굵기(px)·진하기 */
export interface Hull {
  readonly color: { value: THREE.Color };
  readonly px: { value: number };
  readonly opacity: { value: number };
  /** 보이나 */
  visible: boolean;
  dispose(): void;
}

const HULL_VERTEX = `#include <project_vertex>
  { vec3 hullNormal = normal;
  #ifdef USE_INSTANCING
    hullNormal = mat3(instanceMatrix) * hullNormal;
  #endif
  vec4 hullN = projectionMatrix * modelViewMatrix * vec4(hullNormal, 0.0);
  vec2 hullDir = hullN.xy;
  float hullLen = length(hullDir);
  if (hullLen > 1e-5) gl_Position.xy += (hullDir / hullLen) * uHullPx * 2.0 / uHullView * gl_Position.w; }`;

/** 윤곽선 재질 하나와 그 색·진하기 값 */
export interface HullMaterial {
  material: THREE.MeshBasicMaterial;
  color: { value: THREE.Color };
  opacity: { value: number };
}

/**
 * 윤곽선 재질: 뒷면만 그리고 화면에서 법선 쪽으로 px 만큼 민다. 같은 모양을 여러 번 찍는 묶음(InstancedMesh)에도 쓸 수 있다 —
 * 찍은 것마다의 돌림을 법선에 입힌다
 */
export function hullMaterial(
  color: THREE.ColorRepresentation,
  px: { value: number },
  bend: HullBend | null = null,
): HullMaterial {
  const uColor = { value: new THREE.Color(color) },
    uOpacity = { value: 1 };
  const mat = new THREE.MeshBasicMaterial({
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uHullPx = px;
    sh.uniforms.uHullView = OUTLINE_VIEW;
    sh.uniforms.uHullColor = uColor;
    sh.uniforms.uHullOpacity = uOpacity;
    let vertex = sh.vertexShader.replace("#include <project_vertex>", HULL_VERTEX);
    if (bend) {
      Object.assign(sh.uniforms, bend.uniforms);
      vertex = bend.head + vertex.replace("#include <begin_vertex>", bend.vertex);
    }
    sh.vertexShader = "uniform float uHullPx;\nuniform vec2 uHullView;\n" + vertex;
    const fragment = sh.fragmentShader.replace(
      "vec4 diffuseColor = vec4( diffuse, opacity );",
      "vec4 diffuseColor = vec4( uHullColor, uHullOpacity );",
    );
    sh.fragmentShader = "uniform vec3 uHullColor;\nuniform float uHullOpacity;\n" + fragment;
  };
  const bendKey = bend ? bend.key : "plain";
  mat.customProgramCacheKey = () => `teum-hull-${bendKey}`;
  return { material: mat, color: uColor, opacity: uOpacity };
}

/**
 * root 아래 모든 면에 윤곽선 껍데기를 붙인다(이미 붙인 껍데기는 건너뛴다). 처음에는 숨겨 둔다.
 * px 는 바깥에서 바꾸면 그대로 따른다(같은 값을 여러 몸이 나눠 써도 된다)
 */
export function addHull(
  root: THREE.Object3D,
  color: THREE.ColorRepresentation,
  px: { value: number },
  bend: HullBend | null = null,
): Hull {
  const { material: mat, color: uColor, opacity: uOpacity } = hullMaterial(color, px, bend);
  const shells: THREE.Mesh[] = [];
  const sources: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && !o.userData.isHull) sources.push(o);
  });
  for (const src of sources) {
    const shell = new THREE.Mesh(src.geometry, mat);
    shell.userData.isHull = true;
    shell.renderOrder = src.renderOrder - 1;
    shell.visible = false;
    src.add(shell);
    shells.push(shell);
  }
  let isOn = false;
  return {
    color: uColor,
    px,
    opacity: uOpacity,
    get visible() {
      return isOn;
    },
    set visible(on: boolean) {
      isOn = on;
      for (const s of shells) s.visible = on;
    },
    dispose() {
      for (const s of shells) s.removeFromParent();
      mat.dispose();
    },
  };
}
