import { HUD_FONT } from "../hud";
import { HIDE } from "./tuning";

// 숨바꼭질 화면 위 표시. 자리와 크기는 화면 시안(폰 390×844 기준 px)대로, 글은 hideseek.data.json 의 copy, 색은 colors.
// 판이 도는 동안 화면에 늘 떠 있는 것은 위 칸 넷뿐이다(안내 줄·말풍선은 없다 — 가까워지는 것은 소리와 세계 안의 움직임으로 안다):
//   위 가운데(위에서 56) — 상자 칸 넷(40×40, 간격 10). 빈 칸은 어두운 반투명에 점선, 찬 칸은 라임에 먹색 테두리(찰 때 출렁인다)
//   한가운데 조금 위(위에서 232) — 큰 글자(라임 바탕·먹색 글자와 테두리, 3도 기울임): 꼭꼭 숨어라 · 술래는 너 · 찾았다! · 깔까?
//   아래 가운데 — 판이 끝난 뒤의 '한 판 더'(가장 큰 단추)
// 잠깐 뜨는 것: 눈꺼풀(판 시작·언박싱으로 넘어갈 때), 금색 상자가 쿵 할 때의 화면 흔들림,
// ?debug 의 잰 값과 빌드 표시. 누르는 칸은 44px 넘게, 라임 위 글자는 먹색

const { lime: LIME, ink: INK } = HIDE.colors;
/** 눈꺼풀이 감기고 뜨는 시간(초) */
export const LIDS_MOVE = 0.3;
/** 상자 칸 한 변·사이·그 안 상자 그림 한 변(px) */
const CELL = 40,
  GAP = 10,
  ICON = 30;
/** 위에서의 자리(px): 상자 칸 · 큰 글자 */
const SLOTS_TOP = 56,
  BIG_TOP = 232;
