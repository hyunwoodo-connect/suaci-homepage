import * as THREE from "three";

import { firstScreenKeys, nearbyCreatureKeys } from "../assets/firstScreen";
import { createAssetLoader } from "../assets/load";
import type { LoadedAsset } from "../assets/load";
import type { Manifest } from "../assets/manifest";
import { createMe } from "./avatar/me";
import { setupAvatar } from "./avatar/rig";
import { placeBrand } from "./brand";
import { resize } from "./camera";
import { placeCreatures } from "./creatures";
import { exposeGame, seedRandom } from "./debug";
import { createPetals } from "./fx/petals";
import { createTrail } from "./fx/ribbons";
import { createRipples } from "./fx/ripples";
import { createFx } from "./fx/sparks";
import { createHud, removeHud } from "./hud";
import { attachInput } from "./input";
import { frame } from "./loop";
import { createModels, deliverModel } from "./models";
import { goHome } from "./player";
import { createArches } from "./rides/arches";
import { createBalloons } from "./rides/balloons";
import { createBalls } from "./rides/balls";
import { createBumpers } from "./rides/bumpers";
import { createCannons } from "./rides/cannons";
import { createChimes } from "./rides/chimes";
import { createComet } from "./rides/comet";
import { createFunnels } from "./rides/funnels";
import { createHoles } from "./rides/holes";
import { createJets } from "./rides/jets";
import { createHops, createPads } from "./rides/pads";
import { createPillars } from "./rides/pillars";
import { createPipes } from "./rides/pipes";
import { createRails } from "./rides/rails";
import { createRings } from "./rides/rings";
import { createRockets } from "./rides/rockets";
import { createSeedFields, createSprouts } from "./rides/seeds";
import { createSlings } from "./rides/slings";
import { createStars } from "./rides/stars";
import { createStreams } from "./rides/streams";
import { createSwings } from "./rides/swings";
import { createThermals } from "./rides/thermals";
import { createWhale, whalePath } from "./rides/whale";
import { createWhirls } from "./rides/whirls";
import { createWings } from "./rides/wings";
import { fitModels, fitSkyModels, placeScenery } from "./scenery";
import { createDirector } from "./scenery/director";
import { createBubbleTrail } from "./scenery/trail";
import { placeSculptures } from "./sculptures";
import type { Game } from "./state";
import { createPlayer, createRides, createSaid, createTick } from "./state";
import { createFlowers } from "./world/flowers";
import { createGround } from "./world/ground";
import { createLakes } from "./world/lakes";
import { cloneLayout } from "./world/layout";
import { layoutWorld } from "./world/layoutPass";
import { setLook } from "./world/look";
import { createMats } from "./world/materials";
import { createPlaces } from "./world/places";
import { createSites } from "./world/sites";
import { createSky, setSkyTexture } from "./world/sky";
import { from } from "./world/sphere";
import { createStage } from "./world/stage";
import { createBumps, createClouds, createFeatures, createHills } from "./world/terrain";

/** start 에 넘기는 것 */
export interface StartOptions {
  /** 이번 버전의 에셋 목록 */
  assets: Manifest;
  /** 첫 화면 에셋을 받는 동안(받은 바이트 / 전체). 다 받고 첫 프레임을 그리기 직전에 1 */
  onProgress?: (ratio: number) => void;
}

/** 돌고 있는 게임 */
export interface RunningGame {
  /** 멈추고 그리던 것·리스너·DOM 을 치운다 */
  stop(): void;
}

/**
 * 게임을 시작한다: 세계를 만들고 배치를 끝낸 뒤, 첫 화면 에셋(아바타·하늘·나무·꽃·가까운 생물)을 받고 나서 그리기 시작한다.
 * 나머지 에셋은 뒤에서 받고, 오는 대로 제자리에 선다.
 */
export function start(
  canvas: HTMLCanvasElement,
  { assets, onProgress }: StartOptions,
): RunningGame {
  const unseed = seedRandom();
  const g = buildGame(canvas, assets);
  const unexpose = exposeGame(g);
  let stopped = false,
    raf = 0,
    last = 0;
  const onResize = () => resize(g);
  addEventListener("resize", onResize);
  const deliver = (key: string, asset: LoadedAsset) => {
    if (stopped) return;
    if (asset.kind === "texture") setSkyTexture(g.sky, asset.texture);
    else deliverModel(g, key, asset.scene);
  };
  const tick = (now: number) => {
    if (stopped) return;
    frame(g, now, last);
    last = now;
    raf = requestAnimationFrame(tick);
  };
  // 첫 화면을 다 받아도 0.99 에서 멈춘다 — 1 은 첫 프레임을 그리기 직전에 보낸다
  const reportFirstScreen = (loaded: number, total: number) => {
    let ratio = 0.99;
    if (total) {
      const share = loaded / total;
      ratio = Math.min(0.99, share);
    }
    onProgress?.(ratio);
  };
  const loader = createAssetLoader(assets);
  const creatureSpots = g.creatures.CR.map((c) => ({ key: c.k, v: c.v }));
  const nearby = nearbyCreatureKeys(creatureSpots, g.pl.p);
  const first = firstScreenKeys(assets, nearby);
  const rest = Object.keys(assets.assets).filter(
    (k) => !first.includes(k) && g.models.waiting.has(k),
  );
  loader
    .loadMany(first, deliver, reportFirstScreen)
    .then(() => {
      if (stopped) return;
      onProgress?.(1);
      last = performance.now();
      raf = requestAnimationFrame(tick);
      return loader.loadMany(rest, deliver);
    })
    .catch((err) => console.error("teum", err));
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      unexpose();
      unseed();
      removeEventListener("resize", onResize);
      g.input.detach();
      removeHud(g.hud);
      disposeScene(g.scene);
      g.envTex.dispose();
      g.renderer.dispose();
      g.renderer.forceContextLoss();
    },
  };
}

