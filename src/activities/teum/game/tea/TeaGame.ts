import * as THREE from "three";

import type { AssetLoader } from "../../assets/load";
import { assetUrl } from "../../assets/manifest";
import type { Manifest } from "../../assets/manifest";
import { BACKGROUND_MUSIC, SOUND_EFFECTS, SOUND_VOLUME } from "../../assets/settings";
import { Avatar } from "../avatar/avatar";
import { AVATAR_COMPANION } from "../avatar/parts";
import { Wardrobe } from "../avatar/wardrobe";
import type { Frame } from "../core/frame";
import { Random } from "../core/random";
import { GameEvents } from "../events";
import { Fx } from "../fx/fx";
import { Hud } from "../hud";
import { Mats } from "../look";
import { ModelLibrary } from "../models/library";
import { Input } from "../player/input";
import type { Player } from "../player/player";
import { Progress } from "../progress/progress";
import { LocalSaveStore } from "../progress/store";
import type { Services } from "../services";
import { SoundManager } from "../sound";
import { createStage } from "../world/stage";
import type { Stage } from "../world/stage";
import { TeaBody } from "./body";
import { Decor } from "./decor";
import { Movers } from "./movers";
import { CAP_TO_LAVENDER, LIME_TO_CREAM, LIME_TO_LAVENDER, recolorModel } from "./recolor";
import { TeaSky } from "./sky";
import { StandShape } from "./stand";
import { StandMesh } from "./standMesh";
import { TeaCamera } from "./teaCamera";
import type { TeaTuning } from "./teaTuning";
import { TEA } from "./teaTuning";

// 티타임 행성 씬(?planet=tea). 지금 게임(Game)과 따로 선다 — 넓은 지도·마을·흩뿌리기·떠도는 생물은 없다.
// 가져다 쓰는 것: 그리는 틀·모델 창고·아바타와 옷장·빛 방울·조작·소리. 별·스탠드·몸·카메라·다니는 법은 이 폴더의 것.
// 아바타·빛 방울은 공통 창구(Services)를 받으므로, 그것들이 읽는 칸(장면·알림판·나·빛·안내판·모델·재질·난수)만 채워 넘긴다

/** 안개(m): 작은 별이라 가까이서 시작해 지평선 너머에서 짙어진다 */
const FOG = { near: 40, far: 200 } as const;
/** 톡: 0.2초 안에 떼고 그 사이 10px 안으로만 움직였을 때(기획서 4장) */
const TAP_RULE = { ms: 200, movePx: 10 } as const;
/** 빛 세기: 파스텔 땅과 흰 도자기가 하얗게 날아가지 않게 지금 게임(초현실 팝)보다 낮춘다 */
const LIGHT = { hemi: 1.45, sun: 1.05 } as const;
/** 아래(땅·접시 아랫면)에서 오는 빛 — 회색 대신 옅은 딸기우유 빛 */
const GROUND_LIGHT = 0xf3dce8;
/** 해: 내 머리 위에서 이만큼 옆·뒤로 비켜 비춘다(작은 별이라 해를 한 자리에 두면 뒤편이 밤이 된다) */
const SUN_SIDE = 0.55;

/** 판 시작: 전경 → 하늘에서 떨어져 내려앉는 데 걸리는 시간(초) */
const LANDING_EASE = 1.6;

/** 이 행성의 맵 모델(노랑~초록을 라벤더로 다시 칠한다) */
const MAP_KEYS = new Set([
  "mushroom",
  "cannon",
  "flowerpot",
  "teacup",
  "d_teacup",
  "d_macaron",
  "macaron",
  "d_cake",
  "cake",
  "picnic",
  "petalbench",
  "parasol",
  "s_cherry",
]);

/** 티타임 행성 */
export class TeaGame {
  readonly stage: Stage;
  readonly stand: StandShape;
  readonly body: TeaBody;
  readonly camera: TeaCamera;
  readonly models: ModelLibrary;
  readonly avatar: Avatar;
  readonly wardrobe: Wardrobe;
  readonly movers: Movers;
  readonly input: Input;
  readonly events: GameEvents;
  readonly frame: Frame = { dt: 0, time: 0 };
  private readonly sky: TeaSky;
  private readonly standMesh: StandMesh;
  private readonly decor: Decor;
  private readonly fx: Fx;
  private readonly sound: SoundManager;
  private readonly hud: Hud;
  /** 판 시작 장면이 흐른 시간(초) — 전경을 보다가 떨어져 내려앉는다 */
  private intro = 0;

