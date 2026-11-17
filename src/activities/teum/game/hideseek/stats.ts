import type { DisguiseKind, HelpKind, HideKind } from "./tuning";
import { HIDE, ROUND_BOXES } from "./tuning";

// 숨바꼭질 한 판에서 재는 것('보고 톡 치면 찾아지는가, 생물마다 다른 게 쓰이는가, 아닌 척을 알아채는가' —
// 그리고 처음 하는 사람 열에 일곱이 3분 안에 넷을 다 찾는가에 답할 숫자).
// 판이 끝나면 이 기기에 남기고, ?debug 면 끝 화면에 보인다.
// 시각은 판 시작(꼭꼭 숨어라)부터 잰 초. 기록 한 줄에 UTC·한국 시간과 판의 조건(묶음·둘러보기·화면)을 같이 둔다

/** 이 기기의 기록 칸(판마다 한 줄, 최근 것만) */
export const HIDE_LOG_KEY = "suaci.teum.hideseek";
/** 지금 규칙의 이름. 기록마다 같이 남겨, 규칙이 다른 판과 섞어 세지 않는다(규칙을 바꾸면 이름도 바꾼다) */
export const RULES = "01f";
/** 남기는 판 수 */
const KEEP = 30;
/** 한국 시간(UTC+9, ms) */
const KST_MS = 9 * 3600e3;
/** 끌기가 끝나고 이 안(ms)에 칙이 나가면 '끌려다가 나간 칙'으로 센다(hideseek.data.json 의 measure.dragTapMs) */
export const DRAG_TAP_MS = HIDE.measure.dragTapMs;

/** 찾은 길: 톡 쳐서 · 전설의 생물이 데려다줘서 */
export type FoundHow = "tap" | "legend";

/** 판이 끝난 까닭: 넷을 다 찾았다 · 해가 졌다 */
export type RoundEnd = "all" | "sunset";

/** 상자 하나를 찾은 기록 */
export interface FoundRecord {
  spot: string;
  kind: HideKind;
  /** 찾기 시작(가림이 걷힘)부터 초 */
  seconds: number;
  how: FoundHow;
  /** 아닌 척하던 상자면 그 법과, 찾을 수 있게 된 뒤 들통나기까지(초) */
  as: DisguiseKind | null;
  shownFor: number | null;
}

/** 한 판의 기록 */
export interface RoundRecord {
  /** 판 시작 시각(UTC ISO)과 한국 시간 */
  startedAtUtc: string;
  startedAtKst: string;
  /** 이 판의 규칙 이름(RULES) */
  rules: string;
  /** 숨는 자리 묶음(?hide)·둘러보기(?look=1)·화면 크기 */
  set: number;
  look: boolean;
  screen: string;
  /** 이 기기에서 몇째 판(1 부터)·어려움 단계(0~2)·숨은 자리 넷 */
  roundNo: number;
  level: number;
  spots: string[];
  /** 도움 없이 눌러 본 생물 수(요란한 반응) */
  pokes: number;
  /** 이 기기에서 처음 하는 판인가(남은 기록이 없었다) — 목표 '처음 하는 사람 열에 일곱'은 이 판들로 센다 */
  firstOnDevice: boolean;
  /** 첫 상자까지(초, 못 찾았으면 null) */
  firstFound: number | null;
  found: FoundRecord[];
  /** 넷을 다 찾기까지(찾기 시작부터 초, 다 못 찾았으면 null) — 3분(round.seconds) 안이면 이긴 판 */
  foundAll: number | null;
  /** 빈 데 칙 횟수·그중 재채기가 난 횟수·끌기 직후 0.2초 안의 칙 */
  chiks: number;
  sneezeChiks: number;
  dragChiks: number;
  /** 상자를 톡 쳐서 찾을 때 상자까지의 거리(m, 친 차례) · 너무 멀어 안 닿은 톡 수 */
  tapDistances: number[];
  tooFar: number;
  /** 생물을 써서 받은 도움(종류마다 횟수) */
  helps: Partial<Record<HelpKind, number>>;
  /** 움직이다 화면에 들킨 상자 수 */
  spotted: number;
  /** 전설의 생물: 나왔나 · 탔나 */
  legend: { appeared: boolean; ridden: boolean };
  /** 끝난 까닭(끝나지 않았으면 null) */
  endedBy: RoundEnd | null;
  /** 판 전체(꼭꼭 숨어라부터 마지막 상자를 열 때까지, 초 — 끝나지 않았으면 null) */
  total: number | null;
  /** '한 판 더'를 눌렀나 */
  again: boolean;
}

/** 기록을 두는 곳(시험이 바꾼다) */
export interface LogStore {
  read(): string | null;
  write(text: string): void;
}

