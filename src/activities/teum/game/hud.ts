import type { Game } from "./state";

// 화면 위 글자와 끌기 표시. 게임은 맵만 보이고, 아래쪽 안내 한 줄과 끄는 동안의 동그라미만 둔다

/** 안내 글자·끌기 동그라미 */
export interface Hud {
  hint: HTMLDivElement;
  stick: HTMLDivElement;
  knob: HTMLDivElement;
  /** 안내가 남아 있을 시간(초) */
  toast: number;
}

const FONT = '-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';

/** 캔버스 위(같은 부모)에 안내 글자와 끌기 동그라미를 만든다 */
export function createHud(parent: HTMLElement): Hud {
  const hint = document.createElement("div");
  hint.textContent = "정처 없이 떠다니세요";
  Object.assign(hint.style, {
    position: "fixed",
    left: "0",
    right: "0",
    bottom: "calc(22px + env(safe-area-inset-bottom))",
    textAlign: "center",
    fontSize: "13px",
    fontFamily: FONT,
    color: "#6c7170",
    pointerEvents: "none",
    transition: "opacity .6s",
  });
  const stick = document.createElement("div");
  Object.assign(stick.style, {
    position: "fixed",
    width: "84px",
    height: "84px",
    margin: "-42px 0 0 -42px",
    borderRadius: "50%",
    border: "1.5px solid rgba(43,46,45,.25)",
    pointerEvents: "none",
    display: "none",
  });
  const knob = document.createElement("div");
  Object.assign(knob.style, {
    position: "fixed",
    width: "26px",
    height: "26px",
    margin: "-13px 0 0 -13px",
    borderRadius: "50%",
    background: "rgba(43,46,45,.35)",
    pointerEvents: "none",
    display: "none",
  });
  parent.append(hint, stick, knob);
  return { hint, stick, knob, toast: 0 };
}

/** 안내 한 줄을 띄운다(2.2초) */
export function say(g: Game, text: string) {
  g.hud.hint.textContent = text;
  g.hud.hint.style.opacity = "1";
  g.hud.toast = 2.2;
}

/** 안내가 시간이 다 되면 사라진다 */
export function hudFrame(g: Game) {
  const hud = g.hud;
  if (hud.toast > 0) {
    hud.toast -= g.t.dt;
    if (hud.toast <= 0) hud.hint.style.opacity = "0";
  }
}

/** 안내 글자와 동그라미를 지운다 */
export function removeHud(hud: Hud) {
  hud.hint.remove();
  hud.stick.remove();
  hud.knob.remove();
}
