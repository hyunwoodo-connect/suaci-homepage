import type { StripCaption } from "./compose";

/** 입구의 `아까 찍은 네컷`이 다시 여는 마지막 띠 */
export interface LastStrip {
  blob: Blob;
  /** 사진 기둥만(완성 화면 띠·입구 카드) */
  photos: Blob;
  caption: StripCaption;
}

interface StoredStrip {
  /** 사파리 구버전이 IndexedDB에 Blob을 못 넣어 바이트로 둔다 */
  bytes: ArrayBuffer;
  photoBytes: ArrayBuffer;
  type: string;
  /** 예전 기록에만 있다(늘 null). 읽을 땐 보지 않는다 */
  serial?: string | null;
  eventLabel: string | null;
  takenAt: number;
}

// 운영 폰에 이미 있는 이름 — 바꾸면 마지막 띠를 잃는다
const DB_NAME = "take-four";
const STORE = "strips";
const KEY = "last";
/** 사생활 보호 모드 등에서 open이 답 없이 멈추는 경우가 있어 기다림에 한도를 둔다 */
const OPEN_TIMEOUT_MS = 2000;

/** 마지막 띠를 폰에 남긴다. 못 남겨도(사생활 보호 모드·용량) 조용히 넘어간다. */
export async function saveLast(blob: Blob, photos: Blob, caption: StripCaption): Promise<void> {
  try {
    const record: StoredStrip = {
      bytes: await blob.arrayBuffer(),
      photoBytes: await photos.arrayBuffer(),
      type: blob.type || "image/jpeg",
      serial: caption.serial,
      eventLabel: caption.eventLabel,
      takenAt: caption.date.getTime(),
    };
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record, KEY);
      await committed(tx);
    } finally {
      db.close();
    }
  } catch {}
}

/** 마지막 띠. 없거나 못 읽으면 null. */
export async function loadLast(): Promise<LastStrip | null> {
  try {
    const db = await openDb();
    let record: unknown;
    try {
      record = await request(db.transaction(STORE, "readonly").objectStore(STORE).get(KEY));
    } finally {
      db.close();
    }
    if (!isStoredStrip(record)) return null;
    return {
      blob: new Blob([record.bytes], { type: record.type }),
      photos: new Blob([record.photoBytes], { type: record.type }),
      caption: {
        serial: null,
        eventLabel: record.eventLabel,
        date: new Date(record.takenAt),
      },
    };
  } catch {
    return null;
  }
}

/* ─── 내부 ─────────────────────────── */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB 없음"));
      return;
    }
    let isLate = false;
    const timer = setTimeout(() => {
      isLate = true;
      reject(new Error("IndexedDB 응답 없음"));
    }, OPEN_TIMEOUT_MS);
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      clearTimeout(timer);
      // 한도가 지난 뒤에 열리면 아무도 안 쓰니 닫는다
      if (isLate) req.result.close();
      else resolve(req.result);
    };
    req.onerror = () => {
      clearTimeout(timer);
      reject(req.error);
    };
  });
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** put 성공만으론 디스크에 안 남았을 수 있다(용량 초과는 트랜잭션 abort로 온다) */
function committed(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB 저장 취소"));
    tx.onerror = () => reject(tx.error);
  });
}

function isStoredStrip(value: unknown): value is StoredStrip {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    // 다른 realm(테스트 jsdom)에서도 맞게 instanceof 대신 태그로 본다
    Object.prototype.toString.call(v.bytes) === "[object ArrayBuffer]" &&
    Object.prototype.toString.call(v.photoBytes) === "[object ArrayBuffer]" &&
    typeof v.type === "string" &&
    (v.eventLabel === null || typeof v.eventLabel === "string") &&
    typeof v.takenAt === "number"
  );
}
