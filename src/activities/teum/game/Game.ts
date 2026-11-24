import * as THREE from "three";

import type { AssetLoader } from "../assets/load";
import type { Manifest } from "../assets/manifest";
import { assetUrl } from "../assets/manifest";
import { BACKGROUND_MUSIC, SOUND_EFFECTS, SOUND_VOLUME } from "../assets/settings";
import { Avatar } from "./avatar/avatar";
import { Trail } from "./avatar/trail";
import { Wardrobe } from "./avatar/wardrobe";
import { reserveLawn } from "./brand/lawn";
import { BrandObjects } from "./brand/objects";
import { Signature } from "./brand/signature";
import type { Frame, Thing } from "./core/frame";
import { PixelBudget } from "./core/pixelBudget";
import { Random } from "./core/random";
import type { Tap, Tappable } from "./core/tap";
import { Creatures } from "./creatures/creatures";
import { isStudioSkipped } from "./debug";
import { GameEvents } from "./events";
import { Fx } from "./fx/fx";
import { Petals } from "./fx/petals";
import { Ripples } from "./fx/ripples";
import { Hud } from "./hud";
import { Landmarks } from "./landmarks/landmarks";
import { Mats } from "./look";
import type { GameMap } from "./maps/map";
import { cloneLayout } from "./maps/map";
import { ModelLibrary } from "./models/library";
import { Progress } from "./progress/progress";
import { LocalSaveStore } from "./progress/store";
import { CameraRig } from "./player/camera";
import { Input } from "./player/input";
import { Player } from "./player/player";
import { Arches } from "./rides/arches";
import { Balloons } from "./rides/balloons";
import { Balls } from "./rides/balls";
import { Bumpers } from "./rides/bumpers";
import { Cannons } from "./rides/cannons";
import { Chimes } from "./rides/chimes";
import { Comet } from "./rides/comet";
import { Funnels } from "./rides/funnels";
import { Holes } from "./rides/holes";
import { Jets } from "./rides/jets";
import { Pads } from "./rides/pads";
import { Pillars } from "./rides/pillars";
import { Pipes } from "./rides/pipes";
import { Rails } from "./rides/rails";
import { Rings } from "./rides/rings";
import { Rockets } from "./rides/rockets";
import { Seeds } from "./rides/seeds";
import { Slings } from "./rides/slings";
import { Stars } from "./rides/stars";
import { Streams } from "./rides/streams";
import { Swings } from "./rides/swings";
import { Thermals } from "./rides/thermals";
import { Whale } from "./rides/whale";
import { Whirls } from "./rides/whirls";
import { Wings } from "./rides/wings";
import { BabyLimes } from "./scenery/babyLimes";
import { BigFlowers } from "./scenery/bigFlowers";
import { Bubbles } from "./scenery/bubbles";
import { BubbleTrail } from "./scenery/bubbleTrail";
import { Director } from "./scenery/director";
import { Footsteps } from "./scenery/footsteps";
import { Trees } from "./scenery/trees";
import { Sculptures } from "./sculptures/sculptures";
import type { Services } from "./services";
import { S } from "./settings";
import { SoundManager } from "./sound";
import { Studio } from "./studio/studio";
import type { WaterBalloons } from "./waterBalloons/waterBalloons";
import { createWaterBalloons } from "./waterBalloons/waterBalloons";
import { Clouds } from "./world/clouds";
import { Culler } from "./world/culler";
import { Flowers } from "./world/flowers";
import { Ground } from "./world/ground";
import { Lakes } from "./world/lakes";
import { Land } from "./world/land";
import { Occupancy } from "./world/occupancy";
import { Places } from "./world/places";
import { RegionLook } from "./world/regionLook";
import { Regions } from "./world/regions";
import { Sites } from "./world/sites";
import { Sky } from "./world/sky";
import { from } from "./world/sphere";
import { withAllShown } from "./world/reveal";
import { Sight } from "./world/sight";
import { createStage } from "./world/stage";
import type { Stage } from "./world/stage";
import { Terrain } from "./world/terrain";
import { Today } from "./world/today";
import { TerrainView } from "./world/terrainView";

