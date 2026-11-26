import { describe, expect, it } from "vitest";

import { listenTurn } from "./turn-drag";

/** 손짓 하나를 캔버스에 보낸다(at: 그 일이 일어난 때, ms) */
interface Touch {
  x: number;
  y?: number;
  at: number;
  id?: number;
  type?: string;
  button?: number;
}

function setup(canTurn = true) {
  const canvas = document.createElement("canvas");
  const calls: string[] = [];
  const stop = listenTurn(canvas, {
    canTurn: () => canTurn,
    onHold: () => calls.push("hold"),
    onMove: (dx) => calls.push(`move ${dx}`),
    onRelease: (speed) => calls.push(`release ${Math.round(speed)}`),
  });
  const send = (name: string, touch: Touch) => {
    const event = new MouseEvent(name, {
      clientX: touch.x,
      clientY: touch.y ?? 100,
      button: touch.button ?? 0,
    });
    Object.defineProperties(event, {
      pointerId: { value: touch.id ?? 1 },
      pointerType: { value: touch.type ?? "touch" },
      timeStamp: { value: touch.at },
    });
    canvas.dispatchEvent(event);
  };
  return { canvas, calls, stop, send };
}

describe("listenTurn", () => {
  it("가로로 민다 → 문턱(6px)을 넘은 뒤부터 민 만큼 알리고, 떼면 그때의 빠르기", () => {
    const { calls, send } = setup();
    send("pointerdown", { x: 100, at: 0 });
    send("pointermove", { x: 104, at: 10 });
    send("pointermove", { x: 110, at: 20 });
    send("pointermove", { x: 130, at: 40 });
    send("pointerup", { x: 130, at: 50 });
    expect(calls).toEqual(["hold", "move 20", "release 1000"]);
  });

  it("세로로 굴리려던 손가락의 작은 가로 흔들림 → 돌리지 않는다, 브라우저가 가져가면 빠르기 0", () => {
    const { calls, send } = setup();
    send("pointerdown", { x: 100, y: 100, at: 0 });
    send("pointermove", { x: 103, y: 120, at: 10 });
    send("pointermove", { x: 108, y: 160, at: 20 });
    send("pointercancel", { x: 108, y: 160, at: 25 });
    expect(calls).toEqual(["hold", "release 0"]);
  });

  it("돌리다 브라우저가 손짓을 가져가면 → 더 돌지 않는다(빠르기 0)", () => {
    const { calls, send } = setup();
    send("pointerdown", { x: 100, at: 0 });
    send("pointermove", { x: 110, at: 10 });
    send("pointermove", { x: 140, at: 20 });
    send("pointercancel", { x: 140, at: 25 });
    expect(calls.at(-1)).toBe("release 0");
  });

  it("밀다가 멈췄다 떼면 → 더 돌지 않는다(빠르기 0)", () => {
    const { calls, send } = setup();
    send("pointerdown", { x: 100, at: 0 });
    send("pointermove", { x: 110, at: 10 });
    send("pointermove", { x: 140, at: 20 });
    send("pointerup", { x: 140, at: 400 });
    expect(calls.at(-1)).toBe("release 0");
  });

  it("둘째 손가락 → 따라가지 않는다(먼저 댄 손가락만)", () => {
    const { calls, send } = setup();
    send("pointerdown", { x: 100, at: 0, id: 1 });
    send("pointerdown", { x: 300, at: 5, id: 2 });
    send("pointermove", { x: 110, at: 10, id: 1 });
    send("pointermove", { x: 340, at: 15, id: 2 });
    send("pointermove", { x: 120, at: 20, id: 1 });
    send("pointerup", { x: 340, at: 25, id: 2 });
    expect(calls).toEqual(["hold", "move 10"]);
  });

  it("마우스 오른쪽 단추 → 듣지 않는다", () => {
    const { calls, send } = setup();
    send("pointerdown", { x: 100, at: 0, type: "mouse", button: 2 });
    send("pointermove", { x: 160, at: 20, type: "mouse" });
    expect(calls).toEqual([]);
  });

  it("돌릴 수 없을 때(옷장이 열려 있다) → 듣지 않는다", () => {
    const { calls, send } = setup(false);
    send("pointerdown", { x: 100, at: 0 });
    send("pointermove", { x: 160, at: 20 });
    expect(calls).toEqual([]);
  });

  it("세로로 미는 것과 두 손가락으로 키우는 것은 브라우저에 맡긴다 · 그치면 되돌린다", () => {
    const untouched = document.createElement("canvas").style.touchAction;
    const { canvas, calls, stop, send } = setup();
    const whileOn = canvas.style.touchAction;
    stop();
    send("pointerdown", { x: 100, at: 0 });
    expect([whileOn, canvas.style.touchAction === untouched, calls]).toEqual([
      "pan-y pinch-zoom",
      true,
      [],
    ]);
  });
});
