import { describe, expect, it } from "vitest";

import { Timeline } from "./timeline";

describe("Timeline", () => {
  it("때가 된 일 → 건 차례대로 한 번씩 한다", () => {
    const t = new Timeline(),
      done: string[] = [];
    t.after(0.5, () => done.push("b"));
    t.after(0.2, () => done.push("a"));
    t.after(0.5, () => done.push("c"));
    t.tick(0.3);
    expect(done).toEqual(["a"]);
    t.tick(0.3);
    t.tick(1);
    expect(done).toEqual(["a", "b", "c"]);
  });

  it("하는 도중에 바로 할 일을 걸면 → 같은 tick 에서 한다", () => {
    const t = new Timeline(),
      done: string[] = [];
    t.after(0.1, () => {
      done.push("first");
      t.after(0, () => done.push("next"));
    });
    t.tick(0.1);
    expect(done).toEqual(["first", "next"]);
  });

  it("clear → 걸어 둔 일을 버린다", () => {
    const t = new Timeline(),
      done: string[] = [];
    t.after(0.1, () => done.push("x"));
    t.clear();
    t.tick(1);
    expect(done).toEqual([]);
  });
});