// 게임 한 판(조립하는 곳). 여기서만 정한다:
//   1) 만드는 순서와 놓는 순서 — 놓는 순서가 곧 배치다(앞 것의 끝에 뒤 것이 이어 붙고, 땅 높이는 그때까지 켜진 언덕으로 잰다)
//   2) 한 프레임의 순서(frameOrder) — 놀이기구는 차례로 나를 건드리고, 뒤의 것은 앞의 것이 바꾼 높이·속도를 본다
//   3) 칙에 반응하는 순서(tapOrder)
// 세계 위의 것들은 서로의 상태를 직접 만지지 않는다. 필요한 다른 것은 여기서 만들 때 넘겨 준다

/** 첫 화면 고르기: 놓인 자리에서 이만큼 위를 가운데로, 이 반지름의 공이 시야에 걸리면 첫 화면에 받는다(m) */
const START_VIEW_LIFT = 30,
  START_VIEW_RADIUS = 60,
  /** 생물을 그리는 거리(행성 위 각도의 cos) */
  CREATURE_VIEW_COS = 0.9;

/** 한 프레임에 부르는 것: 세계 위의 것(update) 또는 몸·입력처럼 한 줄로 끝나는 일 */
type Step = Thing | (() => void);

/** 한 판 */
export class Game {
  readonly stage: Stage;
  readonly s: Services;
  // ---- 세계 위의 것들(시험·개발 창구가 읽는다) ----
  readonly ground: Ground;
  readonly sky: Sky;
  /** 지금 지역의 하늘빛·안개(새 지역에 들어서면 알린다) */
  readonly regionLook: RegionLook;
  readonly places: Places;
  readonly sites: Sites;
  readonly brand: BrandObjects;
  readonly streams: Streams;
  readonly whirls: Whirls;
  readonly chimes: Chimes;
  readonly rings: Rings;
  readonly pads: Pads;
  readonly cannons: Cannons;
  readonly bumpers: Bumpers;
  readonly balloons: Balloons;
  readonly arches: Arches;
  readonly balls: Balls;
  readonly rockets: Rockets;
  readonly thermals: Thermals;
  readonly wings: Wings;
  readonly jets: Jets;
  readonly swings: Swings;
  readonly pipes: Pipes;
  readonly rails: Rails;
  readonly funnels: Funnels;
  readonly seeds: Seeds;
  readonly stars: Stars;
  readonly lakes: Lakes;
  readonly slings: Slings;
  readonly holes: Holes;
  readonly pillars: Pillars;
  readonly whale: Whale;
  readonly comet: Comet;
  readonly terrainView: TerrainView;
  readonly clouds: Clouds;
  readonly flowers: Flowers;
  readonly petals: Petals;
  readonly avatar: Avatar;
  readonly trail: Trail;
  readonly footsteps: Footsteps;
  readonly trees: Trees;
  readonly bigFlowers: BigFlowers;
  readonly bubbles: Bubbles;
  readonly babyLimes: BabyLimes;
  readonly sculptures: Sculptures;
  /** 마을마다 말을 거는 랜드마크 */
  readonly landmarks: Landmarks;
  /** 이번 판의 기록(랜드마크에 다녀간 수·차림) */
  readonly progress: Progress;
  /** 지금 차림(옷은 몸 셰이더, 소품은 뼈) — 기록에 둔다 */
  readonly wardrobe: Wardrobe;
  /** 꾸미기 씬: 세상을 가리고 아바타만 세워 옷장에서 고른다 */
  readonly studio: Studio;
  readonly signature: Signature;
  readonly bubbleTrail: BubbleTrail;
  readonly director: Director;
  readonly creatures: Creatures;
  /** 물풍선 놀이(지도에 물풍선 자리가 있을 때만 — 없으면 null) */
  readonly waterBalloons: WaterBalloons | null;
  readonly input: Input;
  /** 소리판(알림판을 듣는다 — 소리를 정하기 전에는 아무것도 하지 않는다) */
  readonly sound: SoundManager;
  private readonly frameOrder: Step[];
  /** 느린 기기에서 화면 배율을 낮추는 조절(시작 배율은 그리는 틀이 정한 값) */
  private readonly pixels: PixelBudget;
  /** 뒤에서 받는 나머지 에셋이 아직 오는 중인가(시작하는 쪽이 restArrived 로 끝을 알린다) */
  private isRestComing = true;
  /** 나머지 에셋이 다 온 뒤 꾸미기 씬 뒤에서 데우기를 아직 하지 않았나(한 번만 한다) */
  private owesWarm = false;
  private readonly tapOrder: Tappable[];
  private readonly ray = new THREE.Raycaster();
  /** 그리기 직전의 시야(여럿을 한 번에 그리는 묶음이 시야 밖의 것을 뺀다) */
  private readonly sight = new Sight();
  private readonly ndc = new THREE.Vector2();
  /** 이번 프레임(모두가 같은 값을 본다) */
  readonly frame: Frame = { dt: 0, time: 0 };

