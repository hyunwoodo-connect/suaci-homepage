import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import type { LoadedAsset } from "@/lib/asset-kit/load";
import { createAssetLoader } from "@/lib/asset-kit/load";
import type { Manifest } from "@/lib/asset-kit/manifest";
import { assetUrl } from "@/lib/asset-kit/manifest";

import { AVATAR_BUNDLE } from "./bundle";
import { AvatarModels } from "./models";
import { blankOutfit } from "./outfit-shader";
import { AVATAR_BODY } from "./parts";
import { AvatarProfile } from "./profile";
import { LocalAvatarStore } from "./record";
import type { RigHandle } from "./rig";
import { setupRig } from "./rig";
import type { PoseInput } from "./rig-pose";
import type { StudioHost } from "./studio";
import { Studio } from "./studio";
import { Wardrobe } from "./wardrobe";

// 꾸미기 방: 놀이에 들어가지 않고 아바타만 세워 꾸미는 곳. 놀이 안의 꾸미기 씬(studio)과 같은 화면·같은 옷장·같은 기록을 쓴다 —
// 여기서 고른 차림이 어느 놀이에서든 그대로 나온다. 방은 장면·카메라·빛을 내주고 프레임을 돌리기만 한다

/** 방을 여는 쪽(페이지)에 알리는 것 */
interface RoomHandlers {
  /** 몸과 지금 차림을 받는 동안(받은 바이트 / 전체). 그리기 시작하면 1 */
  onProgress(ratio: number): void;
  /** 옷장이 열리고 닫힐 때(완성을 누르면 닫히고, 옷장 단추로 다시 열린다) */
  onToggle(isOpen: boolean): void;
  /** 몸을 받지 못했다 */
  onFail(): void;
}

/** 열려 있는 방 */
interface OpenRoom {
  /** 멈추고 그리던 것·리스너·DOM 을 치운다 */
  stop(): void;
}

/** 화각. 꾸미기 씬의 카메라 거리가 이 화각에 맞춰져 있다 */
const FOV = 58;
/** 옷장을 닫았을 때의 배경(사이트의 스튜디오 그레이). 열려 있는 동안은 꾸미기 씬이 윗옷에 맞춘 색으로 칠한다 */
const BACKDROP = 0xd3d4d8;
/** 하늘빛·땅빛과 그 세기, 해의 세기 — 놀이(틈)의 꾸미기 씬과 같은 밝기 */
const SKY_LIGHT = 0xffffff,
  GROUND_LIGHT = 0xd2d5d4,
  SKY_POWER = 2.0,
  SUN_POWER = 1.3;

/**
 * 방을 연다: 기록을 읽어 차림을 정하고, 몸과 그 차림의 부품·무늬를 받은 뒤 옷장을 열고 그리기 시작한다.
 * 나머지 부품·무늬는 옷장이 열릴 때 뒤에서 받는다(고르는 순간 바로 입게)
 */
