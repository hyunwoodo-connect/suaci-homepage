import type { Frame } from "./core/frame";

// 화면 위 글자와 끌기 표시. 게임은 맵만 보이고, 아래쪽 안내 한 줄과 끄는 동안의 동그라미만 둔다

const FONT = '-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';

/** 안내 글자·끌기 동그라미 */
export class Hud {
  readonly hint: HTMLDivElement;
  readonly stick: HTMLDivElement;
  readonly knob: HTMLDivElement;
  /** 안내가 남아 있을 시간(초) */
  private toast = 0;
  /** 처음 한 번만 하는 안내를 이미 했나 */
  private readonly said = new Set<string>();

  /** 캔버스 위(같은 부모)에 안내 글자와 끌기 동그라미를 만든다 */
  constructor(parent: HTMLElement) {
    this.hint = document.createElement("div");
    this.hint.textContent = "정처 없이 떠다니세요";
    Object.assign(this.hint.style, {
      position: "fixed",
      left: "0",
      right: "0",
      bottom: "calc(22px + env(safe-area-inset-bottom))",
      textAlign: "center",
      fontSize: "13px",
      fontFamily: FONT,
      // 진한 바탕(초현실 팝)에서는 안내 글자를 희게
      color: "#fff",
      textShadow: "0 1px 4px rgba(0,0,0,.4)",
      pointerEvents: "none",
      transition: "opacity .6s",
    });
    this.stick = document.createElement("div");
    Object.assign(this.stick.style, {
      position: "fixed",
      width: "84px",
      height: "84px",
      margin: "-42px 0 0 -42px",
      borderRadius: "50%",
      border: "1.5px solid rgba(43,46,45,.25)",
      pointerEvents: "none",
      display: "none",
    });
    this.knob = document.createElement("div");
    Object.assign(this.knob.style, {
      position: "fixed",
      width: "26px",
      height: "26px",
      margin: "-13px 0 0 -13px",
      borderRadius: "50%",
      background: "rgba(43,46,45,.35)",
      pointerEvents: "none",
      display: "none",
    });
    parent.append(this.hint, this.stick, this.knob);
  }

  /** 안내 한 줄을 띄운다(2.2초) */
  say(text: string) {
    this.hint.textContent = text;
    this.hint.style.opacity = "1";
    this.toast = 2.2;
  }

  /** 이 안내(key)는 처음 한 번만 */
  sayOnce(key: string, text: string) {
    if (this.said.has(key)) return;
    this.said.add(key);
    this.say(text);
  }

  /** 안내 글자를 숨긴다(끌거나 칙 하면) */
  hideHint() {
    this.hint.style.opacity = "0";
  }

  /** 안내가 시간이 다 되면 사라진다 */
  update(f: Frame) {
    if (this.toast <= 0) return;
    this.toast -= f.dt;
    if (this.toast <= 0) this.hideHint();
  }

  /** 안내 글자와 동그라미를 지운다 */
  dispose() {
    this.hint.remove();
    this.stick.remove();
    this.knob.remove();
  }
}
