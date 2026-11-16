import { HUD_FONT } from "../hud";

// 숨바꼭질 화면 위 표시(글 설명은 없다): 꼭꼭 숨어라 가림막 · 위 가운데 빈 칸 넷 · 찾았다! · 화면 밖 재채기 쪽 가장자리 라임빛 ·
// 꾀꼬리(왼쪽 아래, 옷장 단추 위) · 깔까?·한 판 더(아래 가운데 큰 라임 단추) · ?debug 의 잰 값.
// 누르는 칸은 44px 넘게, 라임 위 글자는 먹색

const LIME = "#a9ff39",
  INK = "#141414";
/** 가림막이 내려오고 걷히는 시간(초) */
export const CURTAIN_MOVE = 0.45;
/** 찾았다! 가 떠 있는 시간(초) */
const FOUND_SHOW = 0.8;
/** 가장자리 라임빛이 번지는 시간(초) */
const EDGE_SHOW = 0.6;

// 칸에 들어가는 작은 상자 그림(먹색 선)
const BOX_ICON =
  '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="9" width="16" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9v11M4 13h16M12 9c-2-4-6-4-6-1.5S10 9 12 9c2 0 6 1 6-1.5S14 5 12 9z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

/** 숨바꼭질 표시 */
export class HideOverlay {
  private readonly curtain: HTMLDivElement;
  private readonly slots: HTMLDivElement;
  private readonly toast: HTMLDivElement;
  private readonly edge: HTMLDivElement;
  private readonly kkoekkori: HTMLButtonElement;
  private readonly big: HTMLButtonElement;
  private readonly stats: HTMLDivElement;
  private onKkoekkori: () => void = () => {};
  private onBig: () => void = () => {};
  private bigAway = false;
  private toastTimer = 0;
  private edgeTimer = 0;