  /** seed: 이번 판의 게임 난수 씨앗, map: 지을 지도(세계는 이 지도의 값만 보고 놓인다), festival: 고정할 축제 지역(개발 ?fest, 없으면 날짜로) */
  constructor(
    canvas: HTMLCanvasElement,
    manifest: Manifest,
    seed: number,
    map: GameMap,
    festival: number | null = null,
  ) {
    const stage = createStage(canvas);
    this.stage = stage;
    const startRatio = stage.renderer.getPixelRatio();
    this.pixels = new PixelBudget(startRatio);
    const scene = stage.scene;
    const layout = cloneLayout(map);
    const mats = new Mats();
    const rng = new Random(seed);
    const land = new Land(map.land);
    const isLand = (v: THREE.Vector3) => land.has(v);
    const terrain = new Terrain(map.seed, map.terrain, layout.hill, isLand);
    const events = new GameEvents();
    const player = new Player(terrain, events);
    const hudParent = canvas.parentElement ?? document.body;
    const hud = new Hud(hudParent);
    const models = new ModelLibrary(manifest, mats.lookU, scene);
    const fxRng = rng.fork("fx"),
      rippleRng = rng.fork("ripples");
    const occ = new Occupancy(land);
    const hubSpots = layout.hub.map((h) => from(h.dist, h.bear));
    // 축제는 뭍의 마을에서만 연다(출발도 그 마을에서 한다)
    const towns = hubSpots.flatMap((v, i) => (land.has(v) ? [i] : []));
    const s: Services = {
      scene,
      map,
      events,
      layout,
      terrain,
      occ,
      land,
      regions: new Regions(occ.hubs, map.regions, map.regionEdge),
      today: new Today(events, towns, festival),
      culler: new Culler(scene, player, stage.camera),
      player,
      camera: new CameraRig(stage.camera, player, terrain),
      fx: new Fx(scene, player, fxRng, events),
      ripples: new Ripples(scene, rippleRng, terrain, player, events),
      hud,
      models,
      mats,
      rng,
    };
    this.s = s;
    for (const hubV of hubSpots) s.occ.hubs.push(hubV);
    // 물건 셰이더가 보는 지역: 마을 중심·색상 돌림 각·테두리
    mats.lookU.regionHub.value = s.occ.hubs;
    mats.lookU.regionHue.value = map.regions.map((r) => THREE.MathUtils.degToRad(r.hue));
    mats.lookU.regionEdge.value.set(map.regionEdge.from, map.regionEdge.width);
    // ---- 장면·땅·하늘 ----
    this.ground = new Ground(s);
    this.sky = new Sky(s, stage.sun);
    this.regionLook = new RegionLook(s, this.sky);
    const places = new Places(s);
    this.places = places;
    this.sites = new Sites(s, places);
    this.brand = new BrandObjects(s, places);
    // ---- 놀이기구(만들기만, 자리는 아래에서) ----
    this.rings = new Rings(s);
    this.pads = new Pads(s);
    this.pillars = new Pillars(s);
    this.streams = new Streams(s);
    this.whirls = new Whirls(s);
    this.chimes = new Chimes(s, [this.pillars, this.pads, this.rings]);
    this.cannons = new Cannons(s);
    this.bumpers = new Bumpers(s);
    this.balloons = new Balloons(s);
    this.arches = new Arches(s);
    this.balls = new Balls(s, {
      chimes: this.chimes,
      pillars: this.pillars,
      bumpers: this.bumpers,
    });
    this.stars = new Stars(s);
    this.lakes = new Lakes(s);
    this.slings = new Slings(s);
    this.swings = new Swings(s);
    this.pipes = new Pipes(s);
    this.rails = new Rails(s);
    this.funnels = new Funnels(s);
    this.seeds = new Seeds(s);
    this.rockets = new Rockets(s);
    this.thermals = new Thermals(s);
    this.wings = new Wings(s);
    this.comet = new Comet(s);
    this.jets = new Jets(s);
    this.holes = new Holes(s);
    this.whale = new Whale(s, this.whirls);
    // ---- 지형 그림·꽃 ----
    this.flowers = new Flowers(s);
    this.petals = new Petals();
    this.terrainView = new TerrainView(s, this.ground);
    this.clouds = new Clouds(s, this.ground);
    // ---- 나 ----
    this.avatar = new Avatar(s, this.wings);
    this.trail = new Trail(s);
    this.stars.followTrail(this.trail);
    this.input = new Input(canvas, hud, (x, y) => this.tap(x, y));
    this.sound = new SoundManager({
      events,
      manifest,
      urlOf: assetUrl,
      effects: SOUND_EFFECTS,
      music: BACKGROUND_MUSIC,
      volume: SOUND_VOLUME,
    });
    const sound = this.sound;
    if (sound.hasSounds) hud.showMuteToggle(sound.isMuted, (muted) => sound.setMuted(muted));
    s.camera.resize(stage.renderer);
    // ---- 놓기: 자리표 → 행성 위 자리 ----
    this.layoutWorld();
    // 출발은 오늘의 축제 지역 마을에서
    const startHub = s.occ.hubs[s.today.festival];
    player.goHome(startHub);
    this.thermals.usePetals(this.petals);
    this.streams.usePetals(this.petals);
    // ---- 모델 자리와 풍경(모델을 받기 전에 배치를 끝낸다) ----
    this.avatar.fitModels();
    places.fitModels();
    this.sites.fitModels();
    this.chimes.fitModels();
    this.cannons.fitModels();
    this.bumpers.fitModels();
    this.claimAll();
    this.footsteps = new Footsteps(s);
    // suaci 잔디 로고 자리를 나무·꽃·조형물보다 먼저 맡아 둔다
    const lawn = reserveLawn(s);
    this.trees = new Trees(s, this.clouds);
    this.bigFlowers = new BigFlowers(s);
    this.balls.fitModels();
    this.bubbles = new Bubbles(s);
    this.babyLimes = new BabyLimes(s, this.footsteps);
    this.sculptures = new Sculptures(s, this.trees, this.cannons);
    this.whale.choosePath([this.trees, this.bigFlowers, this.sculptures, this.sites]);
    const store = new LocalSaveStore();
    this.progress = new Progress(store);
    // ---- 꾸미기: 처음 온 사람은 아무 차림이나 입고 세상보다 꾸미기 씬을 먼저 본다(개발 ?quick 이면 건너뛴다) ----
    const skipStudio = isStudioSkipped(),
      lookRng = rng.fork("look");
    this.wardrobe = new Wardrobe(mats.lookU.outfit, this.avatar, this.progress, {
      dressNewcomer: !skipStudio,
      rand: () => lookRng.next(),
    });
    const urlOf = (k: string) => {
      const entry = manifest.assets[k];
      return entry ? assetUrl(entry.file) : null;
    };
    this.studio = new Studio(s, this.avatar, this.wardrobe, this.input, hudParent, urlOf);
    this.studio.greetNewcomer(skipStudio);
    this.landmarks = new Landmarks(s, this.sculptures.landmarks, this.progress);
    this.signature = new Signature(s, lawn, this.sites, this.rockets);
    this.bubbleTrail = new BubbleTrail(s);
    this.creatures = new Creatures(s, {
      footsteps: this.footsteps,
      babyLimes: this.babyLimes,
      lakes: this.lakes,
      signature: this.signature,
      whale: this.whale,
    });
    this.director = new Director(s, this.bubbleTrail, this.seeds, this.creatures);
    this.whale.fitModels();
    this.balloons.fitModels();
    this.stars.fitModels();
    this.wings.fitModels();
    this.funnels.fitModels();
    this.seeds.fitModels();
    // 물풍선 놀이는 맨 마지막에 만든다 — 세계의 배치·난수 차례에 끼어들지 않게(자리 차지도 하지 않는다)
    this.waterBalloons = createWaterBalloons(s, hudParent, this.signature.wordmark);
    const balloonGame = this.waterBalloons ? [this.waterBalloons] : [];
    // 찍어 둔 묶음(조형물·나무·꽃·봉오리…)도 가까운 것만 칸에 채운다 — 장면에서 떼는 것과 같은 기준·같은 때
    s.culler.onCull((cut) => models.cull(player.p as THREE.Vector3, cut, s.culler.eye));
    // ---- 한 프레임의 순서 ----
    const { camera, fx, ripples, culler } = s;
    this.frameOrder = [
      s.today,
      () => fx.begin(),
      this.lakes.clock,
      () => player.begin(this.frame.dt, this.input.read()),
      this.whale.mover,
      () => player.move(),
      // 놀이기구: 이 순서로 나를 건드린다
      this.rings,
      this.pads,
      this.pillars,
      this.streams,
      this.whirls,
      this.whale,
      this.chimes,
      this.cannons,
      this.bumpers,
      this.balloons,
      this.arches,
      this.balls,
      this.lakes,
      this.slings,
      this.swings,
      this.pipes,
      this.rails,
      this.funnels,
      this.seeds,
      this.rockets,
      this.thermals,
      this.wings,
      this.funnels.floor,
      this.comet,
      this.jets,
      this.holes,
      () => player.updateAlt(),
      // 나와, 나를 따라 움직이는 것들
      () => player.place(this.frame.time),
      this.avatar,
      this.balloons.pose,
      this.trail,
      this.stars,
      this.rockets.pose,
      this.slings.pose,
      this.swings.pose,
      // 풍경·생물
      this.sites,
      culler,
      this.footsteps,
      this.bubbles,
      this.babyLimes,
      this.trees,
      this.bigFlowers,
      this.sculptures,
      this.signature,
      this.bubbleTrail,
      this.director,
      this.creatures,
      ...balloonGame,
      this.regionLook,
      places,
      this.clouds,
      places.lighthouse,
      hud,
      camera,
      this.studio,
      this.landmarks,
      places.spots,
      ripples,
      this.flowers,
      this.ground,
      this.sky,
      fx,
      this.avatar.cat,
      this.stars.models,
    ];
    this.tapOrder = [
      this.wings,
      this.rails,
      this.swings,
      this.stars,
      this.balloons,
      // 아래는 땅을 눌렀을 때만 반응한다(tap.ground)
      ripples,
      this.flowers,
      places,
      this.seeds,
      this.chimes,
      this.pillars,
      this.pads,
      this.rings,
    ];
  }

