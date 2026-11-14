import { firstScreenKeys } from "../assets/firstScreen";
import { createAssetLoader } from "../assets/load";
import type { LoadedAsset } from "../assets/load";
import type { Manifest } from "../assets/manifest";
import { devSeed, exposeGame } from "./debug";
import { Game } from "./Game";

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
 * 게임을 시작한다: 세계를 만들고 배치를 끝낸 뒤, 첫 화면 에셋(아바타·하늘·시작 자리 가까이 놓인 모델과 생물)을 받고 나서 그리기 시작한다.
 * 나머지 에셋은 뒤에서 받고, 오는 대로 제자리에 선다.
 */
export function start(
  canvas: HTMLCanvasElement,
  { assets, onProgress }: StartOptions,
): RunningGame {
  const seed = devSeed() ?? randomSeed();
  const game = new Game(canvas, assets, seed);
  const unexpose = exposeGame(game);
  let stopped = false,
    raf = 0,
    last = 0;
  const onResize = () => game.resize();
  addEventListener("resize", onResize);
  const deliver = (key: string, asset: LoadedAsset) => {
    if (stopped) return;
    if (asset.kind === "texture") game.setSkyTexture(asset.texture);
    else game.s.models.deliver(key, asset.scene);
  };
  const tick = (now: number) => {
    if (stopped) return;
    const elapsed = (now - last) / 1000;
    game.step(elapsed);
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
  // 시작 화면에 실제로 보이는 것(떠도는 무리는 판마다 자리가 달라 그 판의 자리로)
  const inView = game.startViewKeys();
  const first = firstScreenKeys(assets, inView);
  const waiting = game.s.models.waiting;
  const rest = Object.keys(assets.assets).filter((k) => !first.includes(k) && waiting.has(k));
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
