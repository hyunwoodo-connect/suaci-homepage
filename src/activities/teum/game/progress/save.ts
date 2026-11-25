// 한 사람의 '틈' 기록: 랜드마크에 다녀간 수. 아바타(차림·꾸민 적)는 여기 두지 않는다 — 놀이마다 같이 쓰는 공용 기록(lib/avatar)에 있다.
// 판(v)이 있어 모양이 바뀌면 옮겨 읽는다(칸을 더하기만 한 것은 판을 올리지 않는다 — 없던 칸은 빈 값으로 읽고,
// 모르는 칸은 버린다). 어디에 두는지는 store 가 정한다

/** 저장 모양의 판 */
const SAVE_VERSION = 1;

/** 랜드마크(마을) 하나에 다녀간 기록: 몇 번째인지, 마지막으로 온 날 */
interface LandmarkVisit {
  n: number;
  day: number;
}

/** 한 사람의 기록 */
export interface TeumSave {
  v: typeof SAVE_VERSION;
  /** 랜드마크(지역 차례)마다 다녀간 기록 */
  lm: Record<number, LandmarkVisit>;
}

/** 빈 기록 */
export function emptySave(): TeumSave {
  return { v: SAVE_VERSION, lm: {} };
}

/** 저장해 둔 값을 읽는다: 판이 다르거나 깨진 칸은 빈 값으로(받은 값을 믿지 않는다) */
export function readSave(raw: unknown): TeumSave {
  const out = emptySave();
  if (!isRecord(raw) || raw.v !== SAVE_VERSION) return out;
  if (isRecord(raw.lm))
    for (const [k, m] of Object.entries(raw.lm)) {
      const hk = Number(k);
      if (!Number.isInteger(hk) || !isRecord(m) || !isNumber(m.n) || !isNumber(m.day)) continue;
      out.lm[hk] = { n: m.n, day: m.day };
    }
  return out;
}

/* ─── 내부 ─────────────────────────── */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
