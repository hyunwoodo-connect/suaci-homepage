// 캔버스를 가로로 밀어 돌리는 손짓을 듣는다(이벤트 페이지의 아바타 칸 — 옷장이 닫혀 있을 때).
// 세로로 미는 것은 페이지를 굴리는 손짓이라 브라우저에 맡긴다(touch-action: pan-y. 두 손가락으로 키우는 것도 그대로 둔다) —
// 그때는 브라우저가 손짓을 가져가며 끊어 준다(pointercancel). 손가락 하나(먼저 댄 것)만 따라간다

/** 손짓을 듣는 쪽에 알리는 것 */
export interface TurnHandlers {
  /** 지금 돌릴 수 있나(그리기 시작했고 옷장이 닫혀 있을 때) */
  canTurn(): boolean;
  /** 손을 댔다(저절로 돌던 것을 멈춘다) */
  onHold(): void;
  /** 가로로 dx(px) 밀었다 — 가로로 미는 손짓이 분명해진 뒤부터 온다 */
  onMove(dx: number): void;
  /** 손을 뗐다. speed: 떼는 순간의 빠르기(px/초) — 멈췄다 뗐거나, 돌리지 않았거나, 브라우저가 손짓을 가져갔으면 0 */
  onRelease(speed: number): void;
}

/** 가로로 이만큼(px), 그리고 세로보다 더 밀어야 돌리는 손짓으로 본다 — 페이지를 굴리려고 댄 손가락의 작은 흔들림에 돌지 않게 */
const ENGAGE_PX = 6;
/** 떼기 전 이 시간(ms) 동안 움직임이 없었으면 멈췄다 뗀 것이다(더 돌지 않는다) */
const STILL_MS = 90;

/** 밀어 돌리기를 듣기 시작한다. 돌려주는 함수로 그친다(캔버스의 touch-action 도 되돌린다) */
export function listenTurn(canvas: HTMLElement, on: TurnHandlers): () => void {
  let pointer: number | null = null,
    isTurning = false,
    startX = 0,
    startY = 0,
    lastX = 0,
    lastAt = 0,
    speed = 0;
  const before = canvas.style.touchAction;
  canvas.style.touchAction = "pan-y pinch-zoom";
  const down = (e: PointerEvent) => {
    if (pointer !== null || !on.canTurn()) return;
    // 마우스는 왼쪽 단추만. 오른쪽 단추와 맥의 ctrl+누르기는 메뉴가 뜨며 뗀 것을 알리지 않을 수 있다
    if (e.pointerType === "mouse" && (e.button !== 0 || e.ctrlKey)) return;
    pointer = e.pointerId;
    isTurning = false;
    startX = e.clientX;
    startY = e.clientY;
    lastX = e.clientX;
    lastAt = e.timeStamp;
    speed = 0;
    on.onHold();
    // 마우스는 캔버스 밖으로 나가도 놓을 때까지 따라오게 붙잡는다(터치는 브라우저가 알아서 한다)
    if (e.pointerType === "mouse") canvas.setPointerCapture?.(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    // 미는 사이에 돌릴 수 없게 됐으면(다른 손가락으로 옷장을 열었다) 더 돌리지 않는다
    if (e.pointerId !== pointer || !on.canTurn()) return;
    if (!isTurning) {
      const movedX = e.clientX - startX,
        movedY = e.clientY - startY;
      const acrossX = Math.abs(movedX),
        acrossY = Math.abs(movedY);
      if (acrossX < ENGAGE_PX || acrossX <= acrossY) return;
      // 여기서부터 센다 — 문턱까지 온 만큼을 한꺼번에 돌리면 툭 튄다
      isTurning = true;
      lastX = e.clientX;
      lastAt = e.timeStamp;
      return;
    }
    const dx = e.clientX - lastX,
      elapsed = (e.timeStamp - lastAt) / 1000,
      seconds = Math.max(0.001, elapsed);
    if (dx === 0) return;
    lastX = e.clientX;
    lastAt = e.timeStamp;
    speed = dx / seconds;
    on.onMove(dx);
  };
  const release = (e: PointerEvent, isTaken: boolean) => {
    if (e.pointerId !== pointer) return;
    pointer = null;
    const isStill = e.timeStamp - lastAt > STILL_MS,
      carries = isTurning && !isTaken && !isStill,
      carried = carries ? speed : 0;
    on.onRelease(carried);
  };
  const up = (e: PointerEvent) => release(e, false),
    cancel = (e: PointerEvent) => release(e, true);
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", cancel);
  return () => {
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", up);
    canvas.removeEventListener("pointercancel", cancel);
    canvas.style.touchAction = before;
  };
}
