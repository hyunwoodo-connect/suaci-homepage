import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import { BG, S } from "../state";

/** 그리는 틀: 렌더러·장면·카메라·빛·반사 */
export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  /** 장면 배경색 */
  background: THREE.Color;
  fog: THREE.Fog;
  camera: THREE.PerspectiveCamera;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  /** 해 방향(하늘 셰이더도 쓴다) */
  SUN: THREE.Vector3;
  /** 풍선 같은 광택에 쓸 반사 */
  envTex: THREE.Texture;
}

/** 캔버스에 그리는 틀을 만든다 */
export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const background = new THREE.Color(BG);
  scene.background = background;
  const fog = new THREE.Fog(BG, 140, 620); // 멀리까지 색이 살아 있게 안개를 옅게
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(S.fov, 1, 0.1, 900);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd2d5d4, 1.5);
  scene.add(hemi);
  const SUN = new THREE.Vector3(0.8, 0.45, 0.4).normalize();
  const sun = new THREE.DirectionalLight(0xffffff, 0.75);
  sun.position.copy(SUN).multiplyScalar(10);
  scene.add(sun);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return { renderer, scene, background, fog, camera, hemi, sun, SUN, envTex };
}
