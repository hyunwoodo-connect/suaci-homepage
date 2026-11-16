import { describe, expect, it } from "vitest";

import type { LogStore } from "./stats";
import { readList, RoundLog } from "./stats";

function memoryStore(initial: string | null = null): LogStore & { text: string | null } {
  const store = {
    text: initial,
    read: () => store.text,
    write: (t: string) => {
      store.text = t;
    },
  };
  return store;
}

const NOW = Date.UTC(2026, 10, 16, 3, 0, 0);

describe("RoundLog", () => {
  it("칙 → 횟수, 재채기가 난 칙, 끌기 직후 0.2초 안의 칙을 따로 센다", () => {
    const store = memoryStore();
    const log = new RoundLog(store);
    log.begin(1, false, "390x844", NOW, 0);
    log.chik(true, 5000);
    log.chik(false, 150);
    log.chik(false, 250);
    log.finish(1);
    expect(readList(store)[0]).toMatchObject({ chiks: 3, sneezeChiks: 1, dragChiks: 1 });
  });

  it("찾기 → 가림이 걷힌 때부터 초를 재고, 첫 상자 시간과 눈으로 찾은 수를 남긴다", () => {
    const store = memoryStore();
    const log = new RoundLog(store);
    log.begin(2, true, "390x844", NOW, 10);
    log.seekStarted(15);
    log.found({ spot: "wishtree", kind: "behind", how: "touch", eyes: true, gaveUp: false }, 27.34);
    log.found({ spot: "pad-n-top", kind: "high", how: "drop", eyes: false, gaveUp: true }, 80);
    log.finish(90);
    const [saved] = readList(store);
    expect(saved.firstFound).toBe(12.3);
    expect(saved.found.map((f) => f.seconds)).toEqual([12.3, 65]);
    expect(saved.eyesFound).toBe(1);
    expect(saved.found[1]).toMatchObject({ how: "drop", gaveUp: true });
  });

  it("아이템·전설·못 찾겠다·끝난 까닭 → 종류별 횟수와 함께 남긴다", () => {
    const store = memoryStore();
    const log = new RoundLog(store);
    log.begin(1, false, "390x844", NOW, 0);
    log.itemUsed("tattle");
    log.itemUsed("wake");
    log.itemUsed("wake");
    log.legendAppeared();
    log.gaveUp();
    log.ended("sunset");
    const [saved] = readList(store);
    expect(saved.items).toEqual({ tattle: 1, wake: 2 });
    expect(saved.legend).toEqual({ appeared: true, ridden: false });
    expect(saved.giveUps).toBe(1);
    expect(saved.endedBy).toBe("sunset");
    expect(saved.total).toBeNull();
  });

  it("다 열면 → 판 전체 시간과 UTC·한국 시간을 담아 기기에 남긴다", () => {
    const store = memoryStore();
    const log = new RoundLog(store);
    log.begin(1, false, "390x844", NOW, 10);
    log.finish(130);
    const [saved] = readList(store);
    expect(saved.total).toBe(120);
    expect(saved.startedAtUtc).toBe("2026-11-16T03:00:00.000Z");
    expect(saved.startedAtKst).toBe("2026-11-16T12:00:00.000+09:00");
    expect(saved.again).toBe(false);
  });

  it("한 판 더 → 같은 판의 기록을 고쳐 쓴다(줄이 늘지 않는다)", () => {
    const store = memoryStore();
    const log = new RoundLog(store);
    log.begin(1, false, "390x844", NOW, 0);
    log.finish(60);
    log.again();
    const list = readList(store);
    expect(list).toHaveLength(1);
    expect(list[0].again).toBe(true);
  });

  it("남긴 판이 30 을 넘으면 → 오래된 것부터 뺀다", () => {
    const old = Array.from({ length: 30 }, (_, i) => ({ startedAtUtc: `old-${i}` }));
    const store = memoryStore(JSON.stringify(old));
    const log = new RoundLog(store);
    log.begin(1, false, "390x844", NOW, 0);
    log.finish(5);
    const list = readList(store);
    expect(list).toHaveLength(30);
    expect(list[0].startedAtUtc).toBe("old-1");
    expect(list[29].total).toBe(5);
  });

  it("기록 칸이 깨졌으면 → 빈 목록으로 읽는다", () => {
    expect(readList(memoryStore("{not json"))).toEqual([]);
    expect(readList(memoryStore('{"a":1}'))).toEqual([]);
  });
});
