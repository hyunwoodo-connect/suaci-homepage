import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import type { LoadedAsset } from "@/lib/asset-kit/load";
import { createAssetLoader } from "@/lib/asset-kit/load";
import type { Manifest } from "@/lib/asset-kit/manifest";

import { AVATAR_BUNDLE, avatarAssetUrl } from "./bundle";
import { closetLabels } from "./closet-labels";
import { legacyAvatar } from "./legacy-record";
import { AvatarModels } from "./models";
import { blankOutfit } from "./outfit-shader";
import { AVATAR_BODY } from "./parts";
import { AvatarProfile } from "./profile";
import { LocalAvatarStore } from "./record";
import type { RigHandle } from "./rig";
import { setupRig } from "./rig";
import type { Locks } from "./outfit";
import type { PoseInput } from "./rig-pose";
import type { StudioHost } from "./studio";
import { Studio } from "./studio";
import { listenTurn } from "./turn-drag";
import { Turntable } from "./turntable";
import { Wardrobe } from "./wardrobe";

// 아바타의 방: 놀이 밖(이벤트 페이지)에서 내 아바타를 세워 보여 주고, 그 자리에서 꾸민다.
// 평소에는 틀 가운데에 선 아바타 둘레를 카메라가 천천히 돌며 비추고(초상 — 밀어서 돌려 볼 수도 있다), 옷장을 열면 놀이 안의 꾸미기 씬(studio)과 같은 화면이 된다 —
// 같은 옷장·같은 기록이라 여기서 고른 차림이 어느 놀이에서든 그대로 나온다. 방은 장면·카메라·빛을 내주고 프레임을 돌리기만 한다

/** 방을 여는 값 */
interface RoomOptions {
  /** 방을 여는 화면의 언어(옷장 글자) */
  locale: string;
  /** 아직 받지 못한 것(지금 — 놀이를 깨면 열리는 옷) */
  locks: () => Locks;
}

/** 방을 여는 쪽(화면)에 알리는 것 */
interface RoomHandlers {
  /** 몸과 지금 차림을 받아 그리기 시작했다 */
  onReady(): void;
  /** 옷장이 열리고 닫힐 때(완성을 누르면 닫힌다) */
  onToggle(isOpen: boolean): void;
  /** 밀어서 돌리기 시작했다(돌려 볼 수 있다는 안내를 거둘 때) */
  onTurn(): void;
  /** 몸을 받지 못했다 */
  onFail(): void;
}