  /** 한 프레임. 한 프레임은 길어도 0.1 초로 자른다 */
  step(elapsed: number) {
    const dt = Math.min(0.1, elapsed);
    this.frame.dt = dt;
    this.frame.time += dt;
    this.fitPixels(elapsed);
    this.runFrame();
    this.warmBehindStudio();
    this.draw();
  }

  /** 꾸미기 씬 없이 바로 세상으로 들어가나(이미 꾸미고 온 사람 · 개발 ?quick). 기록을 읽은 뒤(wardrobe.ready)에 묻는다 */
  get startsInWorld(): boolean {
    return isStudioSkipped() || this.wardrobe.hasDressed;
  }

  /** 뒤에서 받던 나머지 에셋 받기가 끝났다(받지 못한 것이 있어도 끝난 것이다 — 그것을 기다리며 멈춰 있지 않는다) */
  restArrived() {
    this.isRestComing = false;
    this.owesWarm = true;
  }

  /**
   * 그리기 전에 데운다(불러오는 화면 뒤에서 한 번, 먼저 받을 에셋을 받은 뒤): 받은 그림을 모두 GPU 에 올리고, 멀리 있어 장면에서 떼어 둔
   * 것까지 한 번 다 그려 셰이더·도형을 올려 둔 다음, 첫 화면을 그린다. 그러지 않으면 처음 보는 것이 화면에 들어오는 프레임마다
   * 그 일을 하느라 끊긴다. 게임의 셈은 하지 않는다(그리기만)
   */
  warmUp() {
    const { renderer, scene, camera } = this.stage,
      models = this.s.models;
    for (let cold = models.takeCold(); cold; cold = models.takeCold()) renderer.initTexture(cold);
    this.fill();
    this.warmScene();
    renderer.render(scene, camera);
  }