// 칸에 들어가는 상자 그림(먹색 선 — 리본과 귀)
const BOX_ICON = `<svg width="${ICON}" height="${ICON}" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="9.5" width="16" height="10.5" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9.5v10.5M4 13.5h16M12 9.5c-2-4.5-6.5-4.5-6.5-1.5S10 9.5 12 9.5c2 0 6.5 1.5 6.5-1.5S14 5 12 9.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;

/** 숨바꼭질 표시 */
export class HideOverlay {
  private readonly lids: HTMLDivElement[] = [];
  private readonly slots: HTMLDivElement;
  private readonly cells: HTMLDivElement[] = [];
  private readonly big: HTMLDivElement;
  private readonly ending: HTMLDivElement;
  private readonly again: HTMLButtonElement;
  private readonly stats: HTMLDivElement;
  private readonly stamp: HTMLDivElement;
  private onAgain: () => void = () => {};
  private readonly style: HTMLStyleElement;
  private isSmall = false;
  private isHidden = false;
  private bigLeft = 0;

  constructor(private readonly parent: HTMLElement) {
    // 꾸미기 씬 동안 숨바꼭질 표시를 통째로 숨기는 규칙(이 표시들만 data-hide 를 단다)
    const style = document.createElement("style");
    style.textContent = ".teum-hide-off [data-hide] { display: none !important; }";
    this.style = style;
    parent.append(style);
    // 눈꺼풀: 화면 위아래에서 어두운 띠가 내려오고 올라와 맞닿는다(맞닿는 가장자리는 둥글다)
    for (const isUpper of [true, false]) {
      const lid = fixedBox({
        left: "-10%",
        width: "120%",
        height: "0%",
        background: INK,
        zIndex: "6",
        pointerEvents: "none",
        borderRadius: isUpper ? "0 0 50% 50% / 0 0 22% 22%" : "50% 50% 0 0 / 22% 22% 0 0",
        transition: `height ${LIDS_MOVE}s cubic-bezier(.4,0,.2,1)`,
      });
      if (isUpper) lid.style.top = "0";
      else lid.style.bottom = "0";
      this.lids.push(lid);
    }
    this.slots = fixedBox({
      top: `max(${SLOTS_TOP}px, calc(env(safe-area-inset-top) + 12px))`,
      left: "50%",
      transform: "translateX(-50%)",
      display: "none",
      gap: `${GAP}px`,
      zIndex: "3",
      pointerEvents: "none",
    });
    for (let i = 0; i < 4; i++) {
      const cell = styledBox({
        width: `${CELL}px`,
        height: `${CELL}px`,
        borderRadius: "10px",
        color: INK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
      });
      this.cells.push(cell);
      this.slots.append(cell);
    }
    this.big = fixedBox({
      left: "50%",
      top: `${BIG_TOP}px`,
      padding: "4px 18px 6px",
      borderRadius: "16px",
      border: `3px solid ${INK}`,
      background: LIME,
      color: INK,
      fontFamily: HUD_FONT,
      fontWeight: "800",
      letterSpacing: "-0.02em",
      whiteSpace: "nowrap",
      boxShadow: "0 4px 0 rgba(20,20,20,.25)",
      opacity: "0",
      transform: "translateX(-50%) rotate(-3deg) scale(.5)",
      transition: "opacity .12s, transform .28s cubic-bezier(.3,1.7,.5,1)",
      pointerEvents: "none",
      zIndex: "4",
    });
    this.ending = fixedBox({
      left: "50%",
      bottom: "calc(36px + env(safe-area-inset-bottom))",
      transform: "translateX(-50%)",
      display: "none",
      gap: "10px",
      alignItems: "center",
      zIndex: "4",
    });
    this.again = pill(HIDE.copy.again, 64);
    this.again.addEventListener("click", () => this.onAgain());
    this.ending.append(this.again);
    this.stats = fixedBox({
      left: "12px",
      right: "12px",
      top: "45%",
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
    this.stamp = fixedBox({
      left: "calc(8px + env(safe-area-inset-left))",
      bottom: "calc(6px + env(safe-area-inset-bottom))",
      fontFamily: HUD_FONT,
      fontSize: "11px",
      color: "#fff",
      textShadow: "0 1px 3px rgba(0,0,0,.7)",
      display: "none",
      zIndex: "4",
      pointerEvents: "none",
    });
    parent.append(this.slots, this.big, this.ending);
    parent.append(this.stats, this.stamp, ...this.lids);
    for (const el of [this.slots, this.big, this.ending, this.stats]) el.dataset.hide = "";
    this.resetSlots();
  }

  /** 눈꺼풀을 감거나 뜬다(감는 데 LIDS_MOVE 초) */
  setLids(closed: boolean) {
    for (const lid of this.lids) lid.style.height = closed ? "56%" : "0%";
  }

  /** 위 가운데 상자 칸 넷을 보이거나 숨긴다 */
  showSlots(on: boolean) {
    this.slots.style.display = on ? "flex" : "none";
  }

  /** 칸을 모두 비운다(판 시작) */
  resetSlots() {
    for (const cell of this.cells) {
      cell.replaceChildren();
      cell.style.border = "2px dashed rgba(255,255,255,.75)";
      cell.style.background = "rgba(20,20,20,.38)";
      cell.style.boxShadow = "none";
    }
    this.slots.setAttribute("aria-label", "찾은 상자 없음");
  }

  /** i 번째 칸을 채운다(찾은 상자를 센다 — 찰 때 출렁인다) */
  fillSlot(i: number) {
    const cell = this.cells[i];
    if (!cell) return;
    cell.style.border = `3px solid ${INK}`;
    cell.style.background = LIME;
    cell.innerHTML = BOX_ICON;
    pop(cell, 1.3);
    this.slots.setAttribute("aria-label", `상자 ${i + 1}개 찾음`);
  }

  /** 칸 넷이 동시에 번쩍인다(넷째 칸이 찼다) */
  flashSlots() {
    for (const cell of this.cells) {
      if (typeof cell.animate !== "function") continue;
      cell.animate(
        [
          { background: "#fff", transform: "scale(1.3)" },
          { background: LIME, transform: "scale(1)" },
        ],
        { duration: 420, easing: "ease-out" },
      );
    }
  }

  /** 큰 글자를 seconds 초 띄운다(통 튀며 나온다) */
  showBig(text: string, seconds = HIDE.screen.bigSeconds) {
    const b = this.big;
    b.textContent = text;
    b.style.fontSize = text.length <= 5 ? "56px" : "44px";
    b.style.opacity = "1";
    b.style.transform = "translateX(-50%) rotate(-3deg) scale(1)";
    this.bigLeft = seconds;
  }

  /** 판이 끝난 뒤의 '한 판 더'(아래 가운데). onAgain 이 null 이면 숨긴다 */
  showEnding(onAgain: (() => void) | null) {
    this.onAgain = onAgain ?? (() => {});
    this.ending.style.display = onAgain ? "flex" : "none";
  }

  /** 끝 단추를 작게(판 끝에서 돌아다니기 시작했다 — 자유 놀이) · 원래대로 */
  setEndingSmall(small: boolean) {
    if (small === this.isSmall) return;
    this.isSmall = small;
    const scale = small ? "0.62" : "1";
    this.ending.style.transform = `translateX(-50%) scale(${scale})`;
    this.ending.style.transformOrigin = "50% 100%";
  }

  /** 숨바꼭질 화면을 통째로 숨긴다(꾸미기 씬 동안 — 씬의 단추만 보이게) · 다시 보인다 */
  setHidden(hidden: boolean) {
    if (hidden === this.isHidden) return;
    this.isHidden = hidden;
    this.parent.classList.toggle("teum-hide-off", hidden);
  }

  /** ?debug 의 빌드 표시(커밋 앞 7자와 빌드 시각) — 왼쪽 아래 구석에 작게 */
  showStamp(text: string) {
    this.stamp.textContent = text;
    this.stamp.style.display = "block";
  }

  /** 떠 있는 큰 글자를 지운다(꾸미기 씬으로 들어갈 때) */
  clearFloating() {
    this.bigLeft = 0;
    this.big.style.opacity = "0";
  }

  /** 화면이 살짝 흔들린다(금색 상자가 쿵) */
  shake() {
    const canvas = this.parent.querySelector("canvas");
    if (!canvas || typeof canvas.animate !== "function") return;
    canvas.animate(
      [
        { transform: "translate(0, 0)" },
        { transform: "translate(-5px, 3px)" },
        { transform: "translate(4px, -4px)" },
        { transform: "translate(-3px, 2px)" },
        { transform: "translate(0, 0)" },
      ],
      { duration: 320 },
    );
  }

  /** 한 프레임: 큰 글자의 시간 */
  update(dt: number) {
    if (this.bigLeft > 0) {
      this.bigLeft -= dt;
      if (this.bigLeft <= 0) {
        this.big.style.opacity = "0";
        this.big.style.transform = "translateX(-50%) rotate(-3deg) scale(.5)";
      }
    }
  }

  /** 잰 값(줄들, null 이면 숨긴다) */
  showStats(lines: readonly string[] | null) {
    const s = this.stats;
    s.style.display = lines ? "block" : "none";
    s.textContent = lines ? lines.join("\n") : "";
  }

  dispose() {
    this.style.remove();
    const own = [this.slots, this.big, this.ending, this.stats, this.stamp, ...this.lids];
    for (const el of own) el.remove();
  }
}

/* ─── 내부 ─────────────────────────── */

// 스타일을 준 div
function styledBox(style: Partial<CSSStyleDeclaration>): HTMLDivElement {
  const el = document.createElement("div");
  Object.assign(el.style, style);
  return el;
}

// 화면에 붙박인 div(스크롤·세계와 상관없이 그 자리)
function fixedBox(style: Partial<CSSStyleDeclaration>): HTMLDivElement {
  return styledBox({ position: "fixed", ...style });
}

// 알약 단추: 라임 바탕에 먹색 글자와 테두리
function pill(text: string, height: number): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  Object.assign(b.style, {
    height: `${height}px`,
    padding: "0 40px",
    borderRadius: "999px",
    border: `3px solid ${INK}`,
    background: LIME,
    color: INK,
    fontFamily: HUD_FONT,
    fontSize: "23px",
    fontWeight: "800",
    boxShadow: "0 4px 0 rgba(20,20,20,.25)",
    cursor: "pointer",
    touchAction: "manipulation",
    whiteSpace: "nowrap",
  });
  return b;
}

// 통 튀어나오는 느낌(칸이 찰 때): 제 자리 변환은 그대로 두고 크기만
function pop(el: HTMLElement, peak: number) {
  if (typeof el.animate !== "function") return;
  el.animate([{ scale: "0.5" }, { scale: `${peak}` }, { scale: "0.92" }, { scale: "1" }], {
    duration: 320,
    easing: "ease-out",
  });
}