/** 열려 있는 방 */
export interface OpenRoom {
  /** 옷장을 연다(그리기 시작한 뒤에만 열린다) */
  dress(): void;
  /** 옷장을 닫는다(완성 단추와 같다) */
  finish(): void;
  /** 멈추고 그리던 것·지켜보던 것·DOM 을 치운다 */
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
 * 초상(옷장이 닫혀 있을 때)에 담는 자리(m, 몸 가운데가 0): 머리 위 장식 끝에서 신발 밑(보드를 타면 보드 바퀴 밑)까지,
 * 벌린 팔과 손에 든 것까지의 너비. 둥실 뜨는 폭과 가장자리 여백을 얹은 값이고, 발밑에는 바닥 그림자와 안내 한 줄이 놓일 만큼 더 둔다
 */
const PORTRAIT_TOP = 1.15,
  PORTRAIT_FLOOR = -1.3,
  PORTRAIT_BOARD_FLOOR = -1.72,
  PORTRAIT_WIDTH = 1.8;
/** 초상의 카메라가 처음 선 각(얼굴 앞에서 조금 옆, 라디안) */
const PORTRAIT_ANGLE = 0.3;
/** 발밑 그림자: 반지름(m)·짙기, 발밑(보드를 타면 보드 밑)에서 조금 아래 */
const SHADOW_RADIUS = 0.72,
  SHADOW_INK = 0.2,
  SHADOW_Y = -0.8,
  SHADOW_BOARD_Y = -1.02;

/**
 * 방을 연다: 기록을 읽어 차림을 정하고, 몸과 그 차림의 부품·무늬를 받은 뒤 그리기 시작한다.
 * 나머지 부품·무늬는 옷장을 열 때 뒤에서 받는다(고르는 순간 바로 입게)
 */
export function openAvatarRoom(
  canvas: HTMLCanvasElement,
  manifest: Manifest,
  options: RoomOptions,
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
  const profile = new AvatarProfile(store, legacyAvatar);
  // 처음 온 사람은 아무 차림이나 입고 서 있다 — 꾸미지 않고 놀이에 들어가도 그 차림으로 나온다
  const wardrobe = new Wardrobe(outfit, avatar, profile, {
    dressNewcomer: true,
    rand: () => Math.random(),
    locks: options.locks,
  });
  wardrobe.useLoader(loader);
  const urlOf = (key: string) => avatarAssetUrl(manifest, key);
  const host: StudioHost = {
    scene,
    camera,
    avatar,
    stand: {
      P: new THREE.Vector3(),
      p: new THREE.Vector3(0, 1, 0),
      h: new THREE.Vector3(0, 0, 1),
    },
    // 옷장은 화면의 '꾸미기' 단추로 연다
    hasWearButton: false,
    labels: closetLabels(options.locale),
    locks: options.locks,
    need: (key) => models.need(key),
    onToggle(isOpen) {
      isDressing = isOpen;
      table.face();
      on.onToggle(isOpen);
    },
    onPicked() {},
  };
  const parent = canvas.parentElement ?? document.body;
  const studio = new Studio(host, wardrobe, parent, urlOf);

  // 발밑 그림자: 떠 있는 아바타를 스튜디오 바닥에 앉힌다(꾸미기 씬은 제 바닥 원판을 쓴다 — 그 층에는 올리지 않는다)
  const shadow = createShadow();
  scene.add(shadow);

  let stopped = false,
    isStarted = false,
    isVisible = true,
    raf = 0,
    last = 0;
  // 움직임 줄이기를 켠 사람에게는 둥실 뜨는 몸짓과 저절로 돌기를 멈춰 둔다
  const isStill = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // 초상의 카메라는 돌림판을 따라 아바타 둘레를 돈다(저절로, 그리고 밀어서)
  const table = new Turntable(isStill);
  let hasTurned = false;
  // 방 안의 아바타는 나아가지 않는다 — 제자리에서 둥실 떠 있는 몸짓만
  const frame: PoseInput = { dt: 0, tot: 0, vy: 0, air: 0, fx: 0, time: 0 };
  const step = (dt: number) => {
    frame.dt = dt;
    if (!isStill) frame.time += dt;
    rig?.pose(frame);
    studio.update(frame);
    if (!isDressing) {
      const hasBoard = wardrobe.look.board !== "";
      table.step(dt);
      shadow.position.y = hasBoard ? SHADOW_BOARD_Y : SHADOW_Y;
      framePortrait(camera, table.angle, hasBoard);
    }
    renderer.render(scene, camera);
  };
  const tick = (now: number) => {
    raf = 0;
    if (stopped) return;
    const elapsed = (now - last) / 1000;
    last = now;
    // 한 프레임은 길어도 0.1 초로 자른다(다른 탭에 다녀온 뒤 몸짓이 튀지 않게)
    const dt = Math.min(0.1, elapsed);
    step(dt);
    // 화면 밖으로 밀려 올라가 있는 동안은 그리지 않는다
    if (isVisible) raf = requestAnimationFrame(tick);
  };
  const wake = () => {
    if (stopped || !isStarted || !isVisible || raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };
  // 틀의 크기가 바뀌면(창 크기, 옷장을 열어 화면 가득 커질 때) 그 크기로 다시 그린다 — 크기를 바꾸면 그림이 비므로 바로
  const sizer = new ResizeObserver(() => {
    if (stopped) return;
    stage.resize();
    // 몸을 받기 전에는 빈 장면(배경색)만 — 그리지 않은 캔버스는 브라우저에 따라 검게 보인다
    if (isStarted) step(0);
    else renderer.render(scene, camera);
  });
  sizer.observe(canvas);
  const watcher = new IntersectionObserver((entries) => {
    // 한 번에 여러 알림이 오면 마지막 것이 지금이다
    const latest = entries[entries.length - 1];
    isVisible = latest.isIntersecting;
    wake();
  });
  watcher.observe(canvas);
  const stopTurning = listenTurn(canvas, {
    canTurn: () => isStarted && !isDressing,
    onHold: () => table.hold(),
    onMove(dx) {
      table.move(dx);
      if (hasTurned) return;
      hasTurned = true;
      on.onTurn();
    },
    onRelease: (speed) => table.release(speed),
  });
  const deliver = (key: string, asset: LoadedAsset) => {
    if (asset.kind === "model") models.deliver(key, asset.scene);
  };
  wardrobe.ready
    .then(() => {
      const wearing = wardrobe.assetKeys();
      return loader.loadMany([AVATAR_BODY, ...wearing], deliver);
    })
    .then(() => {
      if (stopped) return;
      // 몸이 없으면 보여 줄 것이 없다(부품·무늬는 못 받아도 그 자리만 비고 꾸미기는 된다)
      if (!rig) {
        on.onFail();
        return;
      }
      stage.resize();
      isStarted = true;
      on.onReady();
      wake();
    })
    .catch((err) => {
      console.error("avatar room", err);
      if (!stopped) on.onFail();
    });
  return {
    dress() {
      if (isStarted && !stopped) studio.show(true);
    },
    finish() {
      if (!stopped) studio.show(false);
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      sizer.disconnect();
      watcher.disconnect();
      stopTurning();
      shadow.removeFromParent();
      shadow.geometry.dispose();
      shadow.material.map?.dispose();
      shadow.material.dispose();
      studio.dispose();
      models.dispose();
      stage.dispose();
    },
  };
}

/* ─── 내부 ─────────────────────────── */

// 초상: 아바타를 틀 가운데에 담는 자리에 카메라를 둔다 — 틀의 모양(세로·가로)에 맞는 거리에서, 얼굴 앞에서 turned 만큼 돌아간 자리
function framePortrait(camera: THREE.PerspectiveCamera, turned: number, hasBoard: boolean) {
  const floor = hasBoard ? PORTRAIT_BOARD_FLOOR : PORTRAIT_FLOOR,
    height = PORTRAIT_TOP - floor,
    center = (PORTRAIT_TOP + floor) / 2;
  const halfFov = THREE.MathUtils.degToRad(FOV) / 2,
    reach = Math.tan(halfFov),
    tallFit = height / 2 / reach,
    wideFit = PORTRAIT_WIDTH / 2 / (reach * camera.aspect),
    distance = Math.max(tallFit, wideFit);
  const angle = PORTRAIT_ANGLE + turned;
  // 처음과 옷장을 닫은 직후에는 꾸미기 씬과 같은 쪽(얼굴 앞에서 아바타의 오른쪽)에 비켜 선다 — 옷장을 닫을 때 카메라가 반대편으로 건너뛰지 않게
  const side = -Math.sin(angle) * distance,
    front = Math.cos(angle) * distance;
  camera.position.set(side, center, front);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, center, 0);
}

// 발밑 그림자: 가운데가 짙고 가장자리로 사라지는 둥근 그림자(바닥에 눕힌 원판)
function createShadow(): THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> {
  const size = 128,
    half = size / 2;
  const pad = document.createElement("canvas");
  pad.width = size;
  pad.height = size;
  const pen = pad.getContext("2d");
  if (pen) {
    const fade = pen.createRadialGradient(half, half, 0, half, half, half);
    fade.addColorStop(0, `rgba(20,20,20,${SHADOW_INK})`);
    fade.addColorStop(0.55, `rgba(20,20,20,${SHADOW_INK * 0.45})`);
    fade.addColorStop(1, "rgba(20,20,20,0)");
    pen.fillStyle = fade;
    pen.fillRect(0, 0, size, size);
  }
  const map = new THREE.CanvasTexture(pad),
    geometry = new THREE.CircleGeometry(SHADOW_RADIUS, 40),
    material = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false });
  const shadow = new THREE.Mesh(geometry, material);
  shadow.rotation.x = -Math.PI / 2;
  return shadow;
}

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