  /**
   * 첫 화면에 보이는 모델의 키: 첫 프레임과 같은 자리에 모두를 놓아 보고(그리지는 않는다), 시작 카메라의 시야 안이면서
   * 가까운 것만 그리기 거리 안에 놓인 모델·생물. 추측이 아니라 실제로 놓인 자리로 고른다
   */
  startViewKeys(): string[] {
    const dt = this.frame.dt;
    this.frame.dt = 0;
    this.runFrame();
    this.frame.dt = dt;
    const p = this.s.player.p,
      cut = this.s.culler.cut;
    this.sight.update(this.stage.camera);
    // 생물은 그리는 거리(v·p > 0.9)부터 좁다
    const creatures = this.creatures.list
      .filter((c) => c.v.dot(p) > CREATURE_VIEW_COS)
      .map((c) => ({ key: c.k, v: c.v }));
    const placed = this.s.models.placements(),
      all = [...placed, ...creatures];
    const keys = new Set<string>();
    const probe = new THREE.Sphere();
    for (const { key, v } of all) {
      if (keys.has(key) || v.dot(p) <= cut) continue;
      // 땅 위 것도 높이 떠 있는 것(고래·풍선)도 들어오게 넉넉한 공으로 본다
      const lifted = S.R + START_VIEW_LIFT;
      probe.center.copy(v).multiplyScalar(lifted);
      probe.radius = START_VIEW_RADIUS;
      if (this.sight.sees(probe)) keys.add(key);
    }
    return [...keys];
  }

