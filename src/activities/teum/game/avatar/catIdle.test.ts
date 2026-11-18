import { describe, expect, it } from "vitest";

import {
  CAT_AHEAD_EVERY,
  CAT_AHEAD_SECONDS,
  CAT_LICK_AFTER,
  CAT_LICK_SECONDS,
  CAT_SIT_AFTER,
  CAT_YAWN_SECONDS,
  createCatIdle,
  stepCatIdle,
} from "./catIdle";

/** seconds 초 동안 같은 조건으로 돌린 뒤의 몸짓 */
function run(
  s: ReturnType<typeof createCatIdle>,
  seconds: number,
  isMoving: boolean,
  isBusy = false,
) {
  const dt = 0.05;
  let now = s.now;
  for (let t = 0; t < seconds; t += dt) now = stepCatIdle(s, dt, isMoving, isBusy, 0);
  return now;
}

describe("라임 고양이의 한가한 몸짓", () => {
  it("내가 멈추면 → 곧 앉아서 꼬리를 흔든다", () => {
    const s = createCatIdle();
    expect(run(s, CAT_SIT_AFTER * 0.5, false)).toBe("follow");
    expect(run(s, CAT_SIT_AFTER, false)).toBe("sit");
  });

  it("오래 서 있으면 → 제 몸을 핥다가 하품하고 다시 앉는다", () => {
    const s = createCatIdle();
    run(s, CAT_SIT_AFTER + 0.2, false);
    expect(run(s, CAT_LICK_AFTER + 0.2, false)).toBe("lick");
    expect(run(s, CAT_LICK_SECONDS, false)).toBe("yawn");
    expect(run(s, CAT_YAWN_SECONDS + 0.1, false)).toBe("sit");
  });

  it("내가 움직이면 → 하던 딴짓을 그만두고 따라온다", () => {
    const s = createCatIdle();
    run(s, CAT_SIT_AFTER + CAT_LICK_AFTER + 0.5, false);
    expect(run(s, 0.1, true)).toBe("follow");
  });

  it("걷다 보면 가끔 → 앞질러 가서 돌아보고, 잠깐 뒤 다시 따라온다", () => {
    const s = createCatIdle();
    expect(run(s, CAT_AHEAD_EVERY[0] - 1, true)).toBe("follow");
    expect(run(s, 1.2, true)).toBe("ahead");
    expect(run(s, CAT_AHEAD_SECONDS + 0.1, true)).toBe("follow");
  });

  it("냄새를 쫓느라 바쁠 때(상자가 가까울 때) → 딴짓을 하지 않는다", () => {
    const s = createCatIdle();
    expect(run(s, CAT_SIT_AFTER + CAT_LICK_AFTER + 2, false, true)).toBe("follow");
  });
});
