import type { AvatarLook } from "../avatar/outfit";
import { readLook } from "../avatar/outfit";

// 한 사람의 '틈' 기록(구조만 — 수집·상자·부탁·도장의 화면과 보상은 아직 정하지 않았다).
// 모양은 시제품 v78 스케치(CHANGES-v65-v78 3장)와 같고, v82 에서 아바타 차림(look)과 꾸미기 씬을 지났는지(dressed)가 늘었다.
// 판(v)이 있어 모양이 바뀌면 옮겨 읽는다(칸을 더하기만 한 것은 판을 올리지 않는다 — 없던 칸은 빈 값으로 읽는다).
// 저장하는 곳(store)과 뽑기·판정(judge)은 따로 둔다 — 지금은 이 기기, 실물 보상이 걸리면 서버로 바꾼다

/** 저장 모양의 판 */
export const SAVE_VERSION = 1;

/** 보관함에 꺼내 데리고 다니는 최대 수 · 안 연 상자 최대 수 · 한 주의 도장 수 */
export const PARTY_MAX = 3,
  BOX_MAX = 5,
  WEEK_STAMPS = 6;

/** 상자를 얻는 곳·까닭: 길에서 주움 · 새 친구 · 부탁 · 도장 · 하루 덤 */
export type BoxSource = "road" | "friend" | "quest" | "stamp" | "bonus";

/** 상자에서 나온 것 — 무엇을 줄지는 아직 정하지 않았다(실물·한정 친구·꾸미기 조각·꽝) */
export type Prize = "physical" | "species" | "part" | "blank";

/** 오늘의 부탁: A 데려오기 · B 고래 타기 · C 안부 전하기 · D 귀한 손님 만나기 */
export type QuestType = "A" | "B" | "C" | "D";

/** 랜드마크(마을) 하나에 다녀간 기록: 몇 번째인지, 지난번에 데려온 친구, 마지막으로 온 날 */
export interface LandmarkVisit {
  n: number;
  pal: string | null;
  day: number;
}

/** 오늘의 부탁 상태: 날, 데려올 종(k), 안부 전할 지역(r), 종류, 끝냄·받음·중간(데려옴·탐·전함·만남) */
export interface QuestState {
  day: number;
  k: string;
  r: number;
  type: QuestType | "";
  done: boolean;
  told: boolean;
  mid: boolean;
}

/** 한 사람의 기록 */
export interface TeumSave {
  v: typeof SAVE_VERSION;
  /** 처음 친해진 종(키 → 그때) */
  collected: Record<string, { at: number }>;
  /** 보관함에서 꺼낸 차례(최대 PARTY_MAX) */
  party: string[];
  /** 안 연 상자(최대 BOX_MAX) · 꽝이 나오지 않을 상자 수 */
  boxes: number;
  sure: number;
  /** 랜드마크(지역 차례)마다 다녀간 기록 */
  lm: Record<number, LandmarkVisit>;
  /** 이번 주(주 번호)에 도장 찍은 날들 */
  stamps: { w: number; d: number[] };
  /** 하루 덤 상자를 받은 날(없으면 null) */
  bonusDay: number | null;
  /** 오늘의 부탁(없으면 null) */
  quest: QuestState | null;
  /** 아바타 차림(한 번도 고르지 않았으면 null) */
  look: AvatarLook | null;
  /** 꾸미기 씬을 한 번 지났나(지나기 전에는 세상보다 꾸미기 씬이 먼저 뜬다) */
  dressed: boolean;
}

/** 빈 기록 */
export function emptySave(): TeumSave {
  return {
    v: SAVE_VERSION,
    collected: {},
    party: [],
    boxes: 0,
    sure: 0,
    lm: {},
    stamps: { w: -1, d: [] },
    bonusDay: null,
    quest: null,
    look: null,
    dressed: false,
  };
}

/** 저장해 둔 값을 읽는다: 판이 다르거나 깨진 칸은 빈 값으로(받은 값을 믿지 않는다) */
export function readSave(raw: unknown): TeumSave {
  const out = emptySave();
  if (!isRecord(raw) || raw.v !== SAVE_VERSION) return out;
  if (isRecord(raw.collected))
    for (const [k, c] of Object.entries(raw.collected))
      if (isRecord(c) && isNumber(c.at)) out.collected[k] = { at: c.at };
  if (Array.isArray(raw.party)) {
    const party = raw.party.filter((k): k is string => typeof k === "string");
    out.party = party.slice(0, PARTY_MAX);
  }
  if (isNumber(raw.boxes)) out.boxes = clampCount(raw.boxes, BOX_MAX);
  if (isNumber(raw.sure)) out.sure = clampCount(raw.sure, Infinity);
  if (isRecord(raw.lm))
    for (const [k, m] of Object.entries(raw.lm)) {
      const hk = Number(k);
      if (!Number.isInteger(hk) || !isRecord(m) || !isNumber(m.n) || !isNumber(m.day)) continue;
      const pal = typeof m.pal === "string" ? m.pal : null;
      out.lm[hk] = { n: m.n, pal, day: m.day };
    }
  if (isRecord(raw.stamps) && isNumber(raw.stamps.w) && Array.isArray(raw.stamps.d)) {
    const days = raw.stamps.d.filter(isNumber);
    out.stamps = { w: raw.stamps.w, d: days.slice(0, WEEK_STAMPS) };
  }
  if (isNumber(raw.bonusDay)) out.bonusDay = raw.bonusDay;
  out.quest = readQuest(raw.quest);
  if (isRecord(raw.look)) out.look = readLook(raw.look);
  out.dressed = raw.dressed === true;
  return out;
}

/* ─── 내부 ─────────────────────────── */

function readQuest(q: unknown): QuestState | null {
  if (!isRecord(q) || !isNumber(q.day) || typeof q.k !== "string" || !isNumber(q.r)) return null;
  const type = q.type === "A" || q.type === "B" || q.type === "C" || q.type === "D" ? q.type : "";
  return {
    day: q.day,
    k: q.k,
    r: q.r,
    type,
    done: q.done === true,
    told: q.told === true,
    mid: q.mid === true,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function clampCount(n: number, max: number): number {
  const down = Math.floor(n);
  const whole = Math.max(0, down);
  return Math.min(max, whole);
}
