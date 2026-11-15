import type { QuestState, QuestType, TeumSave } from "./save";
import { BOX_MAX, WEEK_STAMPS } from "./save";

// 기록을 바꾸는 규칙(구조만 — 화면 없이 값만). 시제품 v78 스케치의 규칙을 그대로 옮겼다.
// 모두 받은 기록(save)을 그 자리에서 고친다. 무엇이 바뀌었는지는 돌려주고, 알림(collected·boxPicked…)은 부르는 쪽이 낸다

/** 상자 하나를 얻는다: 다섯 개까지 모으고, 그 뒤로는 꽝 없는 상자 수가 는다. 지금 안 연 상자 수 */
export function addBox(save: TeumSave): number {
  if (save.boxes < BOX_MAX) save.boxes++;
  else save.sure++;
  return save.boxes;
}

/** 처음 친해진 종을 보관함에 남긴다. 처음이면 상자 하나도 준다. 처음이었나 */
export function collect(save: TeumSave, kind: string, now: number): boolean {
  if (save.collected[kind]) return false;
  save.collected[kind] = { at: now };
  addBox(save);
  return true;
}

/** 한국 시간 날짜 → 주 번호(월요일에 바뀐다 — 1970-01-01 은 목요일) */
export function weekOf(day: number): number {
  const shifted = day + 3;
  const weeks = shifted / 7;
  return Math.floor(weeks);
}

/** 오늘 도장(축제 지역 랜드마크에서): 주가 바뀌었으면 새로, 오늘 처음이면 찍고 상자 하나, 여섯을 다 모으면 꽝 없는 상자 둘 */
export function stampToday(save: TeumSave, day: number): { stamped: boolean; count: number } {
  const week = weekOf(day);
  if (save.stamps.w !== week) save.stamps = { w: week, d: [] };
  if (save.stamps.d.includes(day)) return { stamped: false, count: save.stamps.d.length };
  save.stamps.d.push(day);
  addBox(save);
  const count = save.stamps.d.length;
  if (count === WEEK_STAMPS) save.sure += 2;
  return { stamped: true, count };
}

/** 하루 한 번 덤 상자(과자 언덕 랜드마크). 오늘 처음이었나 */
export function dailyBonus(save: TeumSave, day: number): boolean {
  if (save.bonusDay === day) return false;
  save.bonusDay = day;
  addBox(save);
  return true;
}

/** 랜드마크에 다녀간 것을 세고, 그때 할 말의 갈래를 고른다 */
export type VisitLine = "hello" | "local" | "guest" | "leftBehind" | "again";

/**
 * 지역 hk 의 랜드마크에 왔다: 몇 번째인지 세고(첫 방문은 인사), 데려온 친구(party)가 이 동네 애인지·다른 동네 애인지,
 * 지난번 친구를 두고 왔는지를 본다. homeOf: 종 → 사는 지역(모르면 undefined)
 */
export function visitLandmark(
  save: TeumSave,
  hk: number,
  day: number,
  homeOf: (kind: string) => number | undefined,
): { line: VisitLine; n: number } {
  const m = save.lm[hk] ?? { n: 0, pal: null, day };
  save.lm[hk] = m;
  m.n++;
  let line: VisitLine = "again";
  if (m.n === 1) line = "hello";
  else if (save.party.some((k) => homeOf(k) === hk)) line = "local";
  else if (save.party.some((k) => homeOf(k) !== undefined && homeOf(k) !== hk)) line = "guest";
  else if (m.pal && !save.party.length) line = "leftBehind";
  m.pal = save.party[0] ?? null;
  m.day = day;
  return { line, n: m.n };
}

/** 오늘의 부탁을 정하는 데 필요한 것 */
export interface QuestContext {
  day: number;
  festival: number;
  /** 지역 수 */
  regions: number;
  /** 데려올 수 있는 종과 그 종이 사는 지역(축제 지역·하늘·물가에 사는 종은 뺀 것) */
  homes: Readonly<Record<string, number>>;
  /** 지역 a 가 축제 지역과 가까운가(이웃 지역의 친구부터 부탁한다) */
  isNeighbour: (region: number) => boolean;
  /** 전설의 손님이 있나(없으면 D 대신 C) */
  hasLegends: boolean;
}

/** 오늘의 부탁(날이 바뀌면 새로): 아직 받지 않은 빈 부탁 */
export function questOfDay(save: TeumSave, ctx: QuestContext): QuestState {
  const q = save.quest;
  if (q && q.day === ctx.day) return q;
  const kinds = Object.keys(ctx.homes),
    others = regionsBut(ctx.regions, ctx.festival);
  const k = kinds[ctx.day % kinds.length] ?? "",
    r = others[ctx.day % others.length] ?? 0;
  const fresh: QuestState = { day: ctx.day, k, r, type: "", done: false, told: false, mid: false };
  save.quest = fresh;
  return fresh;
}

/**
 * 축제 지역 랜드마크가 부탁을 건넨다: 아직 못 만난 친구가 있으면 데려오기(A — 이웃 지역 친구부터),
 * 다 아는 사이면 고래 타기(B)·안부 전하기(C)·귀한 손님 만나기(D)가 날마다 돌아간다. 종류와 대상은 축제 지역과 다른 박자로 돈다
 */
export function tellQuest(save: TeumSave, ctx: QuestContext): QuestType {
  const q = questOfDay(save, ctx);
  const sixth = ctx.day / 6;
  const rot = ctx.day + Math.floor(sixth);
  const unmet = Object.keys(ctx.homes).filter((k) => !save.collected[k]);
  const near = unmet.filter((k) => ctx.isNeighbour(ctx.homes[k]));
  const pool = near.length ? near : unmet;
  const rotation: QuestType[] = ["B", "C", "D"];
  let type: QuestType = pool.length ? "A" : rotation[rot % 3];
  if (type === "D" && !ctx.hasLegends) type = "C";
  if (type === "A") q.k = pool[rot % pool.length];
  const others = regionsBut(ctx.regions, ctx.festival);
  q.r = others[rot % others.length];
  q.type = type;
  q.mid = false;
  q.told = true;
  return type;
}

/** 부탁을 끝낼 수 있나: 데려오기는 그 친구를 데리고 왔을 때, 나머지는 중간 일(탐·전함·만남)을 했을 때 */
export function questReady(save: TeumSave): boolean {
  const q = save.quest;
  if (!q || !q.told || q.done) return false;
  if ((q.type || "A") === "A") return save.party.includes(q.k);
  return q.mid;
}

/** 부탁을 끝낸다(상자 하나) */
export function finishQuest(save: TeumSave): void {
  if (!save.quest) return;
  save.quest.done = true;
  addBox(save);
}

/* ─── 내부 ─────────────────────────── */

function regionsBut(n: number, skip: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (i !== skip) out.push(i);
  return out;
}
