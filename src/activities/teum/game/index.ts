import type { LoadedAsset } from "@/lib/asset-kit/load";
import { createAssetLoader } from "@/lib/asset-kit/load";
import type { Manifest } from "@/lib/asset-kit/manifest";
import type { Locks } from "@/lib/avatar/outfit";

import { TEUM_BUNDLE } from "../assets/config";
import { firstScreenKeys } from "../assets/firstScreen";
import { devFestival, devMap, devSeed, exposeGame } from "./debug";
import { Game } from "./Game";
import { DEFAULT_MAP } from "./maps";

/** start 에 넘기는 것 */
interface StartOptions {
  /** 이번 버전의 에셋 목록 */
  assets: Manifest;
  /** 첫 화면 에셋을 받는 동안(받은 바이트 / 전체). 다 받고 첫 프레임을 그리기 직전에 1 */
  onProgress?: (ratio: number) => void;
  /** 아직 받지 못한 옷(지금 — 옷장이 그 칸을 잠근다). 놀이를 깨면 줄어든다 */
  locks: () => Locks;
  /** 놀이를 깼다(물풍선을 다 먹은 순간 — 걸린 시간). 한 번 더 해서 또 깨면 또 알린다 */
  onClear: (result: { seconds: number }) => void;
  /** 깬 뒤 터지는 것까지 다 보여 줬다 — 여는 쪽이 이때 랜덤박스를 얹는다 */
  onFinished: () => void;
  /** 나가기를 눌렀다 — 어디로 데리고 나갈지는 여는 쪽이 정한다 */
  onLeave: () => void;
}

/** 돌고 있는 게임 */
interface RunningGame {
  /** 한 번 더: 물풍선이 모두 돌아온다 */
  playAgain(): void;
  /** 계속 놀기: 물풍선 놀이를 치우고 떠다니기만 한다 */
  keepPlaying(): void;
  /** 멈추고 그리던 것·리스너·DOM 을 치운다 */
  stop(): void;
}

/**
 * 게임을 시작한다: 세계를 만들고 배치를 끝낸 뒤, 첫 화면 에셋(아바타와 그 차림·하늘·시작 자리 가까이 놓인 모델과 생물)을 받고 나서 그리기 시작한다.
 * 차림은 기록을 읽어야 알므로 첫 화면은 기록을 읽은 뒤에 고른다. 나머지 에셋은 처음 온 사람이면 뒤에서(꾸미는 동안) 받아 오는 대로
 * 제자리에 세우고, 바로 세상으로 들어가는 사람이면 같이 다 받은 뒤에 시작한다.
 */
export function start(
  canvas: HTMLCanvasElement,
  { assets, onProgress, locks, onClear, onFinished, onLeave }: StartOptions,
): RunningGame {
  const seed = devSeed() ?? randomSeed();
  const map = devMap() ?? DEFAULT_MAP;
  const festival = devFestival();
  const game = new Game(canvas, assets, seed, map, festival, locks);
  // 놀이는 시작과 끝으로 닫혀 있다: 깬 것과 나가겠다는 것만 밖에 알리고, 기록·이동은 여는 쪽이 한다
  game.s.events.on("waterBalloonsCleared", ({ seconds }) => onClear({ seconds }));
  game.s.events.on("waterBalloonsFinished", () => onFinished());
  game.s.events.on("leavePressed", onLeave);
  let stopped = false,
    raf = 0,
    last = 0;
  const onResize = () => game.resize();
  addEventListener("resize", onResize);
  // 그림은 하늘만 여기서 건다(옷 무늬는 옷장이 같은 창구로 받아 가져간다)
  const deliver = (key: string, asset: LoadedAsset) => {
    if (stopped) return;
    if (asset.kind === "model") game.s.models.deliver(key, asset.scene);
    else if (assets.assets[key]?.category === "sky") game.setSkyTexture(asset.texture);
  };
  const tick = (now: number) => {
    if (stopped) return;
    const elapsed = (now - last) / 1000;
    game.step(elapsed);
    last = now;
    raf = requestAnimationFrame(tick);
  };
  // 먼저 받을 것을 다 받아도 0.99 에서 멈춘다 — 1 은 첫 프레임을 그리기 직전에 보낸다
  const reportFirstScreen = (loaded: number, total: number) => {
    let ratio = 0.99;
    if (total) {
      const share = loaded / total;
      ratio = Math.min(0.99, share);
    }
    onProgress?.(ratio);
  };
  const loader = createAssetLoader(TEUM_BUNDLE, assets);
  game.useLoader(loader);
  let unexpose = () => {};
  game.wardrobe.ready
    .then(() => {
      if (stopped) return;
      // 시작 화면에 실제로 보이는 것(떠도는 무리는 판마다 자리가 달라 그 판의 자리로)
      const inView = game.startViewKeys();
      const wearing = game.wardrobe.assetKeys(),
        first = firstScreenKeys(assets, inView, wearing);
      unexpose = exposeGame(game, first);
      const waiting = game.s.models.waiting;
      const rest = Object.keys(assets.assets).filter((k) => !first.includes(k) && waiting.has(k));
      // 꾸미기 씬 없이 바로 세상으로 들어가는 사람은 나머지도 불러오는 화면 뒤에서 다 받는다 — 놀기 시작한 뒤에 도착하면 세우고
      // GPU 에 올리는 일이 프레임마다 끼어들어 처음 몇 초가 끊긴다(전에 온 사람이라 대개 브라우저에 받아 둔 것이 있다).
      // 처음 온 사람은 첫 화면만 받고 꾸미기 씬을 열고, 꾸미는 동안 뒤에서 받는다
      const upfront = game.startsInWorld ? [...first, ...rest] : first,
        later = game.startsInWorld ? [] : rest;
      return loader.loadMany(upfront, deliver, reportFirstScreen).then(() => later);
    })
    .then((later) => {
      if (stopped || !later) return;
      // 불러오는 화면이 걷히기 전에: 첫 화면을 미리 그려 두면 첫 프레임과, 처음 보는 것이 들어오는 프레임이 끊기지 않는다.
      // 데우기는 없어도 놀 수 있는 일이라, 실패해도 시작은 한다(불러오는 화면에 갇히지 않게)
      try {
        game.warmUp();
      } catch (err) {
        console.error("teum warm-up", err);
      }
      onProgress?.(1);
      last = performance.now();
      raf = requestAnimationFrame(tick);
      return loader.loadMany(later, deliver).then(() => game.restArrived());
    })
    .catch((err) => console.error("teum", err));
  return {
    playAgain: () => game.waterBalloons?.playAgain(),
    keepPlaying: () => game.waterBalloons?.keepPlaying(),
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      unexpose();
      removeEventListener("resize", onResize);
      game.dispose();
    },
  };
}

/* ─── 내부 ─────────────────────────── */

// 운영은 판마다 다른 씨앗
function randomSeed(): number {
  const r = Math.random() * 4294967296;
  return r >>> 0;
}
