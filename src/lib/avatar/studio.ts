import * as THREE from "three";

import { Closet } from "./closet";
import type { ClosetLabels } from "./closet-labels";
import { ease } from "./motion";
import type { LookTab } from "./outfit";
import { PRINTS, STUDIO_BG } from "./outfit";
import { PARTS } from "./parts";
import type { RigOwner, Wardrobe } from "./wardrobe";

// 꾸미기 씬(스튜디오): 놀이의 장면을 가리고 단색 배경 앞에 아바타만 세운다.
// 열면 카메라가 아바타만 올린 층(STUDIO_LAYER)을 본다 — 물건을 숨기는 방식이 아니라서 놀이가 visible 을 건드려도 영향이 없다.
// 배경은 윗옷 무늬에 맞춘 단색, 무대를 밀면 카메라가 아바타 둘레를 돌고, 고를 때마다 저절로 조금(4분의 1 바퀴쯤) 돈다.
// 처음 온 사람(꾸미기 씬을 지난 적 없는 사람)은 놀이보다 여기를 먼저 본다.
// 어느 놀이에서 열든 같은 화면이다 — 놀이는 제 장면·카메라·아바타 자리를 내주고(StudioHost), 프레임마다 update 를 부른다.
// 프레임 차례: 놀이의 카메라 다음 — 열려 있는 동안 카메라 자리를 덮어쓴다

/** 꾸미기 씬을 여는 쪽(놀이)이 내주는 것 */
export interface StudioHost {
  /** 놀이의 장면(열려 있는 동안 배경색을 칠하고, 빛을 꾸미기 층에도 올린다) */
  scene: THREE.Scene;
  /** 놀이의 카메라(열려 있는 동안 자리와 보는 층을 덮어쓴다) */
  camera: THREE.PerspectiveCamera;
  /** 아바타: 바닥 원판을 붙일 틀과, 뼈대 있는 몸이 오는 때 */
  avatar: RigOwner & { tiltG: THREE.Group };
  /** 아바타가 선 자리(P, 세계)·위쪽(p)·보는 쪽(h) — 카메라를 그 둘레에 둔다 */
  stand: {
    readonly P: Readonly<THREE.Vector3>;
    readonly p: Readonly<THREE.Vector3>;
    readonly h: Readonly<THREE.Vector3>;
  };
  /** 닫혀 있을 때 화면 구석에 옷장 단추를 띄울지(놀이의 세상). 제 단추로 여는 곳(이벤트 페이지)은 false */
  hasWearButton: boolean;
  /** 옷장에 쓸 글자(여는 화면의 언어 — closet-labels) */
  labels: ClosetLabels;
  /** 부품 모델을 미리 받아 둔다(고르는 순간 바로 입게) */
  need(key: string): void;
  /** 열리고 닫힐 때: 놀이가 제 화면 글자와 조작을 멈추고 되살린다 */
  onToggle(isOpen: boolean): void;
  /** 차림을 골랐다(isRandom: 아무거나 단추) */
  onPicked(isRandom: boolean): void;
}

/** 아바타·부품·바닥 원판·빛만 올리는 층 */
const STUDIO_LAYER = 1;
/** 미는 만큼 도는 각(라디안/px) */
const TURN_PER_PX = 0.012;
/** 고를 때·아무거나 누를 때 도는 빠르기(라디안/초) — 줄어들며 빠르기/SPIN_DAMP 라디안만큼 돈다 */
const PICK_SPIN = 7,
  SHUFFLE_SPIN = 9;
/** 도는 빠르기가 줄어드는 비율(초당), 배경색이 따라가는 빠르기 */
const SPIN_DAMP = 4.5,
  BG_FOLLOW = 8;
/** 처음 열 때 카메라가 선 각(얼굴 앞에서 조금 옆, 라디안) */
const OPEN_ANGLE = 0.35;
/** 카메라 거리: 세로 화면은 조금 더 멀리(옷장이 아래를 가린다) */
const CAM_DIST_TALL = 3.7,
  CAM_DIST_WIDE = 3.5;

const right = new THREE.Vector3(),
  aim = new THREE.Vector3();

/** 꾸미기 씬 */
export class Studio {
  private open = false;
  private angle = 0;
  private spin = 0;
  private readonly bg = new THREE.Color();
  private readonly bgTarget = new THREE.Color();
  /** 열기 전 세상의 배경색(닫으면 돌려 놓는다) */
  private readonly worldBg = new THREE.Color();
  private readonly floor: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private readonly closet: Closet;
  private hold: THREE.Group | null = null;
  /** 처음 온 사람에게 열 차례(첫 화면을 받고 그리기 시작하면 연다) */
  private greetWaiting = false;

