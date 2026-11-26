import { LOGO_URL } from "../brand/logo";
import { HUD_FONT } from "../hud";
import { INK, LIME, REDUCED_MOTION } from "./hudStyle";
import { formatElapsed } from "./rules";

// 성공 판: 키컬러 한 장 — 판이 끝나고 마지막으로 보는 것이 라임이게. 라임 위 글자는 먹색이고(브랜드 규칙) 맨 위에 suaci 워드마크

/** 눌린 것을 알리는 곳 */
export interface SuccessPanelHandlers {
  /** 한 번 더 */
  onAgain(): void;
  /** 계속 놀기 */
  onKeepPlaying(): void;
  /** 나가기 */
  onLeave(): void;
}

/** 물풍선 놀이의 성공 판 */
export class SuccessPanel {
  /** 판(놀이 화면이 맨 위에 얹는다) */
  readonly el: HTMLDivElement;
  private readonly doneLine: HTMLParagraphElement;
  private readonly timeText: HTMLSpanElement;
  private readonly rewardLine: HTMLParagraphElement;
  private readonly again: HTMLButtonElement;

  constructor(on: SuccessPanelHandlers) {
    this.el = document.createElement("div");
    this.el.setAttribute("role", "dialog");
    this.el.setAttribute("aria-label", "물풍선 놀이 성공");
    Object.assign(this.el.style, {
      position: "absolute",
      left: "50%",
      top: "40%",
      width: "min(312px, calc(100vw - 40px))",
      boxSizing: "border-box",
      padding: "22px 18px 18px",
      background: LIME,
      border: `3px solid ${INK}`,
      borderRadius: "28px",
      boxShadow: `0 7px 0 ${INK}`,
      textAlign: "center",
      pointerEvents: "auto",
      visibility: "hidden",
      opacity: "0",
      transform: "translate(-50%,-50%) scale(.86)",
      transition: REDUCED_MOTION
        ? "none"
        : "opacity .18s, transform .34s cubic-bezier(.3,1.6,.5,1)",
    });
    const wordmark = document.createElement("img");
    wordmark.src = LOGO_URL;
    wordmark.alt = "suaci";
    Object.assign(wordmark.style, { display: "block", height: "20px", margin: "0 auto 6px" });
    const title = document.createElement("div");
    title.textContent = "성공!";
    Object.assign(title.style, {
      fontSize: "56px",
      lineHeight: "1.15",
      fontWeight: "900",
      letterSpacing: "-0.02em",
      transform: "rotate(-4deg)",
    });
    this.doneLine = document.createElement("p");
    Object.assign(this.doneLine.style, {
      margin: "10px 0 0",
      fontSize: "16px",
      lineHeight: "1.45",
      fontWeight: "600",
    });
    const time = document.createElement("p");
    Object.assign(time.style, {
      margin: "10px 0 0",
      padding: "9px 12px",
      borderRadius: "14px",
      background: "#fff",
      display: "flex",
      alignItems: "baseline",
      justifyContent: "center",
      gap: "10px",
      fontSize: "13px",
    });
    const timeLabel = document.createElement("span");
    timeLabel.textContent = "걸린 시간";
    this.timeText = document.createElement("span");
    Object.assign(this.timeText.style, {
      fontSize: "22px",
      fontWeight: "800",
      fontVariantNumeric: "tabular-nums",
    });
    time.append(timeLabel, this.timeText);
    // 이번에 새로 받은 옷(있을 때만 보인다)
    this.rewardLine = document.createElement("p");
    Object.assign(this.rewardLine.style, {
      display: "none",
      margin: "10px 0 0",
      fontSize: "15px",
      lineHeight: "1.4",
      fontWeight: "700",
    });
    const buttons = document.createElement("div");
    Object.assign(buttons.style, { display: "flex", gap: "8px", marginTop: "16px" });
    this.again = panelButton("한 번 더", INK, "#fff");
    this.again.addEventListener("click", () => on.onAgain());
    const keep = panelButton("계속 놀기", "#fff", INK);
    keep.addEventListener("click", () => on.onKeepPlaying());
    buttons.append(this.again, keep);
    const leave = leaveButton();
    leave.addEventListener("click", () => on.onLeave());
    this.el.append(wordmark, title, this.doneLine, time, this.rewardLine, buttons, leave);
  }

  /** 띄운다: 먹은 수와 걸린 시간, 이번에 새로 받은 옷의 이름(없으면 null) */
  show(total: number, seconds: number, reward: string | null) {
    this.doneLine.textContent = `물풍선 ${total}개를 다 먹었어요`;
    this.timeText.textContent = formatElapsed(seconds);
    this.rewardLine.textContent = reward ? `새 옷이 생겼어요 · ${reward}` : "";
    this.rewardLine.style.display = reward ? "block" : "none";
    Object.assign(this.el.style, {
      visibility: "visible",
      opacity: "1",
      transform: "translate(-50%,-50%) scale(1)",
    });
    // 키보드로 노는 사람이 바로 고를 수 있게(화면이 그쪽으로 밀리지는 않게)
    this.again.focus({ preventScroll: true });
  }

  /** 내린다 */
  hide() {
    Object.assign(this.el.style, {
      visibility: "hidden",
      opacity: "0",
      transform: "translate(-50%,-50%) scale(.86)",
    });
  }
}

/* ─── 내부 ─────────────────────────── */

// 성공 판의 단추(높이 48px, 둘이 판을 반씩 나눈다). 라임 판 위라 먹색·흰색만 쓴다(라임 글자는 읽히지 않는다)
function panelButton(text: string, background: string, color: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  Object.assign(b.style, {
    flex: "1 1 0",
    minHeight: "48px",
    border: "0",
    borderRadius: "999px",
    padding: "0 12px",
    background,
    color,
    fontFamily: HUD_FONT,
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
    touchAction: "manipulation",
  });
  return b;
}

// 나가기: 두 단추 아래의 글자 단추(판의 주인공은 '한 번 더' — 나가는 길은 조용하게, 누르는 자리는 44px)
function leaveButton(): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = "나가기";
  Object.assign(b.style, {
    display: "block",
    width: "100%",
    minHeight: "44px",
    margin: "6px 0 -8px",
    border: "0",
    padding: "0",
    background: "transparent",
    color: INK,
    fontFamily: HUD_FONT,
    fontSize: "15px",
    fontWeight: "600",
    textDecoration: "underline",
    textUnderlineOffset: "4px",
    cursor: "pointer",
    touchAction: "manipulation",
  });
  return b;
}