  constructor(
    canvas: HTMLCanvasElement,
    readonly manifest: Manifest,
    seed: number,
    readonly t: TeaTuning = TEA,
  ) {
    const stage = createStage(canvas);
    this.stage = stage;
    const scene = stage.scene;
    scene.fog = new THREE.Fog(0xffffff, FOG.near, FOG.far);
    const mats = new Mats();
    const rng = new Random(seed);
    this.events = new GameEvents();
    const hudParent = canvas.parentElement ?? document.body;
    this.hud = new Hud(hudParent);
    this.models = new ModelLibrary(manifest, mats.lookU, scene);
    this.stand = new StandShape(t);
    this.body = new TeaBody(this.stand, t);
    this.camera = new TeaCamera(stage.camera, this.body, this.stand);
    const player = this.body as unknown as Player;
    const fxRng = rng.fork("fx");
    this.fx = new Fx(scene, player, fxRng, this.events);
    // 아바타 곁 고양이의 라임 빛은 이 행성에서 끈다(라임은 상자와 리본만)
    const quietFx = { glow: () => {} };
    const s = {
      scene,
      events: this.events,
      player,
      fx: quietFx,
      hud: this.hud,
      models: this.models,
      mats,
      rng,
      camera: { camera: stage.camera },
    } as unknown as Services;
    // ---- 무대 ----
    this.sky = new TeaSky(scene, t);
    this.standMesh = new StandMesh(scene, this.stand, t);
    this.decor = new Decor(scene, this.stand, this.models, t.decor, this.body.blockers);
    this.movers = new Movers(scene, this.stand, this.body, this.events, this.models, t);
    // ---- 나 ----
    const noWings = { mine: new THREE.Group() };
    this.avatar = new Avatar(s, noWings);
    this.avatar.fitModels();
    creamCat(this.avatar, t.colors.cream);
    const store = new LocalSaveStore();
    const progress = new Progress(store);
    const lookRng = rng.fork("look");
    this.wardrobe = new Wardrobe(mats.lookU.outfit, this.avatar, progress, {
      dressNewcomer: true,
      rand: () => lookRng.next(),
    });
    this.input = new Input(canvas, this.hud, TAP_RULE, (x, y) => this.tap(x, y));
    this.sound = new SoundManager({
      events: this.events,
      manifest,
      urlOf: assetUrl,
      effects: SOUND_EFFECTS,
      music: BACKGROUND_MUSIC,
      volume: SOUND_VOLUME,
    });
    const sound = this.sound;
    if (sound.hasSounds) this.hud.showMuteToggle(sound.isMuted, (muted) => sound.setMuted(muted));
    // 판 중 화면에는 위 칸 넷과 큰 글자뿐 — 안내 줄은 숨긴다
    this.hud.hint.style.display = "none";
    // 아랫면(접시 밑)도 어둡지 않게: 아래에서 오는 빛을 딸기우유 빛으로
    stage.hemi.groundColor.set(GROUND_LIGHT);
    stage.hemi.intensity = LIGHT.hemi;
    stage.sun.intensity = LIGHT.sun;
    this.camera.resize(stage.renderer);
    this.begin();
  }

  /** 첫 화면에 받을 모델 키(아바타·옷·고양이는 index 가 더한다) */
  firstScreenKeys(): string[] {
    const keys = new Set<string>(this.decor.keys);
    for (const k of ["mushroom", "cannon"]) if (this.models.has(k)) keys.add(k);
    return [...keys];
  }

  /** 받은 모델을 끼운다: 맵 모델은 라임 빛깔을 라벤더로, 고양이는 크림색으로 다시 칠한 뒤 */
  deliver(key: string, root: THREE.Group) {
    if (key === "mushroom") recolorModel(root, CAP_TO_LAVENDER);
    else if (MAP_KEYS.has(key)) recolorModel(root, LIME_TO_LAVENDER);
    else if (key === AVATAR_COMPANION) recolorModel(root, LIME_TO_CREAM);
    this.models.deliver(key, root);
  }

