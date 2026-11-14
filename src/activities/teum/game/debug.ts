import type { Game } from "./state";

// 개발 중 시험용 — 운영 빌드에서는 NODE_ENV 비교가 상수가 되어 통째로 빠진다.
// 주소에 ?seed=숫자 를 붙이면 난수를 고정하고 게임 상태를 window.__teum 에 둔다(같은 입력이면 같은 그림이 나오는지 보는 데 쓴다)

interface DebugWindow {
  __teum?: Game;
}

/** ?seed 가 있으면 난수를 고정한다. 되돌리는 함수를 돌려준다(없으면 아무것도 안 한다) */
export function seedRandom(): () => void {
  if (process.env.NODE_ENV === "production") return () => {};
  const seed = new URLSearchParams(location.search).get("seed");
  if (seed === null) return () => {};
  const real = Math.random;
  let s = Number(seed) >>> 0;
  // mulberry32
  Math.random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    const mixA = t ^ (t >>> 15),
      oddA = t | 1;
    t = Math.imul(mixA, oddA);
    const mixB = t ^ (t >>> 7),
      oddB = t | 61;
    t ^= t + Math.imul(mixB, oddB);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => {
    Math.random = real;
  };
}

/** 시험용 주소 인자 ?nodir: 지루함 감독과 방울 길을 끈다(빈 구간을 감독 없이 잴 때). 운영에선 늘 false */
export function isDirectorOff(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return new URLSearchParams(location.search).has("nodir");
}

/** ?seed 가 있으면 게임 상태를 창에 걸어 둔다 */
export function exposeGame(g: Game): () => void {
  if (process.env.NODE_ENV === "production") return () => {};
  if (!new URLSearchParams(location.search).has("seed")) return () => {};
  const w = window as unknown as DebugWindow;
  w.__teum = g;
  return () => {
    delete w.__teum;
  };
}
