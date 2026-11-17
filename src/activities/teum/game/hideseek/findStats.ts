import type { Pattern } from "./findTuning";
import type { LogStore } from "./stats";
import { HIDE_LOG_KEY, localLogStore } from "./stats";
import { ROUND_BOXES } from "./tuning";

// 조각 02 '찾는 손맛'에서 재는 것(가까워지는 게 느껴지나, 누르기 전에 의심하나, 메롱 이사가 재밌나, 상자 하나에 1~2분쯤 걸리나에 답할 숫자):
// 상자마다 찾는 데 걸린 시간과 패턴·이사한 횟수·곁(10m 안)에 왔다가 못 찾고 나간 횟수, 판 전체의 꽝·너무 먼 누름·메롱·버섯 쓴 횟수.
// 앞 조각들과 같은 칸(suaci.teum.hideseek)에 규칙 이름을 달아 남긴다. 시각은 UTC 와 한국 시간을 같이 둔다

/** 지금 규칙의 이름(기록마다 남겨 규칙이 다른 판과 섞어 세지 않는다) */
export const FIND_RULES = "02";
/** 남기는 판 수 · 한국 시간(UTC+9, ms) */
const KEEP = 30,
  KST_MS = 9 * 3600e3;

/** 상자 하나를 찾은 기록 */
export interface FoundBox {
  /** 찾은 물건·패턴 */
  prop: string;
  pattern: Pattern;
  /** 찾기 시작부터(초) · 앞 상자를 찾은 뒤부터(초 — 이 상자 하나에 걸린 시간) */
  seconds: number;
  took: number;
  /** 이 상자가 이사한 횟수 · 내가 곁(candidate.tapReach 안)에 왔다가 못 찾고 나간 횟수 */
  moves: number;
  nearMisses: number;
}

/** 한 판의 기록 */
export interface FindRecord {
  startedAtUtc: string;
  startedAtKst: string;
  rules: string;
  screen: string;
  /** 이 기기에서 몇째 판(1 부터) · 이 기기에서 처음 하는 판인가 */
  roundNo: number;
  firstOnDevice: boolean;
  /** 숨은 패턴 넷과 물건 넷(숨긴 차례) */
  patterns: Pattern[];
  props: string[];
  found: FoundBox[];
  firstFound: number | null;
  foundAll: number | null;
  /** 꽝을 누른 횟수 · 너무 멀어(또는 밑에서 눌러) 안 닿은 누름 · 메롱 횟수 · 이사 횟수 · 곁에 왔다가 못 찾고 나간 횟수(모든 상자) · 버섯을 쓴 횟수 */
  wrongTaps: number;
  farTaps: number;
  taunts: number;
  moves: number;
  nearMisses: number;
  mushrooms: number;
  /** 넷을 다 찾았나 · 판 전체(초) · '한 판 더'를 눌렀나 */
  isAllFound: boolean;
  total: number | null;
  again: boolean;
}

/** 한 판의 기록을 모으고 남긴다 */
export class FindLog {
  private rec: FindRecord | null = null;
  private seekFrom = 0;
  private startedAt = 0;
  private lastFoundAt = 0;
  private readonly store: LogStore;

  /** store: 기록을 두는 곳(없으면 이 기기) */
  constructor(store?: LogStore) {
    this.store = store ?? localLogStore();
  }

  /** 판을 시작한다(now: 지금 시각 ms, t: 게임 시각 초) */
  begin(roundNo: number, screen: string, now: number, t: number) {
    const at = new Date(now),
      kstMs = now + KST_MS,
      kst = new Date(kstMs),
      before = readFindList(this.store);
    this.startedAt = t;
    this.seekFrom = t;
    this.lastFoundAt = t;
    this.rec = {
      startedAtUtc: at.toISOString(),
      startedAtKst: kst.toISOString().replace("Z", "+09:00"),
      rules: FIND_RULES,
      screen,
      roundNo,
      firstOnDevice: before.length === 0,
      patterns: [],
      props: [],
      found: [],
      firstFound: null,
      foundAll: null,
      wrongTaps: 0,
      farTaps: 0,
      taunts: 0,
      moves: 0,
      nearMisses: 0,
      mushrooms: 0,
      isAllFound: false,
      total: null,
      again: false,
    };
  }

  /** 숨은 패턴과 물건(숨긴 차례) */
  dealt(patterns: readonly Pattern[], props: readonly string[]) {
    const r = this.rec;
    if (!r) return;
    r.patterns = [...patterns];
    r.props = [...props];
  }

