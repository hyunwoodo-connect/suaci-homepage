import { describe, expect, it } from "vitest";

import type { ProgressStore } from "./progress";
import { HideProgress } from "./progress";

describe("HideProgress", () => {
  it("처음 → 판 수 0, 도움 0", () => {
    const p = new HideProgress(memory(null));
    expect(p.rounds).toBe(0);
    expect(p.helpUses("rabbit")).toBe(0);
  });

  it("판을 세면 → 다음 방문에도 이어진다", () => {
    const store = memory(null);
    new HideProgress(store).countRound();
    const again = new HideProgress(store);
    again.countRound();
    expect(new HideProgress(store).rounds).toBe(2);
  });

  it("도움을 쓰면 → 종류마다 센다", () => {
    const store = memory(null);
    const p = new HideProgress(store);
    p.useHelp("key");
    p.useHelp("key");
    p.useHelp("watch");
    const later = new HideProgress(store);
    expect(later.helpUses("key")).toBe(2);
    expect(later.helpUses("watch")).toBe(1);
  });

  it("망가진 기록 → 처음부터", () => {
    const p = new HideProgress(memory("{oops"));
    expect(p.rounds).toBe(0);
  });
});

/* ─── 내부 ─────────────────────────── */

function memory(initial: string | null): ProgressStore {
  let text = initial;
  return {
    read: () => text,
    write: (t) => {
      text = t;
    },
  };
}
