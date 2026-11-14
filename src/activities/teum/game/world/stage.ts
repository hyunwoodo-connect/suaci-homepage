import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import { LOOK } from "../look";
import { S } from "../settings";

// 그리는 틀: 렌더러·장면·카메라·빛·반사. 톤(초현실 팝)의 하늘색·안개·빛 세기로 바로 칠해 둔다

/** 그리는 틀 */
export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  /** 해 방향(하늘 셰이더도 쓴다) */
  SUN: THREE.Vector3;
  /** 풍선 같은 광택에 쓸 반사 */
  envTex: THREE.Texture;
  /** 렌더러와 반사 그림을 치운다 */
  dispose(): void;
}

/** 캔버스에 그리는 틀을 만든다 */
export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  // 고해상도 화면도 배율 2 까지만 그린다(배율을 올리면 그릴 픽셀 수가 제곱으로 는다)
  const deviceRatio = window.devicePixelRatio || 1;
  const pixelRatio = Math.min(deviceRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(LOOK.bg);
  // 멀리까지 색이 살아 있게 안개를 옅게. 배치를 마친 뒤의 값(28~340)
  scene.fog = new THREE.Fog(LOOK.bg, 28, 340);
  const camera = new THREE.PerspectiveCamera(S.fov, 1, 0.1, 900);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xd2d5d4, LOOK.light);
  scene.add(hemi);
  const SUN = new THREE.Vector3(0.8, 0.45, 0.4).normalize();
  const sun = new THREE.DirectionalLight(0xffffff, LOOK.sunI);
  sun.position.copy(SUN).multiplyScalar(10);
  scene.add(sun);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTex = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  // 초현실 팝: 놀이기구와 모델이 바람 넣은 풍선처럼 매끈하게 빛난다
  scene.environment = envTex;
  const dispose = () => {
    envTex.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
  return { renderer, scene, camera, hemi, sun, SUN, envTex, dispose };
}
