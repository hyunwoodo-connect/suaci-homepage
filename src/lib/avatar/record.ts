import type { AvatarLook } from "./outfit";
import { readLook } from "./outfit";

// 한 사람의 아바타 기록: 차림(look)과, 아바타를 한 번 꾸몄는지(dressed).
// 아바타는 사이트의 것이라 놀이마다 따로 두지 않는다 — 어느 놀이에서 꾸며도 다른 놀이가 같은 아바타를 쓴다.
// 판(v)이 있어 모양이 바뀌면 옮겨 읽는다(칸을 더하기만 한 것은 판을 올리지 않는다 — 없던 칸은 빈 값으로 읽고, 모르는 칸은 버린다).
// 두는 곳(창구)은 이 기기(localStorage)다. 놀이는 이 창구만 안다 — 두는 곳을 계정으로 바꿔도 놀이는 그대로다.
// 읽기·쓰기는 Promise 다(이 기기에서는 곧바로 끝난다)

/** 저장 모양의 판 */
const RECORD_VERSION = 1;

/** 한 사람의 아바타 기록 */
export interface AvatarRecord {
  v: typeof RECORD_VERSION;
  /** 차림(한 번도 고르지 않았으면 null) */
  look: AvatarLook | null;
  /** 아바타를 한 번 꾸몄나(꾸미기 전에는 놀이보다 꾸미기가 먼저 뜬다) */
  dressed: boolean;
}

/** 아바타 기록을 두는 곳 */
export interface AvatarStore {
  /** 기록을 읽는다(없거나 깨졌으면 빈 기록) */
  load(): Promise<AvatarRecord>;
  /** 기록을 쓴다(실패해도 놀이는 그대로 간다) */
  save(record: AvatarRecord): Promise<void>;
}

/** 이 기기의 저장 칸 */
export const AVATAR_KEY = "suaci.avatar";

/** 빈 기록 */
export function emptyAvatarRecord(): AvatarRecord {
  return { v: RECORD_VERSION, look: null, dressed: false };
}

/** 저장해 둔 값을 읽는다: 판이 다르거나 깨진 칸은 빈 값으로(받은 값을 믿지 않는다) */
export function readAvatarRecord(raw: unknown): AvatarRecord {
  const out = emptyAvatarRecord();
  if (!isRecord(raw) || raw.v !== RECORD_VERSION) return out;
  if (isRecord(raw.look)) out.look = readLook(raw.look);
  out.dressed = raw.dressed === true;
  return out;
}

/** 아직 아무것도 없는 기록인가(차림도 없고 꾸민 적도 없다) */
export function isBlankRecord(record: AvatarRecord): boolean {
  return record.look === null && !record.dressed;
}

/** 이 기기에 둔다(사생활 모드·꽉 참으로 못 쓰면 이번만 기억한다) */
export class LocalAvatarStore implements AvatarStore {
  constructor(private readonly key: string = AVATAR_KEY) {}

  async load(): Promise<AvatarRecord> {
    try {
      const text = localStorage.getItem(this.key);
      if (!text) return emptyAvatarRecord();
      const raw: unknown = JSON.parse(text);
      return readAvatarRecord(raw);
    } catch {
      return emptyAvatarRecord();
    }
  }

  async save(record: AvatarRecord): Promise<void> {
    try {
      const text = JSON.stringify(record);
      localStorage.setItem(this.key, text);
    } catch {}
  }
}

/** 기억에만 둔다(시험·저장을 끈 때) */
export class MemoryAvatarStore implements AvatarStore {
  private record: AvatarRecord;

  constructor(initial?: AvatarRecord) {
    const start = initial ?? emptyAvatarRecord();
    this.record = structuredClone(start);
  }

  async load(): Promise<AvatarRecord> {
    return structuredClone(this.record);
  }

  async save(record: AvatarRecord): Promise<void> {
    this.record = structuredClone(record);
  }
}

/* ─── 내부 ─────────────────────────── */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
