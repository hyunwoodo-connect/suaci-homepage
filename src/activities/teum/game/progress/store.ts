import type { TeumSave } from "./save";
import { emptySave, readSave } from "./save";

// 기록을 두는 곳(창구): 이 기기(localStorage). 게임은 이 창구만 안다 — 두는 곳을 바꿔도 게임은 그대로다.
// 읽기·쓰기는 Promise 다(이 기기에서는 곧바로 끝난다)

/** 기록을 두는 곳 */
export interface SaveStore {
  /** 기록을 읽는다(없거나 깨졌으면 빈 기록) */
  load(): Promise<TeumSave>;
  /** 기록을 쓴다(실패해도 게임은 그대로 간다) */
  save(data: TeumSave): Promise<void>;
}

/** 이 기기의 저장 칸 */
export const SAVE_KEY = "suaci.teum.save";

/** 이 기기에 둔다(사생활 모드·꽉 참으로 못 쓰면 이번 판만 기억한다) */
export class LocalSaveStore implements SaveStore {
  constructor(private readonly key: string = SAVE_KEY) {}

  async load(): Promise<TeumSave> {
    try {
      const text = localStorage.getItem(this.key);
      if (!text) return emptySave();
      const raw: unknown = JSON.parse(text);
      return readSave(raw);
    } catch {
      return emptySave();
    }
  }

  async save(data: TeumSave): Promise<void> {
    try {
      const text = JSON.stringify(data);
      localStorage.setItem(this.key, text);
    } catch {}
  }
}

/** 기억에만 둔다(시험·저장을 끈 판) */
export class MemorySaveStore implements SaveStore {
  private data: TeumSave;

  constructor(initial?: TeumSave) {
    const start = initial ?? emptySave();
    this.data = structuredClone(start);
  }

  async load(): Promise<TeumSave> {
    return structuredClone(this.data);
  }

  async save(data: TeumSave): Promise<void> {
    this.data = structuredClone(data);
  }
}
