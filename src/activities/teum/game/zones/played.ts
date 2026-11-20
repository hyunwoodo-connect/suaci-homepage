// 존 미니게임을 했나(이 기기에 기억한다): 빛 기둥은 그 존의 게임을 안 했을 때만 서고, 미니맵 랜드마크 점은 안 했을 때만 깜빡인다.
// 판이 끝나면 미니게임 입구가 적는다. 읽고 쓸 수 없는 기기(사생활 보호 창 등)는 이번 판 동안만 기억한다

/** 했는지 적어 두는 칸 */
const PLAYED_KEY = "suaci.teum.played";

/** 존 미니게임을 한 기록 */
export class PlayedGames {
  private readonly done: Set<string>;
  private readonly listeners: ((zone: string) => void)[] = [];

  constructor() {
    const list = readPlayed();
    this.done = new Set(list);
  }

  /** 이 존의 게임을 했나 */
  has(zone: string): boolean {
    return this.done.has(zone);
  }

  /** 이 존의 게임을 했다(기억하고 알린다) */
  mark(zone: string) {
    if (this.done.has(zone)) return;
    this.done.add(zone);
    writePlayed([...this.done]);
    for (const fn of this.listeners) fn(zone);
  }

  /** 했다고 적힐 때 */
  onMark(fn: (zone: string) => void) {
    this.listeners.push(fn);
  }
}

/* ─── 내부 ─────────────────────────── */

function readPlayed(): string[] {
  try {
    const raw = localStorage.getItem(PLAYED_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writePlayed(list: string[]) {
  try {
    const text = JSON.stringify(list);
    localStorage.setItem(PLAYED_KEY, text);
  } catch {}
}
