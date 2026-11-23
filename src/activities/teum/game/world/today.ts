import type { Frame, Thing } from "../core/frame";
import type { GameEvents } from "../events";

// 오늘: 한국 시간의 날짜와 그날의 축제 지역(날짜 % 지역 수). 판 도중에 자정을 넘기면 새 날이 오고 dayChanged 를 알린다 —
// 날을 보는 것(축제 지역 생물, 랜드마크의 날 기억)은 불러온 때의 날이 아니라 늘 이 값을 본다

/** 한국 시간(UTC+9) */
const KST_MS = 9 * 3600e3;
const DAY_MS = 86400e3;
/** 날이 바뀌었는지 보는 간격(초) */
const CHECK_EVERY = 1;

/** 한국 시간 날짜 번호(1970-01-01 이 0) */
export function kstDay(ms: number): number {
  const shifted = ms + KST_MS;
  const days = shifted / DAY_MS;
  return Math.floor(days);
}

/**
 * 그날의 축제 지역: 축제를 열 수 있는 마을(towns — 뭍의 마을, 지역 차례)을 날마다 돌아간다.
 * fixed 가 있으면(개발 ?fest=) 날과 상관없이 그 차례의 마을
 */
export function festivalOf(day: number, towns: readonly number[], fixed: number | null): number {
  const n = fixed ?? day;
  const r = n % towns.length;
  const turn = (r + towns.length) % towns.length;
  return towns[turn];
}

/** 오늘 */
export class Today implements Thing {
  /** 한국 시간 날짜 번호 */
  day: number;
  /** 오늘의 축제 지역(지역 차례) */
  festival: number;
  private wait = CHECK_EVERY;

  /** towns: 축제를 열 수 있는 마을(지역 차례), fixed: 개발에서 고정한 축제 지역(?fest), now: 시계(시험이 바꾼다) */
  constructor(
    private readonly events: GameEvents,
    private readonly towns: readonly number[],
    private readonly fixed: number | null,
    private readonly now: () => number = Date.now,
  ) {
    const ms = now();
    this.day = kstDay(ms);
    this.festival = festivalOf(this.day, towns, fixed);
  }

  /** 1초마다 날짜를 다시 보고, 바뀌었으면 알린다 */
  update(f: Frame) {
    this.wait -= f.dt;
    if (this.wait > 0) return;
    this.wait = CHECK_EVERY;
    const ms = this.now();
    const day = kstDay(ms);
    if (day === this.day) return;
    this.day = day;
    this.festival = festivalOf(day, this.towns, this.fixed);
    this.events.emit("dayChanged", { day, festival: this.festival });
  }

  dispose() {}
}
