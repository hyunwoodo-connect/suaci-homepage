// 놀이 결과: 놀이(이벤트)를 깬 일을 이 기기에 남긴다. 놀이는 깼다고 알리기만 하고(놀이 모듈의 입구가 여기에 적는다),
// 이벤트 페이지가 그 이벤트의 카드에 표시한다. 화면은 깼는지만 보지만 언제·몇 번·얼마나 빨리도 같이 남긴다 —
// 보상을 붙일 때 쓸 값이고, 기록에는 UTC 와 한국 시각을 함께 둔다. 보상을 실제로 줄 때는 서버가 다시 확인해야 한다(이 기록은 기기의 것이다)

/** 이벤트 하나를 깬 기록 */
export interface ClearRecord {
  /** 어떤 놀이였나(놀이 모듈 id) */
  activityId: string;
  /** 깬 횟수 */
  count: number;
  /** 처음 깬 때: UTC 밀리초와 한국 시각(ISO, +09:00) */
  firstAt: number;
  firstDtm: string;
  /** 마지막으로 깬 때 */
  lastAt: number;
  lastDtm: string;
  /** 가장 빨리 깬 시간(초). 시간을 재지 않는 놀이에는 없다 */
  bestSeconds?: number;
}

/** 깬 일 하나(놀이가 알린 것) */
export interface Clear {
  eventId: string;
  activityId: string;
  /** 깬 때(UTC 밀리초) */
  at: number;
  /** 걸린 시간(초) — 시간을 재는 놀이만 */
  seconds?: number;
}

/** 이 기기의 놀이 결과를 두는 자리 */
export const PLAY_KEY = "suaci.plays";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 그 이벤트를 깬 기록(없거나 읽지 못하면 null) */
export function readClear(eventId: string): ClearRecord | null {
  const clears = readClears();
  return Object.hasOwn(clears, eventId) ? clears[eventId] : null;
}

/** 이벤트를 깼다고 적는다. 적지 못하는 기기(저장을 막아 둔 브라우저)에서는 조용히 지나간다 — 놀이는 계속된다 */
export function recordClear(clear: Clear): void {
  const clears = readClears();
  const before = Object.hasOwn(clears, clear.eventId) ? clears[clear.eventId] : null;
  const dtm = kstDtm(clear.at);
  const record: ClearRecord = {
    activityId: clear.activityId,
    count: (before?.count ?? 0) + 1,
    firstAt: before?.firstAt ?? clear.at,
    firstDtm: before?.firstDtm ?? dtm,
    lastAt: clear.at,
    lastDtm: dtm,
  };
  const best = fastest(before?.bestSeconds, clear.seconds);
  if (best !== undefined) record.bestSeconds = best;
  clears[clear.eventId] = record;
  try {
    const text = JSON.stringify({ v: 1, clears });
    localStorage.setItem(PLAY_KEY, text);
  } catch {
    // 저장을 막아 둔 브라우저 — 표시만 남지 않는다
  }
}

/* ─── 내부 ─────────────────────────── */

// 이 기기의 깬 기록 모두(이벤트 id → 기록). 없거나 깨졌으면 빈 것, 모양이 다른 칸은 버린다
function readClears(): Record<string, ClearRecord> {
  const out: Record<string, ClearRecord> = {};
  try {
    const text = localStorage.getItem(PLAY_KEY);
    if (!text) return out;
    const raw: unknown = JSON.parse(text);
    if (!isRecord(raw) || raw.v !== 1 || !isRecord(raw.clears)) return out;
    for (const [eventId, value] of Object.entries(raw.clears)) {
      if (isClearRecord(value)) out[eventId] = value;
    }
  } catch {
    // 깨진 기록·저장을 막아 둔 브라우저 — 깬 적 없는 것으로 본다
  }
  return out;
}

function isClearRecord(v: unknown): v is ClearRecord {
  return (
    isRecord(v) &&
    typeof v.activityId === "string" &&
    typeof v.count === "number" &&
    v.count >= 1 &&
    typeof v.firstAt === "number" &&
    typeof v.firstDtm === "string" &&
    typeof v.lastAt === "number" &&
    typeof v.lastDtm === "string" &&
    (v.bestSeconds === undefined || typeof v.bestSeconds === "number")
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// 둘 가운데 더 빠른 쪽(없는 쪽은 뺀다)
function fastest(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.min(a, b);
}

// UTC 밀리초 → 한국 시각 ISO(+09:00) — 서버 기록의 Dtm 과 같은 모양
function kstDtm(at: number): string {
  const kstMs = at + KST_OFFSET_MS;
  const shifted = new Date(kstMs);
  return shifted.toISOString().replace("Z", "+09:00");
}