  constructor(parent: HTMLElement) {
    this.curtain = document.createElement("div");
    Object.assign(this.curtain.style, {
      position: "fixed",
      inset: "0",
      zIndex: "6",
      background: LIME,
      transform: "translateY(-102%)",
      transition: `transform ${CURTAIN_MOVE}s cubic-bezier(.5,0,.3,1)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: INK,
      fontFamily: HUD_FONT,
      fontSize: "32px",
      fontWeight: "700",
      letterSpacing: "-0.02em",
      pointerEvents: "none",
    });
    this.curtain.textContent = "꼭꼭 숨어라";
    this.slots = document.createElement("div");
    Object.assign(this.slots.style, {
      position: "fixed",
      top: "calc(14px + env(safe-area-inset-top))",
      left: "50%",
      transform: "translateX(-50%)",
      display: "none",
      gap: "8px",
      zIndex: "3",
      pointerEvents: "none",
    });
    this.toast = document.createElement("div");
    this.toast.textContent = "찾았다!";
    Object.assign(this.toast.style, {
      position: "fixed",
      left: "0",
      right: "0",
      top: "26%",
      textAlign: "center",
      fontFamily: HUD_FONT,
      fontSize: "36px",
      fontWeight: "800",
      color: "#fff",
      textShadow: "0 2px 0 rgba(20,20,20,.35), 0 3px 14px rgba(0,0,0,.25)",
      opacity: "0",
      transform: "scale(.6)",
      transition: "opacity .15s, transform .25s cubic-bezier(.3,1.6,.5,1)",
      pointerEvents: "none",
      zIndex: "4",
    });
    this.edge = document.createElement("div");
    Object.assign(this.edge.style, {
      position: "fixed",
      inset: "0",
      opacity: "0",
      transition: "opacity .18s",
      pointerEvents: "none",
      zIndex: "2",
    });
    this.kkoekkori = pillButton("꾀꼬리", false);
    Object.assign(this.kkoekkori.style, {
      left: "calc(14px + env(safe-area-inset-left))",
      bottom: "calc(72px + env(safe-area-inset-bottom))",
    });
    this.kkoekkori.addEventListener("click", () => this.onKkoekkori());
    this.big = pillButton("", true);
    Object.assign(this.big.style, {
      left: "50%",
      bottom: "calc(30px + env(safe-area-inset-bottom))",
      transform: "translateX(-50%)",
    });
    this.big.addEventListener("click", () => this.onBig());
    this.stats = document.createElement("div");
    Object.assign(this.stats.style, {
      position: "fixed",
      left: "12px",
      right: "12px",
      top: "calc(62px + env(safe-area-inset-top))",
      background: "rgba(255,255,255,.92)",
      borderRadius: "12px",
      padding: "10px 12px",
      fontFamily: HUD_FONT,
      fontSize: "12px",
      lineHeight: "1.55",
      color: INK,
      whiteSpace: "pre-line",
      display: "none",
      zIndex: "4",
      pointerEvents: "none",
    });
    parent.append(this.edge, this.slots, this.toast, this.kkoekkori, this.big, this.stats);
    parent.append(this.curtain);
  }

  /** 가림막을 내리거나 걷는다(text: 가림막 위 한 줄 — 언박싱으로 넘어갈 때는 비운다) */
  setCurtain(down: boolean, text = "꼭꼭 숨어라") {
    if (down) this.curtain.textContent = text;
    this.curtain.style.transform = down ? "translateY(0)" : "translateY(-102%)";
  }

  /** 위 가운데 칸(n 개 중 filled 개 채움). n 이 0 이면 숨긴다 */
  setSlots(n: number, filled: number) {
    const box = this.slots;
    box.style.display = n > 0 ? "flex" : "none";
    box.replaceChildren();
    for (let i = 0; i < n; i++) {
      const on = i < filled;
      const cell = document.createElement("div");
      Object.assign(cell.style, {
        width: "34px",
        height: "34px",
        borderRadius: "9px",
        border: `2px solid ${on ? LIME : "rgba(255,255,255,.92)"}`,
        background: on ? LIME : "rgba(255,255,255,.16)",
        boxShadow: "0 1px 6px rgba(0,0,0,.18)",
        color: INK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background .2s, border-color .2s",
      });
      if (on) cell.innerHTML = BOX_ICON;
      box.append(cell);
    }
    box.setAttribute("aria-label", `상자 ${n}개 중 ${filled}개 찾음`);
  }

  /** 찾았다! 를 0.8초 띄운다 */
  showFound() {
    const t = this.toast;
    t.style.opacity = "1";
    t.style.transform = "scale(1)";
    clearTimeout(this.toastTimer);
    const ms = FOUND_SHOW * 1000;
    this.toastTimer = window.setTimeout(() => {
      t.style.opacity = "0";
      t.style.transform = "scale(.6)";
    }, ms);
  }

  /** 화면 가장자리의 그 자리(x·y 는 화면 비율 0..1)에서 라임빛이 0.6초 번진다 */
  glowEdge(x: number, y: number) {
    const px = `${(x * 100).toFixed(1)}%`,
      py = `${(y * 100).toFixed(1)}%`;
    const e = this.edge;
    e.style.background = `radial-gradient(circle at ${px} ${py}, rgba(169,255,57,.85), rgba(169,255,57,.35) 22%, rgba(169,255,57,0) 46%)`;
    e.style.opacity = "1";
    clearTimeout(this.edgeTimer);
    const ms = EDGE_SHOW * 1000;
    this.edgeTimer = window.setTimeout(() => {
      e.style.opacity = "0";
    }, ms);
  }

  /** 꾀꼬리 단추(누르면 onPress) */
  showKkoekkori(on: boolean, onPress: () => void = () => {}) {
    this.onKkoekkori = onPress;
    this.kkoekkori.style.display = on ? "block" : "none";
  }

  /** 아래 가운데 큰 라임 단추(깔까?·한 판 더). text 가 null 이면 숨긴다 */
  showBig(text: string | null, onPress: () => void = () => {}) {
    this.onBig = onPress;
    const b = this.big;
    b.style.display = text ? "block" : "none";
    if (text) b.textContent = text;
  }

  /** 큰 단추를 잠깐 감춘다(놀이기구에 실려 있는 동안 — 단추·글은 그대로 두고 보이지만 않게) */
  setBigAway(away: boolean) {
    if (away === this.bigAway) return;
    this.bigAway = away;
    this.big.style.visibility = away ? "hidden" : "visible";
  }

  /** 잰 값(줄들, null 이면 숨긴다) */
  showStats(lines: readonly string[] | null) {
    const s = this.stats;
    s.style.display = lines ? "block" : "none";
    s.textContent = lines ? lines.join("\n") : "";
  }

  dispose() {
    clearTimeout(this.toastTimer);
    clearTimeout(this.edgeTimer);
    for (const el of [this.curtain, this.slots, this.toast, this.edge, this.kkoekkori, this.big])
      el.remove();
    this.stats.remove();
  }
}

/* ─── 내부 ─────────────────────────── */

// 단추: 큰 것은 라임 바탕 먹색 글자(높이 56px), 작은 것은 흰 바탕(높이 46px)
function pillButton(text: string, isBig: boolean): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  Object.assign(b.style, {
    position: "fixed",
    display: "none",
    height: isBig ? "56px" : "46px",
    padding: isBig ? "0 36px" : "0 18px",
    borderRadius: "999px",
    border: "0",
    background: isBig ? LIME : "rgba(255,255,255,.94)",
    color: INK,
    fontFamily: HUD_FONT,
    fontSize: isBig ? "20px" : "15px",
    fontWeight: "700",
    boxShadow: "0 3px 14px rgba(0,0,0,.16)",
    cursor: "pointer",
    touchAction: "manipulation",
    zIndex: "4",
    whiteSpace: "nowrap",
  });
  return b;
}