  /**
   * 에셋 받는 창구를 단다(시작할 때 한 번): 첫 화면·뒤 받기 밖에서 필요해진 모델(갈아입는 부품)과 옷 무늬 그림을 이 창구로 받는다.
   * 같은 키는 창구가 한 번만 받는다
   */
  useLoader(loader: AssetLoader) {
    const models = this.s.models;
    models.useRequester((k) => {
      loader
        .fetch(k)
        .then((asset) => {
          if (asset.kind === "model") models.deliver(k, asset.scene);
        })
        .catch((err) => {
          console.error("teum asset", k, err);
          models.failed(k);
        });
    });
    this.wardrobe.useLoader(loader);
  }

  /** 받은 하늘 그림을 건다 */
  setSkyTexture(tex: THREE.Texture) {
    this.sky.setTexture(tex);
  }

  /** 창 크기에 맞춘다 */
  resize() {
    this.s.camera.resize(this.stage.renderer);
  }

  /** 멈추고 그리던 것·리스너·DOM 을 치운다 */
  dispose() {
    this.input.dispose();
    this.sound.dispose();
    for (const t of this.frameOrder) if (typeof t !== "function") t.dispose();
    this.terrainView.dispose();
    this.brand.dispose();
    this.s.models.dispose();
    this.stage.dispose();
  }

