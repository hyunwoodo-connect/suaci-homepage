import { Blob as NodeBlob } from "node:buffer";
import { describe, it, expect, vi, afterEach } from "vitest";

import { loadLast, saveLast } from "./storage";

const TAKEN = new Date("2026-10-22T05:00:00Z");

/** 요청 하나: 다음 틱에 onsuccess(또는 onerror) */
function fakeRequest<T>(result: () => T, error?: DOMException) {
  const req: {
    result?: T;
    error: DOMException | null;
    onsuccess?: () => void;
    onerror?: () => void;
    onupgradeneeded?: () => void;
  } = { error: error ?? null };
  setTimeout(() => {
    if (error) req.onerror?.();
    else {
      req.result = result();
      req.onsuccess?.();
    }
  });
  return req;
}

/** 키 하나짜리 저장소만 흉내 낸 IndexedDB */
function fakeIndexedDb() {
  const rows = new Map<string, unknown>();
  const db = {
    transaction: () => {
      const tx: { oncomplete?: () => void; onabort?: () => void; objectStore: () => unknown } = {
        objectStore: () => ({
          put: (value: unknown, key: string) =>
            fakeRequest(() => {
              rows.set(key, value);
              // 요청 성공 뒤에 커밋
              setTimeout(() => tx.oncomplete?.());
              return key;
            }),
          get: (key: string) => fakeRequest(() => rows.get(key)),
        }),
      };
      return tx;
    },
    close: vi.fn(),
  };
  return {
    rows,
    open: vi.fn(() => {
      const req = fakeRequest(() => db);
      return req;
    }),
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("saveLast · loadLast", () => {
  it("남긴 카드 → 같은 바이트·찍은 시각으로 돌아오고, 기록엔 카드 표시가 있다", async () => {
    // jsdom Blob엔 arrayBuffer()가 없어 Node Blob으로 바꾼다
    vi.stubGlobal("Blob", NodeBlob);
    const fake = fakeIndexedDb();
    vi.stubGlobal("indexedDB", fake);
    await saveLast(new Blob(["card-bytes"], { type: "image/jpeg" }), TAKEN);
    expect(fake.rows.get("last")).toMatchObject({ format: "card" });
    const last = await loadLast();
    expect(await last?.blob.text()).toBe("card-bytes");
    expect(last?.blob.type).toBe("image/jpeg");
    expect(last?.takenAt).toEqual(TAKEN);
  });

  it("모양이 다른 기록(takenAt이 글자) → null", async () => {
    const fake = fakeIndexedDb();
    fake.rows.set("last", {
      format: "card",
      bytes: new ArrayBuffer(1),
      type: "image/jpeg",
      takenAt: "0",
    });
    vi.stubGlobal("indexedDB", fake);
    await expect(loadLast()).resolves.toBeNull();
  });

  it.each([
    ["serial 없는 띠 기록", {}],
    ["더 예전 띠 기록(serial: null)", { serial: null }],
  ])("카드 전 %s(운영 폰에 남은 것) → 던지지 않고 null", async (_, extra) => {
    const fake = fakeIndexedDb();
    fake.rows.set("last", {
      bytes: new ArrayBuffer(1),
      photoBytes: new ArrayBuffer(1),
      type: "image/jpeg",
      eventLabel: "No.01",
      takenAt: 0,
      ...extra,
    });
    vi.stubGlobal("indexedDB", fake);
    await expect(loadLast()).resolves.toBeNull();
  });

  it("남긴 게 없음 → null", async () => {
    vi.stubGlobal("indexedDB", fakeIndexedDb());
    await expect(loadLast()).resolves.toBeNull();
  });

  it("트랜잭션 abort(용량 초과 등) → 조용히 넘어가고 남지 않는다", async () => {
    vi.stubGlobal("Blob", NodeBlob);
    const rows = new Map<string, unknown>();
    const db = {
      transaction: () => {
        const tx: { onabort?: () => void; error: DOMException; objectStore: () => unknown } = {
          error: new DOMException("가득 참", "QuotaExceededError"),
          objectStore: () => ({
            put: () => {
              setTimeout(() => tx.onabort?.());
              return {};
            },
            get: (key: string) => fakeRequest(() => rows.get(key)),
          }),
        };
        return tx;
      },
      close: vi.fn(),
    };
    vi.stubGlobal("indexedDB", { open: () => fakeRequest(() => db) });
    await expect(saveLast(new Blob(["x"]), TAKEN)).resolves.toBeUndefined();
    expect(db.close).toHaveBeenCalled();
    await expect(loadLast()).resolves.toBeNull();
  });

  it("IndexedDB 없음 → 저장은 조용히, 읽기는 null", async () => {
    vi.stubGlobal("indexedDB", undefined);
    await expect(saveLast(new Blob(["x"]), TAKEN)).resolves.toBeUndefined();
    await expect(loadLast()).resolves.toBeNull();
  });

  it("사생활 보호 모드(open이 바로 throw) → 저장은 조용히, 읽기는 null", async () => {
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new DOMException("막힘", "SecurityError");
      },
    });
    await expect(saveLast(new Blob(["x"]), TAKEN)).resolves.toBeUndefined();
    await expect(loadLast()).resolves.toBeNull();
  });

  it("open이 답이 없음 → 2초 뒤 null", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("indexedDB", { open: () => ({}) });
    const last = loadLast();
    await vi.advanceTimersByTimeAsync(2000);
    await expect(last).resolves.toBeNull();
  });
});
