import type { HideKind, ItemKind } from "./tuning";
import { HIDE } from "./tuning";

// 숨바꼭질 한 판에서 재는 것(조각 01b 의 질문 '손에 쥔 수단이 분명해지면 찾는 맛이 사는가'에 답할 숫자). 판이 끝나면 이 기기에 남기고, ?debug 면 끝 화면에 보인다.
// 시각은 판 시작(꼭꼭 숨어라)부터 잰 초. 기록 한 줄에 UTC·한국 시간과 판의 조건(묶음·둘러보기·화면)을 같이 둔다

/** 이 기기의 기록 칸(판마다 한 줄, 최근 것만) */
export const HIDE_LOG_KEY = "suaci.teum.hideseek";
/** 남기는 판 수 */
const KEEP = 30;
/** 한국 시간(UTC+9, ms) */
const KST_MS = 9 * 3600e3;
/** 끌기가 끝나고 이 안(ms)에 칙이 나가면 '끌려다가 나간 칙'으로 센다(hideseek.data.json 의 measure.dragTapMs) */
export const DRAG_TAP_MS = HIDE.measure.dragTapMs;

/** 찾은 길: 닿아서 · 칙으로 떨어뜨려서 · 전설의 생물이 데려다줘서 */
export type FoundHow = "touch" | "drop" | "legend";

/** 판이 끝난 까닭: 넷을 다 찾았다 · 해가 졌다 */
export type RoundEnd = "all" | "sunset";

/** 상자 하나를 찾은 기록 */
export interface FoundRecord {
  spot: string;
  kind: HideKind;
  /** 찾기 시작(가림이 걷힘)부터 초 */
  seconds: number;
  how: FoundHow;
  /** 눈으로만 찾았나(그 상자가 재채기·폴짝·일러바침의 대상이 된 적 없이 닿았다) */
  eyes: boolean;
  /** '못 찾겠다'로 드러난 상자였나 */
  gaveUp: boolean;
}

/** 한 판의 기록 */
export interface RoundRecord {
  /** 판 시작 시각(UTC ISO)과 한국 시간 */
  startedAtUtc: string;
  startedAtKst: string;
  /** 숨는 자리 묶음(?hide)·둘러보기(?look=1)·화면 크기 */
  set: number;
  look: boolean;
  screen: string;
  /** 첫 상자까지(초, 못 찾았으면 null) */
  firstFound: number | null;
  found: FoundRecord[];
  /** 눈으로만 찾은 수 */
  eyesFound: number;
  /** 칙 횟수·그중 재채기(또는 떨어짐)가 난 횟수·끌기 직후 0.2초 안의 칙 */
  chiks: number;
  sneezeChiks: number;
  dragChiks: number;
  /** 아이템을 쓴 횟수(종류별) */
  items: Record<ItemKind, number>;
  /** 전설의 생물: 나왔나 · 탔나 */
  legend: { appeared: boolean; ridden: boolean };
  /** '못 찾겠다'를 누른 횟수 */
  giveUps: number;
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
    this.rec = {
      startedAtUtc: at.toISOString(),
      startedAtKst: kst.toISOString().replace("Z", "+09:00"),
      set,
      look,
      screen,
      firstFound: null,
      found: [],
      eyesFound: 0,
      chiks: 0,
      sneezeChiks: 0,
      dragChiks: 0,
      items: { tattle: 0, wake: 0 },
      legend: { appeared: false, ridden: false },
      giveUps: 0,
      endedBy: null,
      total: null,
      again: false,
    };
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
    if (found.eyes) r.eyesFound++;
  }

  /** 아이템을 썼다 */
  itemUsed(kind: ItemKind) {
    if (this.rec) this.rec.items[kind]++;
  }

  /** 전설의 생물이 나왔다 */
  legendAppeared() {
    if (this.rec) this.rec.legend.appeared = true;
  }

  /** 전설의 생물을 탔다 */
  legendRidden() {
    if (this.rec) this.rec.legend.ridden = true;
  }

  /** '못 찾겠다'를 눌렀다 */
  gaveUp() {
    if (this.rec) this.rec.giveUps++;
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
    const kindName = (k: HideKind) => (k === "high" ? "높이" : "뒤");
    const boxes = r.found.map((f, i) => {
      const how = HOW_NAME[f.how],
        eyes = f.eyes ? " · 눈으로" : "",
        gaveUp = f.gaveUp ? " · 못 찾겠다" : "";
      return `${i + 1}. ${f.spot}(${kindName(f.kind)}) ${f.seconds}초 · ${how}${eyes}${gaveUp}`;
    });
    const end = r.endedBy ? END_NAME[r.endedBy] : "-",
      legend = r.legend.ridden ? "탔다" : r.legend.appeared ? "나왔다(안 탐)" : "안 나옴";
    return [
      `묶음 ${r.set}${r.look ? " · 둘러보기" : ""} · 끝: ${end}`,
      `첫 상자 ${r.firstFound ?? "-"}초 · 판 전체 ${r.total ?? "-"}초 · 눈으로 ${r.eyesFound}`,
      ...boxes,
      `칙 ${r.chiks}번(재채기 ${r.sneezeChiks}) · 끌다 나간 칙 ${r.dragChiks}`,
      `일러바치기 ${r.items.tattle} · 깨우기 ${r.items.wake} · 전설 ${legend}`,
      `못 찾겠다 ${r.giveUps} · 한 판 더 ${r.again ? "누름" : "아직"}`,
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

/* ─── 내부 ─────────────────────────── */

const HOW_NAME: Readonly<Record<FoundHow, string>> = {
  touch: "닿아서",
  drop: "칙으로 떨어뜨림",
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
