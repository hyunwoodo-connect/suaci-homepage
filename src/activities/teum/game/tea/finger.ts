// 손가락 그림이 톡톡(글자 없음): 판 시작 전 첫 톡을 기다릴 때(휴대폰은 첫 손길 전에 소리를 낼 수 없다), 첫 판의 첫 화분 위.
// 화면 좌표에 띄우는 그림 하나 — 누를 수 없다(아래 캔버스가 톡을 받는다)

const STYLE_ID = "teum-tea-finger";
const KEYFRAMES = `@keyframes teumTeaTap { 0%, 100% { transform: translate(-30%, 0) scale(1); } 45% { transform: translate(-30%, 10px) scale(0.92); } }
@keyframes teumTeaRing { 0% { transform: translate(-50%, -50%) scale(0.4); opacity: 0.9; } 100% { transform: translate(-50%, -50%) scale(1.6); opacity: 0; } }`;
const FINGER_SVG = `<svg width="58" height="72" viewBox="0 0 58 72" aria-hidden="true"><path d="M22 6c3.3 0 6 2.7 6 6v19l13.6 2.6c5 .9 8.4 5.6 7.8 10.6l-2.2 17.6C46.6 67.2 42.1 71 37 71H24.6c-3.4 0-6.6-1.7-8.5-4.6L5.2 49.8c-1.8-2.8-1-6.5 1.8-8.3 2.4-1.5 5.5-1.1 7.4 1L16 44V12c0-3.3 2.7-6 6-6z" fill="#fff" stroke="#141414" stroke-width="3" stroke-linejoin="round"/></svg>`;

/** 톡톡 손가락 */
export class Finger {
  private readonly el: HTMLDivElement;
  private readonly ring: HTMLDivElement;

  constructor(parent: HTMLElement) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = KEYFRAMES;
      document.head.append(style);
    }
    this.el = document.createElement("div");
    Object.assign(this.el.style, {
      position: "fixed",
      left: "50%",
      top: "55%",
      width: "0",
      height: "0",
      pointerEvents: "none",
      zIndex: "6",
      display: "none",
    });
    this.ring = document.createElement("div");
    Object.assign(this.ring.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: "56px",
      height: "56px",
      borderRadius: "50%",
      border: "3px solid #fff",
      animation: "teumTeaRing 1s ease-out infinite",
    });
    const hand = document.createElement("div");
    hand.innerHTML = FINGER_SVG;
    Object.assign(hand.style, {
      position: "absolute",
      left: "0",
      top: "-6px",
      filter: "drop-shadow(0 2px 4px rgba(0,0,0,.25))",
      animation: "teumTeaTap 1s ease-in-out infinite",
    });
    this.el.append(this.ring, hand);
    parent.append(this.el);
  }

  /** 화면 가운데 조금 아래에 띄운다 */
  showCenter() {
    this.el.style.left = "50%";
    this.el.style.top = "55%";
    this.el.style.display = "block";
  }

  /** 화면 좌표(px)에 띄운다 */
  showAt(x: number, y: number) {
    this.el.style.left = `${x}px`;
    this.el.style.top = `${y}px`;
    this.el.style.display = "block";
  }

  /** 감춘다 */
  hide() {
    this.el.style.display = "none";
  }

  /** 치운다 */
  dispose() {
    this.el.remove();
  }
}
