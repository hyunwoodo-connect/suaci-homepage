import type { Hud } from "../hud";
import type { Intent } from "./player";

// 입력: 끌기(손가락을 대고 미는 쪽으로 간다) / 칙(짧게 톡). 방향키·WASD 도 끌기와 같다.
// 칙은 화면 좌표로 넘기고, 무엇이 반응할지는 게임이 정한다

/** 이만큼 움직이면 끌기 */
const DRAG_PX = 8;

/** 톡(칙)으로 치는 법: 손가락을 대고 ms 안에 떼고, 그 사이 movePx 안으로만 움직였다(판정은 뗄 때) */
export interface TapRule {
  ms: number;
  movePx: number;
}
/** 이만큼 끌면 최대 세기 */
const FULL_PX = 60;

/** 캔버스와 창의 입력 */
export class Input {
  private id: number | null = null;
  private x0 = 0;
  private y0 = 0;
  private t0 = 0;
  private drag = false;
  private dfx = 0;
  private dfy = 0;
  private dm = 0;
  private readonly keys = new Set<string>();
  private readonly intent: Intent = { fx: 0, fy: 0, m: 0, dragFx: 0 };
  private readonly detachAll: () => void;
  /** 꾸미기 씬처럼 게임 입력을 막은 동안(끌기·방향키를 읽지 않는다) */
  private held = false;
  /** 끌기 동그라미를 숨긴다 */
  private readonly hideStick: () => void;
  /** 마지막으로 끌기가 끝난 시각(performance.now, ms) */
  private dragEndAt = -1e9;
  /** 이번 누름에서 처음 자리로부터 가장 멀리 움직인 거리(px) */
  private moved = 0;

  /** onTap: 톡 친 화면 좌표(tap 규칙에 맞을 때만) */
  constructor(
    canvas: HTMLCanvasElement,
    hud: Hud,
    tap: TapRule,
    onTap: (x: number, y: number) => void,
  ) {
    const { stick, knob } = hud;
    this.hideStick = () => {
      stick.style.display = knob.style.display = "none";
    };
    const onMenu = (e: Event) => e.preventDefault();
    const onDown = (e: PointerEvent) => {
      if (this.id !== null) return;
      this.id = e.pointerId;
      this.x0 = e.clientX;
      this.y0 = e.clientY;
      this.t0 = performance.now();
      this.drag = false;
      this.dm = 0;
      this.moved = 0;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== this.id) return;
      const dx = e.clientX - this.x0,
        dy = e.clientY - this.y0,
        len = Math.hypot(dx, dy);
      this.moved = Math.max(this.moved, len);
      if (!this.drag && len > DRAG_PX) {
        this.drag = true;
        hud.hideHint();
        stick.style.display = knob.style.display = "block";
        stick.style.left = this.x0 + "px";
        stick.style.top = this.y0 + "px";
      }
      if (this.drag) {
        this.dfx = dx / len;
        this.dfy = -dy / len;
        const reach = len / FULL_PX;
        this.dm = Math.min(1, reach);
        const k = Math.min(len, 42) / len;
        knob.style.left = this.x0 + dx * k + "px";
        knob.style.top = this.y0 + dy * k + "px";
      }
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== this.id) return;
      const now = performance.now(),
        held = now - this.t0;
      // 끌기가 막 시작됐어도(DRAG_PX 넘게) tap.movePx 안이면 톡이다 — 끌다가 손가락 밑으로 지나간 것은 톡이 아니다
      const isTap = held <= tap.ms && this.moved <= tap.movePx;
      if (isTap) onTap(e.clientX, e.clientY);
      if (this.drag) this.dragEndAt = now;
      this.id = null;
      this.drag = false;
      this.dm = 0;
      stick.style.display = knob.style.display = "none";
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (this.held) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k);
    };
    canvas.addEventListener("contextmenu", onMenu);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    this.detachAll = () => {
      canvas.removeEventListener("contextmenu", onMenu);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }

  /** 게임 입력을 막거나 푼다. 막을 때 끌던 것은 놓는다 */
  hold(on: boolean) {
    this.held = on;
    if (!on) return;
    this.id = null;
    this.drag = false;
    this.dm = 0;
    this.keys.clear();
    this.hideStick();
  }

  /** 마지막 끌기가 끝나고 지난 시간(ms) — 끌다가 칙이 나간 것을 센다 */
  msSinceDragEnd(): number {
    const now = performance.now();
    return now - this.dragEndAt;
  }

  /** 끌지 않고 손가락을 대고 있는 시간(초, 떼었거나 끌고 있으면 0) — 멈춰서 둘러보기가 본다 */
  pressSeconds(): number {
    if (this.id === null || this.drag || this.held) return 0;
    const now = performance.now(),
      held = now - this.t0;
    return held / 1000;
  }

  /** 이번 프레임의 끌기(방향키가 눌려 있으면 방향키). 막은 동안은 가만히 */
  read(): Intent {
    if (this.held) {
      const still = this.intent;
      still.fx = still.fy = still.m = still.dragFx = 0;
      return still;
    }
    const keys = this.keys;
    const right = keys.has("arrowright") || keys.has("d") ? 1 : 0,
      left = keys.has("arrowleft") || keys.has("a") ? 1 : 0,
      up = keys.has("arrowup") || keys.has("w") ? 1 : 0,
      down = keys.has("arrowdown") || keys.has("s") ? 1 : 0;
    const kx = right - left,
      ky = up - down;
    const it = this.intent;
    it.fx = this.drag ? this.dfx : 0;
    it.fy = this.drag ? this.dfy : 0;
    it.m = this.drag ? this.dm : 0;
    it.dragFx = it.fx;
    if (kx || ky) {
      const l = Math.hypot(kx, ky);
      it.fx = kx / l;
      it.fy = ky / l;
      it.m = 1;
    }
    return it;
  }

  /** 리스너를 뗀다 */
  dispose() {
    this.detachAll();
  }
}
