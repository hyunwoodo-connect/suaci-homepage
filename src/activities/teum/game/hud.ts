import type { Frame } from "./core/frame";

// 화면 위 글자와 끌기 표시. 게임은 맵만 보이고, 아래쪽 안내 한 줄과 끄는 동안의 동그라미만 둔다.
// 소리가 생기면(낼 소리가 있을 때만) 오른쪽 위에 작은 소리 끄기 단추가 붙는다

const FONT = '-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';

// 소리 끄기 단추 그림(스피커 — 켜짐은 소리 물결, 꺼짐은 ×)
const SPEAKER = '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor"/>';
const SPEAKER_ON = `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">${SPEAKER}<path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
const SPEAKER_OFF = `<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">${SPEAKER}<path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;

/** 안내 글자·끌기 동그라미 */
export class Hud {
  readonly hint: HTMLDivElement;
  readonly stick: HTMLDivElement;
  readonly knob: HTMLDivElement;
  /** 안내가 남아 있을 시간(초) */
  private toast = 0;
  /** 처음 한 번만 하는 안내를 이미 했나 */
  private readonly said = new Set<string>();
  /** 소리 끄기 단추(낼 소리가 있을 때만) */
  private mute: HTMLButtonElement | null = null;
  private readonly parent: HTMLElement;

  /** 캔버스 위(같은 부모)에 안내 글자와 끌기 동그라미를 만든다 */
  constructor(parent: HTMLElement) {
    this.parent = parent;
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

  /** 소리 끄기 단추를 단다: 누르면 onToggle(끌지)를 부르고 모양을 바꾼다. 누르는 칸 44px(캔버스 끌기와 겹치지 않는다) */
  showMuteToggle(muted: boolean, onToggle: (muted: boolean) => void) {
    if (this.mute) return;
    const b = document.createElement("button");
    b.type = "button";
    Object.assign(b.style, {
      position: "fixed",
      top: "calc(8px + env(safe-area-inset-top))",
      right: "calc(8px + env(safe-area-inset-right))",
      width: "44px",
      height: "44px",
      padding: "0",
      border: "0",
      borderRadius: "50%",
      background: "transparent",
      color: "#fff",
      filter: "drop-shadow(0 1px 3px rgba(0,0,0,.4))",
      cursor: "pointer",
      touchAction: "manipulation",
    });
    let isMuted = muted;
    const draw = () => {
      b.innerHTML = isMuted ? SPEAKER_OFF : SPEAKER_ON;
      const label = isMuted ? "소리 켜기" : "소리 끄기",
        pressed = String(isMuted);
      b.setAttribute("aria-label", label);
      b.setAttribute("aria-pressed", pressed);
    };
    draw();
    b.addEventListener("click", () => {
      isMuted = !isMuted;
      draw();
      onToggle(isMuted);
    });
    this.mute = b;
    this.parent.append(b);
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
    this.mute?.remove();
  }
}