/** 한 판의 기록을 모으고 남긴다 */
export class RoundLog {
  private rec: RoundRecord | null = null;
  private seekFrom = 0;
  private startedAt = 0;

  private readonly store: LogStore;

  /** store: 기록을 두는 곳(없으면 이 기기) */
  constructor(store?: LogStore) {
    this.store = store ?? localLogStore();
  }

  /** 판을 시작한다(now: 지금 시각 ms, t: 게임 시각 초) */
  begin(set: number, look: boolean, screen: string, now: number, t: number) {
    const at = new Date(now);
    const kstMs = now + KST_MS,
      kst = new Date(kstMs);
    this.startedAt = t;
    this.seekFrom = t;
    const before = readList(this.store);
    this.rec = {
      startedAtUtc: at.toISOString(),
      startedAtKst: kst.toISOString().replace("Z", "+09:00"),
      rules: RULES,
      set,
      look,
      screen,
      roundNo: 0,
      level: 0,
      spots: [],
      pokes: 0,
      firstOnDevice: before.length === 0,
      firstFound: null,
      found: [],
      foundAll: null,
      chiks: 0,
      sneezeChiks: 0,
      dragChiks: 0,
      tapDistances: [],
      tooFar: 0,
      helps: {},
      spotted: 0,
      legend: { appeared: false, ridden: false },
      endedBy: null,
      total: null,
      again: false,
    };
  }

  /** 판의 조건: 이 기기에서 몇째 판인가 · 어려움 단계 · 숨은 자리 넷 */
  roundInfo(roundNo: number, level: number, spots: readonly string[]) {
    const r = this.rec;
    if (!r) return;
    r.roundNo = roundNo;
    r.level = level;
    r.spots = [...spots];
  }

  /** 도움 없는 생물을 눌렀다(요란한 반응) */
  poked() {
    if (this.rec) this.rec.pokes++;
  }

  /** 가림이 걷혀 찾기 시작했다 */
  seekStarted(t: number) {
    this.seekFrom = t;
  }

  /** 칙: 재채기(또는 떨어짐)가 났나, 끌기 직후(ms)였나 */
  chik(sneezed: boolean, msAfterDrag: number) {
    const r = this.rec;
    if (!r) return;
    r.chiks++;
    if (sneezed) r.sneezeChiks++;
    if (msAfterDrag < DRAG_TAP_MS) r.dragChiks++;
  }

  /** 상자를 찾았다 */
  found(found: Omit<FoundRecord, "seconds">, t: number) {
    const r = this.rec;
    if (!r) return;
    const span = t - this.seekFrom,
      seconds = round1(span);
    r.found.push({ ...found, seconds });
    if (r.firstFound === null) r.firstFound = seconds;
    if (r.found.length === ROUND_BOXES) r.foundAll = seconds;
  }

  /** 상자를 톡 쳤다(닿는 거리 안 — 상자까지 dist m) */
  tapped(dist: number) {
    const d = round1(dist);
    this.rec?.tapDistances.push(d);
  }

  /** 너무 멀어 안 닿은 톡 */
  tooFar() {
    if (this.rec) this.rec.tooFar++;
  }

  /** 생물을 써서 도움을 받았다 */
  helped(kind: HelpKind) {
    const r = this.rec;
    if (!r) return;
    const before = r.helps[kind] ?? 0;
    r.helps[kind] = before + 1;
  }

  /** 움직이다 들킨 상자 수(판이 끝날 때) */
  spotted(n: number) {
    if (this.rec) this.rec.spotted = n;
  }

  /** 전설의 생물이 나왔다 */
  legendAppeared() {
    if (this.rec) this.rec.legend.appeared = true;
  }

  /** 전설의 생물을 탔다 */
  legendRidden() {
    if (this.rec) this.rec.legend.ridden = true;
  }

  /** 찾기가 끝났다(다 찾았거나 해가 졌다) — 여기서 한 번 남긴다(언박싱을 안 하고 닫아도 남게) */
  ended(by: RoundEnd) {
    const r = this.rec;
    if (!r) return;
    r.endedBy = by;
    this.save();
  }

  /** 마지막 상자까지 열었다(또는 열 상자 없이 판이 끝났다) — 기록을 남긴다 */
  finish(t: number) {
    const r = this.rec;
    if (!r) return;
    const span = t - this.startedAt;
    r.total = round1(span);
    this.save();
  }

  /** '한 판 더'를 눌렀다 — 기록을 고쳐 남긴다 */
  again() {
    const r = this.rec;
    if (!r) return;
    r.again = true;
    this.save();
  }

