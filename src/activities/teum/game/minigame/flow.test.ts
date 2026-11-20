import { describe, expect, it } from "vitest";

import type { EntryAction, EntryInput } from "./flow";
import { ENTRY_SECONDS, EntryFlow } from "./flow";

const ON: EntryInput = { dt: 0.1, isOnPad: true, isReady: true, isOver: false };

// 같은 입력으로 seconds 초 동안 돌리고, 나온 할 일을 모은다
function run(flow: EntryFlow, input: EntryInput, seconds: number): EntryAction[] {
  const out: EntryAction[] = [];
  for (let t = 0; t < seconds; t += input.dt) {
    const action = flow.step(input);
    if (action) out.push(action);
  }
  return out;
}

describe("EntryFlow(미니게임 입구)", () => {
  it("올라서서 잠깐 → 연출 → 판 시작", () => {
    const flow = new EntryFlow();
    const seconds = ENTRY_SECONDS.step + ENTRY_SECONDS.intro + 0.5;
    expect(run(flow, ON, seconds)).toEqual(["intro", "start"]);
    expect(flow.phase).toBe("playing");
  });

  it("올라섰다 금방 내려오면 → 시작하지 않는다", () => {
    const flow = new EntryFlow();
    run(flow, ON, 0.3);
    const off = { ...ON, isOnPad: false };
    expect(run(flow, off, 2)).toEqual([]);
    expect(flow.phase).toBe("free");
  });

  it("게임을 열 수 없으면 → 올라서도 그대로", () => {
    const flow = new EntryFlow();
    const notReady = { ...ON, isReady: false };
    expect(run(flow, notReady, 5)).toEqual([]);
    expect(flow.phase).toBe("free");
  });

  it("판 끝 → 결과 → 자유 놀이(내려와야 다시 시작)", () => {
    const flow = new EntryFlow();
    run(flow, ON, ENTRY_SECONDS.step + ENTRY_SECONDS.intro + 0.5);
    const over = { ...ON, isOver: true };
    const after = run(flow, over, ENTRY_SECONDS.result + 0.5);
    expect(after).toEqual(["result", "finish"]);
    expect(flow.phase).toBe("leaving");
    expect(run(flow, ON, 3)).toEqual([]);
    run(flow, { ...ON, isOnPad: false }, 0.2);
    expect(flow.phase).toBe("free");
  });
});