  /** 눈을 떠 찾기 시작했다 */
  seekStarted(t: number) {
    this.seekFrom = t;
    this.lastFoundAt = t;
  }

  /** 상자를 찾았다(그 물건·패턴, 이 상자가 이사한 횟수와 곁에 왔다가 놓친 횟수) */
  found(box: Omit<FoundBox, "seconds" | "took">, t: number) {
    const r = this.rec;
    if (!r) return;
    const sinceStart = t - this.seekFrom,
      sinceLast = t - this.lastFoundAt,
      seconds = round1(sinceStart),
      took = round1(sinceLast);
    this.lastFoundAt = t;
    r.found.push({ ...box, seconds, took });
    if (r.firstFound === null) r.firstFound = seconds;
    if (r.found.length === ROUND_BOXES) {
      r.foundAll = seconds;
      r.isAllFound = true;
    }
    this.save();
  }

  /** 꽝을 눌렀다 */
  wrong() {
    if (this.rec) this.rec.wrongTaps++;
  }

  /** 너무 멀어(또는 높은 곳을 밑에서 눌러) 닿지 않았다 */
  far() {
    if (this.rec) this.rec.farTaps++;
  }

  /** 근처 상자가 메롱 했다(moved: 이사까지 갔나) */
  taunted(moved: boolean) {
    const r = this.rec;
    if (!r) return;
    r.taunts++;
    if (moved) r.moves++;
  }

  /** 상자 곁에 왔다가 못 찾고 나갔다 */
  nearMiss() {
    if (this.rec) this.rec.nearMisses++;
  }

  /** 버섯을 쓴 횟수(판이 끝날 때) */
  mushrooms(n: number) {
    if (this.rec) this.rec.mushrooms = n;
  }

  /** 마지막 상자까지 열었다 — 기록을 남긴다 */
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

  /** 끝 화면에 보일 줄들(?debug) */
  lines(): string[] {
    const r = this.rec;
    if (!r) return [];
    const boxes = r.found.map(
      (f, i) =>
        `${i + 1}. ${f.pattern} ${f.prop} — ${f.took}초(처음부터 ${f.seconds}초) · 이사 ${f.moves} · 곁을 지나침 ${f.nearMisses}`,
    );
    const played = readFindList(this.store).filter((x) => x.isAllFound).length;
    return [
      `${r.roundNo}째 판${r.firstOnDevice ? " · 이 기기 첫 판" : ""} · 패턴 ${r.patterns.join("")} · ${r.props.join(", ")}`,
      `첫 상자 ${r.firstFound ?? "-"}초 · 넷 다 ${r.foundAll ?? "-"}초 · 판 전체 ${r.total ?? "-"}초`,
      ...boxes,
      `꽝 ${r.wrongTaps} · 안 닿은 누름 ${r.farTaps} · 메롱 ${r.taunts}(이사 ${r.moves}) · 곁을 지나침 ${r.nearMisses} · 버섯 ${r.mushrooms}`,
      `한 판 더 ${r.again ? "누름" : "아직"} · 이 기기에서 넷을 다 찾은 판(지금 규칙) ${played}`,
    ];
  }

  private save() {
    const r = this.rec;
    if (!r) return;
    const all = readAll(this.store),
      same = all.findIndex((x) => isRecord(x) && x.startedAtUtc === r.startedAtUtc);
    if (same >= 0) all[same] = r;
    else all.push(r);
    const kept = all.slice(-KEEP),
      text = JSON.stringify(kept);
    this.store.write(text);
  }
}

/** 이 기기에 남은 판 기록 가운데 지금 규칙의 것 */
export function readFindList(store: LogStore): FindRecord[] {
  return readAll(store).filter(
    (x): x is FindRecord => isRecord(x) && x.rules === FIND_RULES && Array.isArray(x.found),
  );
}

/** 기록 칸 이름(앞 조각들과 같은 칸) */
export const FIND_LOG_KEY = HIDE_LOG_KEY;

/* ─── 내부 ─────────────────────────── */

// 칸에 남은 것 모두(앞 조각의 기록도 섞여 있다 — 지우지 않고 같이 둔다). 깨졌으면 빈 목록
function readAll(store: LogStore): unknown[] {
  try {
    const text = store.read();
    if (!text) return [];
    const raw: unknown = JSON.parse(text);
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

function round1(x: number): number {
  const scaled = x * 10;
  return Math.round(scaled) / 10;
}
