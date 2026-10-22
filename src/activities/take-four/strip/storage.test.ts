import { Blob as NodeBlob } from "node:buffer";
import { describe, it, expect, vi, afterEach } from "vitest";

import { stripCaption } from "./compose";
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
  it("남긴 띠 → 같은 바이트·캡션으로 돌아온다", async () => {
    // jsdom Blob엔 arrayBuffer()가 없어 Node Blob으로 바꾼다
    vi.stubGlobal("Blob", NodeBlob);
    vi.stubGlobal("indexedDB", fakeIndexedDb());
    await saveLast(
      new Blob(["strip-bytes"], { type: "image/jpeg" }),
      new Blob(["photo-bytes"], { type: "image/jpeg" }),
      stripCaption("live", TAKEN, "No.01"),
    );
    const last = await loadLast();
    expect(last).not.toBeNull();
    expect(await last?.blob.text()).toBe("strip-bytes");
    expect(last?.blob.type).toBe("image/jpeg");
    expect(await last?.photos.text()).toBe("photo-bytes");
    expect(last?.caption).toEqual({ serial: null, eventLabel: "No.01", date: TAKEN });
  });

  it("모양이 다른 기록(serial이 숫자) → null", async () => {
    const fake = fakeIndexedDb();
    fake.rows.set("last", {
      bytes: new ArrayBuffer(1),
      photoBytes: new ArrayBuffer(1),
      type: "image/jpeg",
      serial: 347,
      eventLabel: null,
      takenAt: 0,
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
    await expect(
      saveLast(new Blob(["x"]), new Blob(["p"]), stripCaption("live", TAKEN, "No.01")),
    ).resolves.toBeUndefined();
    expect(db.close).toHaveBeenCalled();
    await expect(loadLast()).resolves.toBeNull();
  });

  it("IndexedDB 없음 → 저장은 조용히, 읽기는 null", async () => {
    vi.stubGlobal("indexedDB", undefined);
    await expect(
      saveLast(new Blob(["x"]), new Blob(["p"]), stripCaption("live", TAKEN, "No.01")),
    ).resolves.toBeUndefined();
    await expect(loadLast()).resolves.toBeNull();
  });

  it("사생활 보호 모드(open이 바로 throw) → 저장은 조용히, 읽기는 null", async () => {
    vi.stubGlobal("indexedDB", {
      open: () => {
        throw new DOMException("막힘", "SecurityError");
      },
    });
    await expect(
      saveLast(new Blob(["x"]), new Blob(["p"]), stripCaption("live", TAKEN, "No.01")),
    ).resolves.toBeUndefined();
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