  /** 에셋 받는 창구를 단다(갈아입는 부품·무늬 그림) */
  useLoader(loader: AssetLoader) {
    const models = this.models;
    models.useRequester((k) => {
      loader
        .fetch(k)
        .then((asset) => {
          if (asset.kind === "model") this.deliver(k, asset.scene);
        })
        .catch((err) => {
          console.error("teum tea asset", k, err);
          models.failed(k);
        });
    });
    this.wardrobe.useLoader(loader);
  }

  /** 한 프레임(길어도 0.1초로 자른다) */
  step(elapsed: number) {
    const dt = Math.min(0.1, elapsed);
    const f = this.frame;
    f.dt = dt;
    f.time += dt;
    const isHolding = this.playIntro(dt);
    const intent = this.input.read();
    this.body.begin(dt, intent);
    if (!isHolding) this.body.move();
    this.movers.update(f);
    this.body.place(f.time);
    this.avatar.update(f);
    this.avatar.cat.update(f);
    this.fx.update(f);
    this.standMesh.update(f);
    this.camera.update(dt);
    this.followLight();
    this.sky.follow(this.stage.camera, this.body.p);
    this.stage.renderer.render(this.stage.scene, this.stage.camera);
  }

  /** 창 크기에 맞춘다 */
  resize() {
    this.camera.resize(this.stage.renderer);
  }

  /** 멈추고 그리던 것·리스너·DOM 을 치운다 */
  dispose() {
    this.input.dispose();
    this.sound.dispose();
    this.movers.dispose();
    this.decor.dispose();
    this.standMesh.dispose();
    this.sky.dispose();
    this.avatar.dispose();
    this.fx.dispose();
    this.hud.dispose();
    this.models.dispose();
    this.stage.dispose();
  }

  // 빛이 나를 따라온다: 하늘빛의 위는 내 머리 위, 해는 내 머리 위에서 조금 비켜(별 중심을 향해) 비춘다
  private followLight() {
    const { hemi, sun, camera } = this.stage;
    const p = this.body.p;
    hemi.position.copy(p);
    sideways.setFromMatrixColumn(camera.matrixWorld, 0);
    sun.position.copy(p).addScaledVector(sideways, SUN_SIDE).normalize().multiplyScalar(80);
  }

  // 판 시작: 출발 자리 위 하늘에 서서(전경을 보는 동안 멈춤) 떨어져 내려앉는다
  private begin() {
    const { stand, body, t } = this;
    const spot = t.start.spot;
    const dir = new THREE.Vector3();
    stand.dirOf(spot, dir);
    const toAxis = new THREE.Vector3(-dir.x, 0, -dir.z).normalize();
    const floor = stand.heightOf(spot.tier);
    const high = floor + t.start.dropHeight;
    body.teleport(dir, toAxis, high);
    this.camera.overview = 1;
    this.intro = 0;
  }

  // 전경을 보는 동안 몸을 하늘에 붙잡아 두고(true), 그 뒤 떨어지는 동안 카메라가 내게 내려온다
  private playIntro(dt: number): boolean {
    const { overview } = this.t.start;
    const total = overview + LANDING_EASE;
    if (this.intro >= total) return false;
    this.intro += dt;
    if (this.intro < overview) return true;
    const k = (this.intro - overview) / LANDING_EASE;
    const left = 1 - Math.min(1, k);
    this.camera.overview = left * left;
    return false;
  }

  // 톡(M1 에는 누를 것이 없다 — 상자는 M2)
  private tap(x: number, y: number) {
    void x;
    void y;
  }
}

/* ─── 내부 ─────────────────────────── */

const sideways = new THREE.Vector3();

// 이 행성의 고양이는 크림색: 모델 오기 전의 공도 크림으로, 모델은 라임으로 물들이지 않는다(물든 정도 0)
function creamCat(avatar: Avatar, hex: string) {
  avatar.catPrim.material.color.set(hex);
  const holder = avatar.catPrim.parent;
  if (!holder) return;
  for (const child of holder.children) {
    const lime = (child.userData as { uLime?: { value: number } }).uLime;
    if (lime) lime.value = 0;
  }
}