  /** urlOf: 에셋 키 → 받을 주소(옷장 칸 그림) */
  constructor(
    private readonly host: StudioHost,
    private readonly wardrobe: Wardrobe,
    parent: HTMLElement,
    urlOf: (key: string) => string | null,
  ) {
    const avatar = host.avatar;
    const floorGeometry = new THREE.CircleGeometry(1.15, 40),
      floorMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    this.floor = new THREE.Mesh(floorGeometry, floorMaterial);
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.layers.set(STUDIO_LAYER);
    this.floor.visible = false;
    avatar.tiltG.add(this.floor);
    // 빛도 층을 따진다 — 아바타를 비추는 빛을 씬 층에도 올린다
    host.scene.traverse((c) => {
      if (c instanceof THREE.Light) c.layers.enable(STUDIO_LAYER);
    });
    avatar.whenRig((rig) => {
      this.hold = rig.hold;
    });
    const closet = new Closet(
      parent,
      urlOf,
      {
        onOpen: () => this.show(true),
        onDone: () => this.show(false),
        onPick: (tab, value) => this.pick(tab, value),
        onUndo: () => {
          if (!this.wardrobe.undo()) return;
          this.followLook();
        },
        onShuffle: () => {
          this.wardrobe.shuffle();
          this.spin = SHUFFLE_SPIN;
          this.followLook();
          host.onPicked(true);
        },
        onTurn: (dx) => {
          this.angle -= dx * TURN_PER_PX;
          closet.hideTip();
        },
      },
      host.hasWearButton,
      host.labels,
    );
    this.closet = closet;
  }

  /**
   * 꾸미기 씬을 지난 적 없는 사람에게 세상보다 먼저 연다(skip: 개발용 ?quick). 몸은 첫 화면을 받는 도중에 오지만, 여는 것은
   * 그리기 시작한 첫 프레임에 — 열 때 옷장 부품·무늬를 미리 받는데 그것이 첫 화면 받기와 회선을 다투지 않게
   */
  greetNewcomer(skip: boolean) {
    if (skip) return;
    void this.wardrobe.ready.then(() => {
      if (this.wardrobe.hasDressed) return;
      this.host.avatar.whenRig(() => {
        this.greetWaiting = true;
      });
    });
  }

  /** 열고 닫는다. 닫으면 꾸미기 씬을 지났다고 기록한다 */
  show(on: boolean) {
    if (on === this.open) return;
    this.open = on;
    const host = this.host,
      cam = host.camera,
      background = host.scene.background as THREE.Color;
    host.onToggle(on);
    this.floor.visible = on;
    if (on) {
      this.angle = OPEN_ANGLE;
      this.spin = 0;
      this.wardrobe.clearHistory();
      this.worldBg.copy(background);
      const bg = this.bgFor();
      this.bgTarget.set(bg);
      this.bg.copy(this.bgTarget);
      cam.layers.set(STUDIO_LAYER);
      // 고르는 순간 바로 입게 옷장의 부품·무늬를 미리 받아 둔다
      for (const k of Object.keys(PARTS)) host.need(k);
      this.wardrobe.prefetchPrints(PRINTS);
    } else {
      cam.layers.set(0);
      background.copy(this.worldBg);
      this.wardrobe.markDressed();
    }
    this.closet.show(on, this.wardrobe.look);
  }

  /** 열려 있으면 카메라를 아바타 둘레에 두고 배경을 칠한다 */
  update(f: { dt: number }) {
    if (this.greetWaiting) {
      this.greetWaiting = false;
      this.show(true);
    }
    if (!this.open) return;
    const scene = this.host.scene;
    // 끼운 부품은 나중에 붙으므로 매 프레임 층을 올린다(몸·부품 수십 개라 가볍다)
    this.hold?.traverse((c) => c.layers.enable(STUDIO_LAYER));
    this.floor.position.y = this.wardrobe.look.board ? -1.0 : -0.78;
    this.angle += this.spin * f.dt;
    const damp = -SPIN_DAMP * f.dt,
      follow = ease(BG_FOLLOW, f.dt);
    this.spin *= Math.exp(damp);
    this.bg.lerp(this.bgTarget, follow);
    (scene.background as THREE.Color).copy(this.bg);
    this.floor.material.color.copy(this.bg).multiplyScalar(0.86);
    this.placeCamera();
  }

  /** 치운다 */
  dispose() {
    this.closet.dispose();
    this.floor.removeFromParent();
    this.floor.geometry.dispose();
    this.floor.material.dispose();
  }

  /* ─── 내부 ─────────────────────────── */

  // 카메라를 얼굴 앞(h)에서 옆(right)으로 angle 만큼 돈 자리에 둔다. 세로 화면은 아래 옷장 몫만큼 아바타를 위로 올려 보이게 조금 아래를 본다
  private placeCamera() {
    const { stand, camera: cam } = this.host;
    const P = stand.P,
      up = stand.p,
      ahead = stand.h,
      isTall = innerHeight > innerWidth,
      d = isTall ? CAM_DIST_TALL : CAM_DIST_WIDE,
      front = d * Math.cos(this.angle),
      side = d * Math.sin(this.angle);
    right.crossVectors(ahead, up).normalize();
    cam.position
      .copy(P)
      .addScaledVector(ahead, front)
      .addScaledVector(right, side)
      .addScaledVector(up, 0.05);
    cam.up.copy(up);
    const drop = isTall ? -0.68 : -0.62;
    aim.copy(P).addScaledVector(up, drop);
    cam.lookAt(aim);
  }

  private pick(tab: LookTab, value: string) {
    if (!this.wardrobe.pick(tab, value)) return;
    this.spin = PICK_SPIN;
    this.followLook();
    this.host.onPicked(false);
  }

  // 차림이 바뀌면 배경색과 옷장 칸을 따라 바꾼다
  private followLook() {
    const bg = this.bgFor();
    this.bgTarget.set(bg);
    this.closet.draw(this.wardrobe.look);
  }

  private bgFor(): string {
    return STUDIO_BG[this.wardrobe.look.top] ?? STUDIO_BG[""];
  }
}