export function openAvatarRoom(
  canvas: HTMLCanvasElement,
  manifest: Manifest,
  on: RoomHandlers,
): OpenRoom {
  const stage = createStage(canvas);
  const { renderer, scene, camera } = stage;
  const loader = createAssetLoader(AVATAR_BUNDLE, manifest);
  const outfit = blankOutfit();
  const models = new AvatarModels(manifest, loader, outfit);
  // 아바타가 선 자리: 장면의 가운데에서 위(+y)를 이고 앞(+z)을 본다
  const tiltG = new THREE.Group();
  scene.add(tiltG);
  let rig: RigHandle | null = null;
  const rigWaiting: ((rig: RigHandle) => void)[] = [];
  const avatar = {
    tiltG,
    whenRig(cb: (rig: RigHandle) => void) {
      if (rig) cb(rig);
      else rigWaiting.push(cb);
    },
  };
  setupRig(models, { tiltG, standIns: [] }, (arrived) => {
    rig = arrived;
    for (const cb of rigWaiting.splice(0)) cb(arrived);
  });
  let isDressing = false;
  const store = new LocalAvatarStore();
  const profile = new AvatarProfile(store);
  // 처음 온 사람은 아무 차림이나 입고 시작한다 — 완성만 눌러도 차림이 남게
  const wardrobe = new Wardrobe(outfit, avatar, profile, {
    dressNewcomer: true,
    rand: () => Math.random(),
  });
  wardrobe.useLoader(loader);
  const urlOf = (key: string) => {
    const entry = manifest.assets[key];
    return entry ? assetUrl(AVATAR_BUNDLE, entry.file) : null;
  };
  const host: StudioHost = {
    scene,
    camera,
    avatar,
    stand: {
      P: new THREE.Vector3(),
      p: new THREE.Vector3(0, 1, 0),
      h: new THREE.Vector3(0, 0, 1),
    },
    need: (key) => models.need(key),
    onToggle(isOpen) {
      isDressing = isOpen;
      // 옷장을 닫으면 돌려 보던 자리에 두지 않고 얼굴 앞으로 — 저장한 차림을 앞에서 보여 준다
      if (!isOpen) studio.faceFront();
      on.onToggle(isOpen);
    },
    onPicked() {},
  };
  const parent = canvas.parentElement ?? document.body;
  const studio = new Studio(host, wardrobe, parent, urlOf);

  let stopped = false,
    raf = 0,
    last = 0;
  // 방 안의 아바타는 나아가지 않는다 — 제자리에서 둥실 떠 있는 몸짓만
  const frame: PoseInput = { dt: 0, tot: 0, vy: 0, air: 0, fx: 0, time: 0 };
  const tick = (now: number) => {
    if (stopped) return;
    const elapsed = (now - last) / 1000;
    last = now;
    // 한 프레임은 길어도 0.1 초로 자른다(다른 탭에 다녀온 뒤 몸짓이 튀지 않게)
    frame.dt = Math.min(0.1, elapsed);
    frame.time += frame.dt;
    rig?.pose(frame);
    studio.update(frame);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(tick);
  };
  const onResize = () => {
    stage.resize();
    // 옷장이 닫혀 있으면 카메라를 다시 잡아 줄 것이 없다 — 화면 모양에 맞는 거리로 다시 둔다
    if (!isDressing) studio.faceFront();
  };
  addEventListener("resize", onResize);
  const deliver = (key: string, asset: LoadedAsset) => {
    if (asset.kind === "model") models.deliver(key, asset.scene);
  };
  // 다 받아도 0.99 에서 멈춘다 — 1 은 그리기 시작할 때 보낸다
  const report = (loaded: number, total: number) => {
    const share = total ? loaded / total : 1;
    const ratio = Math.min(0.99, share);
    on.onProgress(ratio);
  };
  wardrobe.ready
    .then(() => {
      const wearing = wardrobe.assetKeys();
      return loader.loadMany([AVATAR_BODY, ...wearing], deliver, report);
    })
    .then(() => {
      if (stopped) return;
      // 몸이 없으면 꾸밀 것이 없다(부품·무늬는 못 받아도 그 자리만 비고 꾸미기는 된다)
      if (!rig) {
        on.onFail();
        return;
      }
      stage.resize();
      studio.show(true);
      on.onProgress(1);
      last = performance.now();
      raf = requestAnimationFrame(tick);
    })
    .catch((err) => {
      console.error("avatar room", err);
      if (!stopped) on.onFail();
    });
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      removeEventListener("resize", onResize);
      studio.dispose();
      models.dispose();
      stage.dispose();
    },
  };
}

/* ─── 내부 ─────────────────────────── */

// 그리는 틀: 렌더러·장면·카메라·빛·반사. 놀이의 꾸미기 씬과 같은 밝기와 광택으로 보이게 맞춘다
function createStage(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  // 고해상도 화면도 배율 2 까지만 그린다(배율을 올리면 그릴 픽셀 수가 제곱으로 는다)
  const deviceRatio = window.devicePixelRatio || 1;
  const pixelRatio = Math.min(deviceRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKDROP);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  const sky = new THREE.HemisphereLight(SKY_LIGHT, GROUND_LIGHT, SKY_POWER);
  // 해는 얼굴 앞 위쪽에서 — 어느 쪽으로 돌려 봐도 얼굴과 옷의 앞이 밝다
  const sun = new THREE.DirectionalLight(SKY_LIGHT, SUN_POWER);
  sun.position.set(3, 7, 6);
  scene.add(sky, sun);
  // 몸과 부품이 바람 넣은 풍선처럼 매끈하게 빛나게 하는 반사
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTex = pmrem.fromScene(room, 0.04).texture;
  pmrem.dispose();
  scene.environment = envTex;
  return {
    renderer,
    scene,
    camera,
    resize() {
      const width = canvas.clientWidth || innerWidth,
        height = canvas.clientHeight || innerHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    dispose() {
      envTex.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