  /* ─── 내부 ─────────────────────────── */

  // 지금 자리를 그린다. 뒤늦게 도착한 모델의 그림은 프레임마다 하나씩 미리 올린다(처음 보이는 프레임에 몰리지 않게)
  private draw() {
    const { renderer, scene, camera } = this.stage,
      cold = this.s.models.takeCold();
    if (cold) renderer.initTexture(cold);
    this.fill();
    renderer.render(scene, camera);
  }

  // 장면의 모든 것을 한 번 그려 셰이더·도형·그림을 GPU 에 올린다: 멀리 있어 떼어 둔 것을 붙이고, 일이 있을 때만 나타나려고
  // 숨겨 둔 것(대포 방울·등대 불빛·회오리…)까지 보이게 해서, 화면 한 점에만 그린다(정점만 지나가면 올라간다. 화면에는 남지 않는다).
  // 꾸미기 씬이 열려 있으면 카메라가 그 씬만 보므로 그동안은 세상까지 다 보게 한다
  private warmScene() {
    const { renderer, scene, camera } = this.stage;
    const seen = camera.layers.mask,
      whole = new THREE.Vector2();
    renderer.getSize(whole);
    camera.layers.enableAll();
    renderer.setScissor(0, 0, 1, 1);
    renderer.setScissorTest(true);
    const draw = () => renderer.render(scene, camera),
      drawAll = () => withAllShown(scene, draw);
    try {
      this.s.culler.withEverything(drawAll);
    } finally {
      renderer.setScissorTest(false);
      renderer.setScissor(0, 0, whole.x, whole.y);
      camera.layers.mask = seen;
    }
  }

  // 그리기 직전: 지금 카메라의 시야를 재고, 묶음들이 화면에 걸치는 것만 칸에 채운다
  private fill() {
    const sight = this.sight;
    sight.update(this.stage.camera);
    this.s.models.flush(sight, this.s.player.p, this.s.culler.cut, this.s.culler.eye);
    this.terrainView.flush(sight);
    this.flowers.flush(sight);
    this.pillars.flush(sight);
    this.pads.flush(sight);
  }

  // 에셋이 아직 자리를 잡는 중인가: 뒤에서 받는 것이 남았거나, 도착한 그림을 아직 다 올리지 못했다
  private get isSettling(): boolean {
    return this.isRestComing || this.s.models.hasCold;
  }

  // 처음 온 사람이 꾸미는 동안 나머지 에셋이 뒤에서 다 도착했으면(그림도 다 올렸으면), 세상으로 나가기 전에 한 번 더 데운다.
  // 꾸미기 씬은 가만히 있는 화면이라 이때 한 프레임 늦어도 보이지 않는다. 세상에 나온 뒤라면 하지 않는다(그 한 프레임이 끊긴다).
  // 한 번만 한다 — 나중에 옷장을 열어 부품이 하나씩 도착할 때마다 다시 하지 않는다
  private warmBehindStudio() {
    if (!this.owesWarm || this.s.models.hasCold) return;
    this.owesWarm = false;
    if (this.s.hud.isInStudio) this.warmScene();
  }