  /** 끝 화면에 보일 줄들 */
  lines(): string[] {
    const r = this.rec;
    if (!r) return [];
    const kindName = (k: HideKind) => KIND_NAME[k];
    const boxes = r.found.map((f, i) => {
      const disguise = f.as ? ` · ${f.as} ${round1(f.shownFor ?? 0)}초 만에 들통` : "";
      return `${i + 1}. ${f.spot}(${kindName(f.kind)}) ${f.seconds}초 · ${HOW_NAME[f.how]}${disguise}`;
    });
    const helps = Object.entries(r.helps)
      .map(([k, n]) => `${k} ${n}`)
      .join(", ");
    const end = r.endedBy ? END_NAME[r.endedBy] : "-",
      legend = r.legend.ridden ? "탔다" : r.legend.appeared ? "나왔다(안 탐)" : "안 나옴";
    const saved = readList(this.store),
      { played, won } = winShare(saved),
      helpless = noHelpShare(saved);
    return [
      `${r.roundNo}째 판 · 단계 ${r.level} · 자리 ${r.spots.join(", ")}`,
      `묶음 ${r.set}${r.look ? " · 둘러보기" : ""}${r.firstOnDevice ? " · 이 기기 첫 판" : ""} · 끝: ${end}`,
      `첫 상자 ${r.firstFound ?? "-"}초 · 넷 다 ${r.foundAll ?? "-"}초 · 판 전체 ${r.total ?? "-"}초`,
      ...boxes,
      `빈 데 칙 ${r.chiks}번(재채기 ${r.sneezeChiks}) · 끌다 나간 칙 ${r.dragChiks} · 너무 먼 톡 ${r.tooFar}`,
      `상자를 친 거리 ${r.tapDistances.join(", ") || "-"}m`,
      `생물 도움 ${helps || "없음"} · 그냥 눌러 본 생물 ${r.pokes} · 움직이다 들킴 ${r.spotted} · 전설 ${legend}`,
      `생물을 하나도 안 쓴 판 ${helpless.none}/${helpless.played}`,
      `한 판 더 ${r.again ? "누름" : "아직"}`,
      `이 기기 ${played}판(지금 규칙) 중 3분 안에 넷 다 찾은 판 ${won}`,
    ];
  }

  private save() {
    const r = this.rec;
    if (!r) return;
    const list = readList(this.store);
    // 같은 판(시작 시각)은 고쳐 쓴다
    const same = list.findIndex((x) => x.startedAtUtc === r.startedAtUtc);
    if (same >= 0) list[same] = r;
    else list.push(r);
    const kept = list.slice(-KEEP);
    const text = JSON.stringify(kept);
    this.store.write(text);
  }
}

/** 이 기기에 남은 판 기록(깨졌으면 빈 목록) */
export function readList(store: LogStore): RoundRecord[] {
  try {
    const text = store.read();
    if (!text) return [];
    const raw: unknown = JSON.parse(text);
    return Array.isArray(raw) ? (raw as RoundRecord[]) : [];
  } catch {
    return [];
  }
}

/** 지금 규칙으로 끝까지 간 판 수(played)와 그중 3분 안에 넷을 다 찾은 판 수(won) */
export function winShare(list: readonly RoundRecord[]): { played: number; won: number } {
  const ended = list.filter((r) => r.rules === RULES && r.endedBy),
    won = ended.filter((r) => r.endedBy === "all").length;
  return { played: ended.length, won };
}

/** 지금 규칙으로 끝난 판 가운데 생물 도움을 하나도 안 쓴 판 수 */
export function noHelpShare(list: readonly RoundRecord[]): { played: number; none: number } {
  const ended = list.filter((r) => r.rules === RULES && r.endedBy),
    none = ended.filter((r) => Object.keys(r.helps ?? {}).length === 0).length;
  return { played: ended.length, none };
}

/* ─── 내부 ─────────────────────────── */

const KIND_NAME: Readonly<Record<HideKind, string>> = {
  behind: "뒤",
  high: "높이",
  disguise: "아닌 척",
};

const HOW_NAME: Readonly<Record<FoundHow, string>> = {
  tap: "톡",
  legend: "전설이 데려다줌",
};

const END_NAME: Readonly<Record<RoundEnd, string>> = { all: "다 찾음", sunset: "해가 짐" };

function round1(x: number): number {
  const scaled = x * 10;
  return Math.round(scaled) / 10;
}

// 사생활 모드·꽉 참으로 못 쓰면 남기지 않고 지나간다
function localLogStore(): LogStore {
  return {
    read: () => {
      try {
        return localStorage.getItem(HIDE_LOG_KEY);
      } catch {
        return null;
      }
    },
    write: (text) => {
      try {
        localStorage.setItem(HIDE_LOG_KEY, text);
      } catch {}
    },
  };
}
