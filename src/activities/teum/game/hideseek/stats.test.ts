import { describe, expect, it } from "vitest";

import type { LogStore } from "./stats";
import { readList, RoundLog, winShare } from "./stats";

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

  it("찾기 → 가림이 걷힌 때부터 초를 재고, 첫 상자 시간과 찾은 길을 남긴다", () => {
    const store = memoryStore();
    const log = new RoundLog(store);
    log.begin(2, true, "390x844", NOW, 10);
    log.seekStarted(15);
    log.found({ spot: "wishtree", kind: "behind", how: "touch" }, 27.34);
    log.found({ spot: "pad-n-top", kind: "high", how: "drop" }, 80);
    log.finish(90);
    const [saved] = readList(store);
    expect(saved.firstFound).toBe(12.3);
    expect(saved.found.map((f) => f.seconds)).toEqual([12.3, 65]);
    expect(saved.found[1]).toMatchObject({ how: "drop" });
    expect(saved.foundAll).toBeNull();
  });

  it("넷을 다 찾으면 → 넷째를 찾은 때가 '넷 다' 시간으로 남는다", () => {
    const store = memoryStore();
    const log = new RoundLog(store);
    log.begin(1, false, "390x844", NOW, 0);
    log.seekStarted(4);
    for (const t of [10, 40, 70, 124])
      log.found({ spot: "wishtree", kind: "behind", how: "touch" }, t);
    log.ended("all");
    expect(readList(store)[0]).toMatchObject({ foundAll: 120, endedBy: "all" });
  });

  it("생물·전설·끝난 까닭 → 데려다준 횟수와 그중 찾아온 횟수를 따로 남긴다", () => {
    const store = memoryStore();
    const log = new RoundLog(store);
    log.begin(1, false, "390x844", NOW, 0);
    log.guided(false);
    log.guided(true);
    log.guided(true);
    log.legendAppeared();
    log.ended("sunset");
    const [saved] = readList(store);
    expect(saved).toMatchObject({ guided: 3, rescued: 2 });
    expect(saved.legend).toEqual({ appeared: true, ridden: false });
    expect(saved.endedBy).toBe("sunset");
    expect(saved.total).toBeNull();
  });

  it("이 기기 첫 판 → 남은 기록이 없을 때만 첫 판으로 적는다", () => {
    const store = memoryStore();
    const log = new RoundLog(store);
    log.begin(1, false, "390x844", NOW, 0);
    log.finish(60);
    log.begin(2, false, "390x844", NOW + 90e3, 90);
    log.finish(150);
    expect(readList(store).map((r) => r.firstOnDevice)).toEqual([true, false]);
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

  it("끝 화면 줄 → 이 기기에서 3분 안에 넷을 다 찾은 판 수가 보인다", () => {
    const store = memoryStore();
    const log = new RoundLog(store);
    log.begin(1, false, "390x844", NOW, 0);
    log.ended("all");
    log.begin(2, false, "390x844", NOW + 200e3, 200);
    log.ended("sunset");
    expect(log.lines()).toContain("이 기기 2판(지금 규칙) 중 3분 안에 넷 다 찾은 판 1");
  });

  it("기록 칸이 깨졌으면 → 빈 목록으로 읽는다", () => {
    expect(readList(memoryStore("{not json"))).toEqual([]);
    expect(readList(memoryStore('{"a":1}'))).toEqual([]);
  });
});

describe("winShare", () => {
  it("규칙이 다른 예전 판 → 세지 않는다", () => {
    const old = [{ startedAtUtc: "old", endedBy: "all" }];
    const store = memoryStore(JSON.stringify(old));
    const log = new RoundLog(store);
    log.begin(1, false, "390x844", NOW, 0);
    log.ended("sunset");
    expect(winShare(readList(store))).toEqual({ played: 1, won: 0 });
  });

  it("끝나지 않은 판 → 세지 않는다", () => {
    const store = memoryStore();
    const log = new RoundLog(store);
    log.begin(1, false, "390x844", NOW, 0);
    log.ended("all");
    log.begin(1, false, "390x844", NOW + 1e3, 1);
    log.finish(2);
    expect(winShare(readList(store))).toEqual({ played: 1, won: 1 });
  });
});
