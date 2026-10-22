/** 입구의 `아까 찍은 네컷`이 다시 여는 마지막 카드 */
export interface LastStrip {
  /** 합성 카드(1080×1350 JPEG) */
  blob: Blob;
  takenAt: Date;
}

/** 지금 기록 모양의 표시. 이게 없는 기록은 카드 전의 띠(사진 기둥·회차 캡션)라 열지 않는다 */
const FORMAT = "card";

interface StoredStrip {
  format: typeof FORMAT;
  /** 사파리 구버전이 IndexedDB에 Blob을 못 넣어 바이트로 둔다 */
  bytes: ArrayBuffer;
  type: string;
  takenAt: number;
}

// 운영 폰에 이미 있는 이름 — 바꾸면 마지막 카드를 잃는다
const DB_NAME = "take-four";
const STORE = "strips";
const KEY = "last";
/** 사생활 보호 모드 등에서 open이 답 없이 멈추는 경우가 있어 기다림에 한도를 둔다 */
const OPEN_TIMEOUT_MS = 2000;

/** 마지막 카드를 폰에 남긴다(같은 키에 덮어쓴다). 못 남겨도(사생활 보호 모드·용량) 조용히 넘어간다. */
export async function saveLast(blob: Blob, takenAt: Date): Promise<void> {
  try {
    const record: StoredStrip = {
      format: FORMAT,
      bytes: await blob.arrayBuffer(),
      type: blob.type || "image/jpeg",
      takenAt: takenAt.getTime(),
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

/** 마지막 카드. 없거나, 못 읽거나, 카드 전 띠 기록이면 null. */
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
      takenAt: new Date(record.takenAt),
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

/**
 * 카드 기록만 연다. 운영 폰엔 카드 전의 띠 기록(`format` 없음, 세로 띠 + 사진 기둥)이 남아 있을 수 있다 —
 * 지금 화면(카드 비율·스토리·벽)에 맞지 않아 없는 것으로 친다. 다음에 찍으면 같은 키에 덮어쓴다.
 */
function isStoredStrip(value: unknown): value is StoredStrip {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.format === FORMAT &&
    // 다른 realm(테스트 jsdom)에서도 맞게 instanceof 대신 태그로 본다
    Object.prototype.toString.call(v.bytes) === "[object ArrayBuffer]" &&
    typeof v.type === "string" &&
    typeof v.takenAt === "number"
  );
}