/* ─── 내부 ─────────────────────────── */

// 세계를 시제품과 같은 순서로 만든다(만드는 순서가 지형 난수·배치·그리는 순서를 정한다)
function buildGame(canvas: HTMLCanvasElement, manifest: Manifest): Game {
  const g = createStage(canvas) as Game;
  g.L = cloneLayout();
  g.mats = createMats();
  g.models = createModels(manifest);
  g.time = 0;
  g.pl = createPlayer();
  g.t = createTick();
  g.rides = createRides();
  g.said = createSaid();
  g.lookU = { sat: { value: 0 }, wash: { value: 0 } };
  g.lookSet = false;
  // ---- 장면·땅·하늘 ----
  g.ground = createGround(g.mats, g.scene);
  g.sky = createSky(g.scene, g.SUN);
  // 마을 중심(체커 색을 바꾸는 자리)
  g.L.hub.forEach((h, i) => {
    const hubV = from(h.dist, h.bear);
    g.ground.GND.uHubV.value[i].copy(hubV);
  });
  // ---- 장소·랜드마크 ----
  g.places = createPlaces(g);
  g.sites = createSites(g);
  placeBrand(g);
  // ---- 놀이기구 ----
  g.rings = createRings(g);
  g.pads = createPads(g);
  g.pillars = createPillars(g);
  g.streams = createStreams(g);
  g.whirls = createWhirls(g);
  g.chimes = createChimes(g);
  createHops(g);
  g.cannons = createCannons(g);
  g.bumpers = createBumpers(g);
  g.balloons = createBalloons(g);
  g.arches = createArches(g);
  g.balls = createBalls(g);
  g.stars = createStars(g);
  g.lakes = createLakes(g);
  const slings = createSlings(g);
  g.slings = slings.list;
  g.barGeo = slings.barGeo;
  g.swings = createSwings(g);
  g.pipes = createPipes(g);
  g.rails = createRails(g);
  g.funnels = createFunnels(g);
  g.seeds = { fields: createSeedFields(g), sprouts: createSprouts(g), sproutI: 0 };
  g.zones = [];
  g.rockets = createRockets(g);
  g.thermals = createThermals(g);
  g.wings = createWings(g);
  g.comet = createComet(g);
  g.jets = createJets(g);
  g.holes = createHoles(g);
  // ---- 지형 ----
  createBumps(g);
  g.flowers = createFlowers(g);
  g.petals = createPetals();
  createHills(g);
  createClouds(g);
  g.whale = createWhale(g);
  createFeatures(g);
  // ---- 나 ----
  g.me = createMe(g);
  g.trail = createTrail(g);
  const hudParent = canvas.parentElement ?? document.body;
  g.hud = createHud(hudParent);
  g.input = attachInput(g, canvas);
  g.ripples = createRipples();
  resize(g);
  layoutWorld(g);
  goHome(g);
  // ---- 빛과 톤 ----
  g.fx = createFx(g);
  g.thermals.thermM.geometry = g.petals.geo;
  g.thermals.thermM.material = g.petals.mat;
  g.streams.streaks.geometry = g.petals.geo;
  g.streams.streaks.material = g.petals.mat;
  setLook(g);
  // ---- 모델 자리(받기 전에 배치를 끝낸다) ----
  setupAvatar(g);
  fitModels(g);
  placeScenery(g);
  g.sculptures = placeSculptures(g);
  whalePath(g);
  g.bubbleTrail = createBubbleTrail(g);
  g.director = createDirector(g);
  placeCreatures(g);
  fitSkyModels(g);
  return g;
}

function disposeScene(scene: THREE.Scene) {
  scene.traverse((o) => {
    if (!(
      o instanceof THREE.Mesh ||
      o instanceof THREE.Points ||
      o instanceof THREE.Line ||
      o instanceof THREE.Sprite
    ))
      return;
    o.geometry?.dispose();
    const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose();
      m.dispose();
    }
  });
}
