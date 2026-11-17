import type { HelpTag } from "./tuning";

// 이 기기에서의 숨바꼭질 기억: 지금까지 한 판 수(어려움 단계를 정한다 — '한 판 더'로 이어 하든 다음 날 하든 이어진다)와
// 생물 도움을 종류마다 몇 번 썼나(세 번 쓴 종류는 누른 뒤의 한 줄 설명을 더 띄우지 않는다).
// 사생활 모드·꽉 참으로 못 쓰면 이번 방문 동안만 기억한다

/** 기기에 남기는 자리 */
export const HIDE_PROGRESS_KEY = "suaci.teum.hideseek.progress";

/** 남기는 곳(시험은 갈아 끼운다) */
export interface ProgressStore {
  read(): string | null;
  write(text: string): void;
}

/** 남긴 것 */
interface Saved {
  rounds: number;
  help: Partial<Record<HelpTag, number>>;
}

/** 이 기기에서의 숨바꼭질 기억 */
export class HideProgress {
  private saved: Saved;

  /** store: 남기는 곳(없으면 이 기기) */
  constructor(store?: ProgressStore) {
    this.store = store ?? localProgressStore();
    const text = this.store.read();
    this.saved = readSaved(text);
  }

  private readonly store: ProgressStore;

  /** 지금까지 찾기까지 간 판 수(0 이면 이 기기에서 처음) */
  get rounds(): number {
    return this.saved.rounds;
  }

  /** 판 하나를 센다(찾기가 시작될 때) */
  countRound() {
    this.saved.rounds++;
    this.save();
  }

  /** kind 도움(전설 포함)을 쓴 횟수 */
  helpUses(kind: HelpTag): number {
    return this.saved.help[kind] ?? 0;
  }

  /** kind 도움을 한 번 썼다 */
  useHelp(kind: HelpTag) {
    const was = this.helpUses(kind);
    this.saved.help[kind] = was + 1;
    this.save();
  }

  private save() {
    const text = JSON.stringify(this.saved);
    this.store.write(text);
  }
}

/* ─── 내부 ─────────────────────────── */

// 남긴 글을 읽는다(모양이 다르면 처음부터)
function readSaved(text: string | null): Saved {
  const empty: Saved = { rounds: 0, help: {} };
  if (!text) return empty;
  try {
    const raw = JSON.parse(text) as Partial<Saved>;
    const rounds = Number.isInteger(raw.rounds) && (raw.rounds ?? 0) >= 0 ? (raw.rounds ?? 0) : 0;
    const help = raw.help && typeof raw.help === "object" ? raw.help : {};
    return { rounds, help };
  } catch {
    return empty;
  }
}

// 사생활 모드·꽉 참으로 못 쓰면 남기지 않고 지나간다
function localProgressStore(): ProgressStore {
  return {
    read: () => {
      try {
        return localStorage.getItem(HIDE_PROGRESS_KEY);
      } catch {
        return null;
      }
    },
    write: (text) => {
      try {
        localStorage.setItem(HIDE_PROGRESS_KEY, text);
      } catch {}
    },
  };
}
