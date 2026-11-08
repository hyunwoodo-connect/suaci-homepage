/**
 * 벽의 `내 거`·`리본 달았어요` 표시와 이 폰에서 가린 네컷. 서버가 아니라 이 폰에 둔다 — 캐시된 목록이 기기마다 같게.
 * 저장이 막혀도(사생활 보호 모드) 표시만 빠지고 화면은 그대로.
 */

const MINE = "suaci.take-four.mine";
const RIBBONS = "suaci.take-four.ribbons";
const HIDDEN = "suaci.take-four.hidden";
/** 오래된 것부터 버린다 — localStorage가 끝없이 늘지 않게 */
const MAX_IDS = 200;

function readIds(key: string): string[] {
  try {
    const stored = localStorage.getItem(key) ?? "[]";
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]): void {
  try {
    const kept = ids.slice(-MAX_IDS);
    const serialized = JSON.stringify(kept);
    localStorage.setItem(key, serialized);
  } catch {}
}

function addId(key: string, id: string): void {
  writeIds(key, [...readIds(key).filter((v) => v !== id), id]);
}

/** 이 폰에서 붙인 네컷으로 적어 둔다 — 벽에 올린 직후 `postStrip` 이 부른다 */
export function rememberMine(id: string): void {
  addId(MINE, id);
}

/** 이 폰에서 붙인 네컷인가 */
export function isMine(id: string): boolean {
  return readIds(MINE).includes(id);
}

/** `내 거` 기록에서 뺀다 */
export function forgetMine(id: string): void {
  writeIds(
    MINE,
    readIds(MINE).filter((v) => v !== id),
  );
}

/** 리본을 단 네컷으로 적어 둔다 — 다시 열어도 `리본 달았어요` 로 보이게 */
export function rememberRibbon(id: string): void {
  addId(RIBBONS, id);
}

/** 이 폰에서 리본을 단 네컷인가 */
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

/** 이 폰에서 가린 네컷인가 — 벽 목록을 합칠 때 뺀다 */
export function isHidden(id: string): boolean {
  return readIds(HIDDEN).includes(id);
}