  // 프레임이 계속 느린 기기에서는 화면 배율을 낮춘다(core/pixelBudget.ts). elapsed: 지난 프레임부터 흐른 실제 시간(초).
  // 에셋이 아직 오는 동안은 재지 않는다 — 받아서 세우고 올리느라 느린 것을 기기가 느린 것으로 읽으면 안 된다
  private fitPixels(elapsed: number) {
    if (this.isSettling) return;
    const intervalMs = elapsed * 1000,
      ratio = this.pixels.feed(intervalMs);
    // 배율을 바꾸면 그리는 판의 크기도 같이 바뀐다(화면에 놓인 크기는 그대로)
    if (ratio !== null) this.stage.renderer.setPixelRatio(ratio);
  }

  // 이번 프레임 값(this.frame)으로 frameOrder 를 차례로 부른다
  private runFrame() {
    for (const t of this.frameOrder) {
      if (typeof t === "function") t();
      else t.update(this.frame);
    }
  }

  // 칙: 화면 좌표를 땅에 쏘아 맞은 자리를 정하고, 정해 둔 차례로 알린다
  private tap(x: number, y: number) {
    const ndcX = (x / innerWidth) * 2 - 1,
      ndcY = -(y / innerHeight) * 2 + 1;
    this.ndc.set(ndcX, ndcY);
    this.ray.setFromCamera(this.ndc, this.stage.camera);
    const hits = this.ray.intersectObject(this.ground.planet, false);
    const n = hits.length ? hits[0].point.clone().normalize() : null;
    const tap: Tap = { ground: n, time: this.frame.time };
    if (n) this.s.hud.hideHint();
    for (const t of this.tapOrder) t.onTap(tap);
  }

  // 자리표를 행성 위 자리로 옮긴다. 놀이·장소 자리를 모아(keep) 그 자리를 덮는 둔덕은 치운다.
  // 순서가 곧 결과다 — 바꾸지 않는다
  private layoutWorld() {
    const { terrain, occ } = this.s;
    this.ground.layout();
    this.places.layoutPlaces();
    terrain.placeFeatures();
    this.terrainView.layoutFeatures();
    const keep: THREE.Vector3[] = [];
    this.places.layoutItems(keep);
    this.streams.layout(keep);
    this.whirls.layout(keep, this.streams);
    this.chimes.layout(keep);
    this.rings.layout(keep, this.streams);
    this.pads.layoutHops();
    this.cannons.layout(keep);
    this.bumpers.layout(keep);
    this.balloons.layout(keep);
    this.arches.layout(keep);
    this.balls.layout(keep);
    this.rockets.layout(keep);
    this.thermals.layout(keep);
    this.wings.layout(keep);
    this.jets.layout();
    this.swings.layout(keep);
    this.pipes.layout();
    this.rails.layout(keep);
    this.funnels.layout();
    this.seeds.layout();
    this.stars.layout(keep);
    this.lakes.layout();
    this.slings.layout(keep);
    this.holes.layout(keep);
    this.pads.layout(keep);
    this.pillars.layout(keep);
    terrain.settle(keep, this.lakes.list, occ.zones);
    this.terrainView.layoutHills();
    this.flowers.settle();
    this.clouds.layout();
  }

  // 자리 차지: 이미 찬 자리와 비행 통로(키 작은 것을 두지 않는 길). 차례는 결과에 영향이 없다
  private claimAll() {
    const claimers = [
      this.places,
      this.sites,
      this.terrainView,
      this.rings,
      this.pads,
      this.pillars,
      this.whirls,
      this.chimes,
      this.cannons,
      this.bumpers,
      this.balloons,
      this.balls,
      this.stars,
      this.slings,
      this.swings,
      this.rockets,
      this.thermals,
      this.wings,
      this.holes,
      this.streams,
      this.arches,
      this.rails,
      this.lakes,
      this.pipes,
      this.funnels,
      this.seeds,
      this.jets,
    ];
    for (const c of claimers) c.claim();
  }
}
