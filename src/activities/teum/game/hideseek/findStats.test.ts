import { describe, expect, it } from "vitest";

import type { LogStore } from "./findStats";
import { FIND_RULES, FindLog, readFindList } from "./findStats";

/** 기억에만 두는 기록 칸 */
function memoryStore(initial: string | null = null): LogStore & { text: string | null } {
  const store = {
    text: initial,
    read: () => store.text,
    write: (text: string) => {
      store.text = text;
    },
  };
  return store;
}

describe("FindLog", () => {
  it("상자를 찾으면 → 패턴·걸린 시간·이사·곁을 지나친 횟수가 남고, 넷이면 다 찾은 판", () => {
    const store = memoryStore(),
      log = new FindLog(store);
    log.begin("390x844", Date.UTC(2026, 10, 17, 6, 0, 0), 10);
    expect(log.isFirstOnDevice).toBe(true);
    log.dealt(["A", "A", "B", "D"], ["cups-1", "pots-2", "jar-s", "pad-n"]);
    log.seekStarted(14);
    log.wrong();
    log.taunted();
    log.moved();
    log.nearMiss();
    log.found({ prop: "cups-1", pattern: "A", moves: 1, nearMisses: 1 }, 74);
    log.found({ prop: "pots-2", pattern: "A", moves: 0, nearMisses: 0 }, 104);
    const [saved] = readFindList(store);
    expect(saved.rules).toBe(FIND_RULES);
    expect(saved.startedAtKst).toBe("2026-11-17T15:00:00.000+09:00");
    expect(saved.found[0]).toMatchObject({ pattern: "A", seconds: 60, took: 60, moves: 1 });
    expect(saved.found[1]).toMatchObject({ seconds: 90, took: 30 });
    expect(saved.firstFound).toBe(60);
    expect(saved.isAllFound).toBe(false);
    expect(saved).toMatchObject({ wrongTaps: 1, taunts: 1, moves: 1, nearMisses: 1 });
    log.found({ prop: "jar-s", pattern: "B", moves: 0, nearMisses: 2 }, 150);
    log.found({ prop: "pad-n", pattern: "D", moves: 0, nearMisses: 0 }, 200);
    log.mushrooms(3);
    log.finish(230);
    const [done] = readFindList(store);
    expect(done.isAllFound).toBe(true);
    expect(done.foundAll).toBe(186);
    expect(done.total).toBe(220);
    expect(done.mushrooms).toBe(3);
  });

  it("앞 조각의 기록이 같은 칸에 있어도 → 지우지 않고, 지금 규칙의 판만 센다", () => {
    const old = JSON.stringify([{ startedAtUtc: "2026-11-16T00:00:00.000Z", rules: "01f" }]),
      store = memoryStore(old),
      log = new FindLog(store);
    log.begin("390x844", Date.UTC(2026, 10, 17), 0);
    expect(log.isFirstOnDevice).toBe(true);
    log.finish(5);
    const all = JSON.parse(store.text ?? "[]") as { rules: string }[];
    expect(all.map((x) => x.rules)).toEqual(["01f", FIND_RULES]);
    expect(readFindList(store)).toHaveLength(1);
  });

  it("하나도 못 찾고 닫은 판도 남는다 — 다음 판은 둘째 판이고 처음이 아니다", () => {
    const store = memoryStore(),
      first = new FindLog(store);
    first.begin("390x844", Date.UTC(2026, 10, 17, 1), 0);
    first.seekStarted(4);
    first.wrong();
    const [saved] = readFindList(store);
    expect(saved).toMatchObject({ roundNo: 1, wrongTaps: 1, isAllFound: false });
    const second = new FindLog(store);
    second.begin("390x844", Date.UTC(2026, 10, 17, 2), 0);
    expect(second.isFirstOnDevice).toBe(false);
    second.seekStarted(4);
    expect(readFindList(store).map((r) => r.roundNo)).toEqual([1, 2]);
  });
});
