// 두 손가락 톡(기획서 v3.1 4장): 한 손가락으로 끌며 걷는 중에 다른 손가락으로 톡해도 톡이다(끌기는 끊기지 않는다).
// 지금 게임의 입력(Input)은 첫 손가락만 본다 — 이 씬은 그동안 내려온 다른 손가락만 따로 보고, 톡 규칙에 맞으면 알린다

/** 톡 규칙: ms 안에 떼고 그 사이 movePx 안으로만 움직였다 */
interface TapRule {
  ms: number;
  movePx: number;
}

/** 내려온 손가락 하나 */
interface Touch {
  x0: number;
  y0: number;
  t0: number;
  moved: number;
  /** 다른 손가락이 이미 눌려 있을 때 내려왔다(첫 손가락은 Input 이 맡는다) */
  isSecond: boolean;
}

/** 두 번째 손가락 톡 */
export class MultiTap {
  private readonly touches = new Map<number, Touch>();
  private readonly detach: () => void;

  constructor(canvas: HTMLCanvasElement, rule: TapRule, onTap: (x: number, y: number) => void) {
    const onDown = (e: PointerEvent) => {
      const isSecond = this.touches.size > 0;
      this.touches.set(e.pointerId, {
        x0: e.clientX,
        y0: e.clientY,
        t0: performance.now(),
        moved: 0,
        isSecond,
      });
    };
    const onMove = (e: PointerEvent) => {
      const t = this.touches.get(e.pointerId);
      if (!t) return;
      const dx = e.clientX - t.x0,
        dy = e.clientY - t.y0;
      const len = Math.hypot(dx, dy);
      t.moved = Math.max(t.moved, len);
    };
    const onUp = (e: PointerEvent) => {
      const t = this.touches.get(e.pointerId);
      this.touches.delete(e.pointerId);
      if (!t || !t.isSecond) return;
      const held = performance.now() - t.t0;
      const isTap = held <= rule.ms && t.moved <= rule.movePx;
      if (isTap) onTap(e.clientX, e.clientY);
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    this.detach = () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    };
  }

  /** 치운다 */
  dispose() {
    this.detach();
  }
}
