import { firstScreenKeys } from "../../assets/firstScreen";
import { createAssetLoader } from "../../assets/load";
import type { LoadedAsset } from "../../assets/load";
import type { Manifest } from "../../assets/manifest";
import type { RunningGame } from "../index";
import { isTeaDebug, teaSeed, teaSpeed } from "./params";
import { TeaGame } from "./TeaGame";

// 티타임 행성의 시작: 지금 게임(game/index)과 같은 모양(start → stop)이라 입구가 주소만 보고 둘 중 하나를 받는다.
// 첫 화면: 아바타(몸·지금 차림·고양이)와 무대에 선 모델을 받고 나서 그리기 시작한다. 하늘 그림은 쓰지 않는다(하늘이 시계라 색으로 칠한다)

/** start 에 넘기는 것 */
export interface TeaStartOptions {
  assets: Manifest;
  /** 첫 화면 에셋을 받는 동안(받은 바이트 / 전체). 다 받고 첫 프레임을 그리기 직전에 1 */
  onProgress?: (ratio: number) => void;
}

/** 티타임 행성을 시작한다 */
export function start(
  canvas: HTMLCanvasElement,
  { assets, onProgress }: TeaStartOptions,
): RunningGame {
  const seed = teaSeed() ?? randomSeed();
  const options = { debug: isTeaDebug(), speed: teaSpeed() };
  const game = new TeaGame(canvas, assets, seed, options);
  // 개발에서만: 브라우저 도구로 몸을 옮기고 값을 읽는다
  if (process.env.NODE_ENV !== "production") Object.assign(window, { __tea: game });
  let stopped = false,
    raf = 0,
    last = 0;
  const onResize = () => game.resize();
  addEventListener("resize", onResize);
  const deliver = (key: string, asset: LoadedAsset) => {
    if (stopped || asset.kind !== "model") return;
    game.deliver(key, asset.scene);
  };
  const tick = (now: number) => {
    if (stopped) return;
    const elapsed = (now - last) / 1000;
    game.step(elapsed);
    last = now;
    raf = requestAnimationFrame(tick);
  };
  const reportFirstScreen = (loaded: number, total: number) => {
    let ratio = 0.99;
    if (total) {
      const share = loaded / total;
      ratio = Math.min(0.99, share);
    }
    onProgress?.(ratio);
  };
  const loader = createAssetLoader(assets);
  game.useLoader(loader);
  game.wardrobe.ready
    .then(() => {
      if (stopped) return;
      const inView = game.firstScreenKeys(),
        wearing = game.wardrobe.assetKeys();
      const first = firstScreenKeys(assets, inView, wearing).filter(
        (k) => assets.assets[k]?.category !== "sky",
      );
      const waiting = game.models.waiting;
      const rest = Object.keys(assets.assets).filter((k) => !first.includes(k) && waiting.has(k));
      return loader.loadMany(first, deliver, reportFirstScreen).then(() => rest);
    })
    .then((rest) => {
      if (stopped || !rest) return;
      onProgress?.(1);
      last = performance.now();
      raf = requestAnimationFrame(tick);
      return loader.loadMany(rest, deliver);
    })
    .catch((err) => console.error("teum tea", err));
  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      removeEventListener("resize", onResize);
      game.dispose();
    },
  };
}

/* ─── 내부 ─────────────────────────── */

// 판마다 다른 씨앗(&seed= 가 없을 때 — 오늘의 판·도전장 씨앗은 M5)
function randomSeed(): number {
  const r = Math.random() * 4294967296;
  return r >>> 0;
}
