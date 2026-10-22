/**
 * 벽의 `내 거`·`리본 달았어요` 표시와 이 폰에서 가린 네컷. 서버가 아니라 이 폰에 둔다 — 캐시된 목록이 기기마다 같게.
 * 저장이 막혀도(사생활 보호 모드) 표시만 빠지고 화면은 그대로.
 */

const MINE = "tf_mine";
const RIBBONS = "tf_ribbons";
const HIDDEN = "tf_hidden";
/** 오래된 것부터 버린다 — localStorage가 끝없이 늘지 않게 */
const MAX_IDS = 200;

function readIds(key: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(ids.slice(-MAX_IDS)));
  } catch {}
}

function addId(key: string, id: string): void {
  writeIds(key, [...readIds(key).filter((v) => v !== id), id]);
}

export function rememberMine(id: string): void {
  addId(MINE, id);
}

export function isMine(id: string): boolean {
  return readIds(MINE).includes(id);
}

export function forgetMine(id: string): void {
  writeIds(
    MINE,
    readIds(MINE).filter((v) => v !== id),
  );
}

export function rememberRibbon(id: string): void {
  addId(RIBBONS, id);
}

export function hasRibbon(id: string): boolean {
  return readIds(RIBBONS).includes(id);
}

/**
 * 이 폰에서 신고했거나 뗀 네컷. 서버에선 바로 내려가지만 목록 응답이 15초 캐시라
 * 벽으로 돌아왔을 때 캐시된 목록에서도 빼려고 둔다.
 */
export function rememberHidden(id: string): void {
  addId(HIDDEN, id);
}

export function isHidden(id: string): boolean {
  return readIds(HIDDEN).includes(id);
}
