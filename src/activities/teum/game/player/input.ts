import type { Hud } from "../hud";
import type { Intent } from "./player";

// 입력: 끌기(손가락을 대고 미는 쪽으로 간다) / 칙(짧게 톡). 방향키·WASD 도 끌기와 같다.
// 칙은 화면 좌표로 넘기고, 무엇이 반응할지는 게임이 정한다

/** 이만큼 움직이면 끌기 */
const DRAG_PX = 8;
/** 이보다 짧게 떼면 칙 */
const TAP_MS = 250;
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

  /** onTap: 짧게 톡 친 화면 좌표 */
  constructor(canvas: HTMLCanvasElement, hud: Hud, onTap: (x: number, y: number) => void) {
    const { stick, knob } = hud;
    const onMenu = (e: Event) => e.preventDefault();
    const onDown = (e: PointerEvent) => {
      if (this.id !== null) return;
      this.id = e.pointerId;
      this.x0 = e.clientX;
      this.y0 = e.clientY;
      this.t0 = performance.now();
      this.drag = false;
      this.dm = 0;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== this.id) return;
      const dx = e.clientX - this.x0,
        dy = e.clientY - this.y0,
        len = Math.hypot(dx, dy);
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
      const held = performance.now() - this.t0;
      if (!this.drag && held < TAP_MS) onTap(e.clientX, e.clientY);
      this.id = null;
      this.drag = false;
      this.dm = 0;
      stick.style.display = knob.style.display = "none";
    };
    const onKeyDown = (e: KeyboardEvent) => {
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

  /** 이번 프레임의 끌기(방향키가 눌려 있으면 방향키) */
  read(): Intent {
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
