import * as THREE from "three";

import { HUD_FONT } from "../hud";
import { HIDE } from "./tuning";

// 숨바꼭질 화면 위 표시. 자리와 크기는 화면 시안(폰 390×844 기준 px)대로, 글은 hideseek.data.json 의 copy, 색은 colors.
// 판이 도는 동안 누를 단추는 하나도 없다:
//   위 가운데(위에서 56) — 상자 칸 넷(40×40, 간격 10). 빈 칸은 어두운 반투명에 점선, 찬 칸은 라임에 먹색 테두리(찰 때 출렁인다)
//   칸 밑(위에서 108) — 한 줄 안내(톡 · 고양이가 냄새를 맡았어). 한 번에 하나
//   한가운데 조금 위(위에서 232) — 큰 글자(라임 바탕·먹색 글자와 테두리, 3도 기울임): 꼭꼭 숨어라 · 술래는 너 · 찾았다! · 깔까? · 우리가 이겼다!
//   아래 가운데 — 판이 끝난 뒤의 '한 판 더'(가장 큰 단추. 해가 졌는데 찾은 것이 있으면 작은 '깔까?'도)
// 그 밖에 세계에 붙는 말풍선(에취! · 상자 봤어! 따라와! · 저기!)과 고양이 머리 위 냄새 표시, 눈꺼풀(판 시작·언박싱으로 넘어갈 때 잠깐 감긴다),
// 전설의 생물 표시, ?debug 의 잰 값과 빌드 표시. 누르는 칸은 44px 넘게, 라임 위 글자는 먹색

const { lime: LIME, ink: INK } = HIDE.colors;
/** 눈꺼풀이 감기고 뜨는 시간(초) */
export const LIDS_MOVE = 0.3;
/** 말풍선이 화면 가장자리에 붙을 때 넘지 않는 범위(화면 좌표 -1..1): 좌우·아래·위(위는 상자 칸을 가리지 않게 낮춘다) */
const EDGE_X = 0.74,
  EDGE_DOWN = 0.66,
  EDGE_UP = 0.56;
/** 상자 칸 한 변·사이·그 안 상자 그림 한 변(px) */
const CELL = 40,
  GAP = 10,
  ICON = 30;
/** 위에서의 자리(px): 상자 칸 · 한 줄 안내 · 큰 글자 */
const SLOTS_TOP = 56,
  HINT_TOP = 108,
  BIG_TOP = 232;
/** 동시에 뜨는 말풍선 수 */
const BUBBLES = 4;

// 칸에 들어가는 상자 그림(먹색 선 — 리본과 귀)
const BOX_ICON = `<svg width="${ICON}" height="${ICON}" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="9.5" width="16" height="10.5" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9.5v10.5M4 13.5h16M12 9.5c-2-4.5-6.5-4.5-6.5-1.5S10 9.5 12 9.5c2 0 6.5 1.5 6.5-1.5S14 5 12 9.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
// 전설의 생물이 판 위에 있다는 작은 표시(고래)
const WHALE_ICON = `<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 13c0-4 3.5-6.5 8-6.5 5 0 7.5 3 9 3.5 1 .3 2-.5 2-2 .8 2.5 0 5-2 6-1.5 3-4.5 4.5-8.5 4.5-5 0-8.5-2-8.5-5.5z" fill="#fff" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="7.2" cy="12" r="1" fill="${INK}"/></svg>`;
/** 말풍선 하나: 세계의 어느 자리에 붙는지(프레임마다 묻는다)와 남은 시간 */
interface Bubble {
  el: HTMLDivElement;
  where: ((out: THREE.Vector3) => void) | null;
  left: number;
}

const at = new THREE.Vector3();

/** 숨바꼭질 표시 */
export class HideOverlay {
  private readonly lids: HTMLDivElement[] = [];
  private readonly slots: HTMLDivElement;
  private readonly cells: HTMLDivElement[] = [];
  private readonly mark: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly big: HTMLDivElement;
  private readonly ending: HTMLDivElement;
  private readonly open: HTMLButtonElement;
  private readonly again: HTMLButtonElement;
  private readonly stats: HTMLDivElement;
  private readonly stamp: HTMLDivElement;
  private readonly catMark: HTMLDivElement;
  private catWhere: ((out: THREE.Vector3) => void) | null = null;
  private readonly bubbles: Bubble[] = [];
  private onOpen: () => void = () => {};
  private onAgain: () => void = () => {};
  private endingAway = false;
  private bigLeft = 0;

  constructor(private readonly parent: HTMLElement) {
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
    this.mark = styledBox({
      position: "absolute",
      left: "100%",
      top: "7px",
      marginLeft: "8px",
      display: "none",
    });
    this.mark.innerHTML = WHALE_ICON;
    this.slots.append(this.mark);
    this.hint = fixedBox({
      top: `max(${HINT_TOP}px, calc(env(safe-area-inset-top) + ${HINT_TOP - SLOTS_TOP + 12}px))`,
      left: "50%",
      transform: "translateX(-50%)",
      padding: "7px 16px",
      borderRadius: "999px",
      background: "rgba(20,20,20,.82)",
      color: "#fff",
      fontFamily: HUD_FONT,
      fontSize: "17px",
      fontWeight: "700",
      whiteSpace: "nowrap",
      display: "none",
      zIndex: "3",
      pointerEvents: "none",
    });
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
    this.open = pill(HIDE.copy.open, 52, false);
    this.open.addEventListener("click", () => this.onOpen());
    this.again = pill(HIDE.copy.again, 64, true);
    this.again.addEventListener("click", () => this.onAgain());
    this.ending.append(this.open, this.again);
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
    this.catMark = bubbleElement();
    Object.assign(this.catMark.style, {
      transform: "translate(-50%, -100%)",
      padding: "1px 7px",
      fontSize: "14px",
      marginTop: "-4px",
    });
    (this.catMark.lastChild as HTMLElement).style.display = "none";
    for (let i = 0; i < BUBBLES; i++) {
      const el = bubbleElement();
      const bubble: Bubble = { el, where: null, left: 0 };
      this.bubbles.push(bubble);
      parent.append(el);
    }
    parent.append(this.slots, this.hint, this.big, this.ending, this.catMark);
    parent.append(this.stats, this.stamp, ...this.lids);
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

  /** 칸 옆의 전설의 생물 표시(판 위에 있는 동안 깜빡인다) */
  showLegendMark(on: boolean) {
    const m = this.mark;
    m.style.display = on ? "block" : "none";
    for (const a of m.getAnimations?.() ?? []) a.cancel();
    if (on && typeof m.animate === "function")
      m.animate([{ opacity: 1 }, { opacity: 0.25 }, { opacity: 1 }], {
        duration: 900,
        iterations: Infinity,
      });
  }

  /** 칸 밑 한 줄 안내(null 이면 숨긴다) */
  showHint(text: string | null) {
    this.hint.style.display = text ? "block" : "none";
    if (text) this.hint.textContent = text;
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

  /** 판이 끝난 뒤의 단추(아래 가운데): '한 판 더'와, onOpen 이 있으면 '깔까?'도. onAgain 이 null 이면 모두 숨긴다 */
  showEnding(onAgain: (() => void) | null, onOpen: (() => void) | null = null) {
    this.onAgain = onAgain ?? (() => {});
    this.onOpen = onOpen ?? (() => {});
    this.ending.style.display = onAgain ? "flex" : "none";
    this.open.style.display = onOpen ? "block" : "none";
  }

  /** 끝 단추를 잠깐 감춘다(놀이기구에 실려 있는 동안 — 실린 채 광장으로 옮기면 그 놀이기구가 나를 놓지 못한다) */
  setEndingAway(away: boolean) {
    if (away === this.endingAway) return;
    this.endingAway = away;
    this.ending.style.visibility = away ? "hidden" : "visible";
  }

  /** 고양이 머리 위 냄새 표시(… · ! · !!). text 가 null 이면 숨긴다. where 가 프레임마다 붙을 세계 자리를 채운다 */
  setCatMark(text: string | null, where: (out: THREE.Vector3) => void) {
    this.catWhere = text ? where : null;
    if (text) this.catMark.firstChild!.textContent = text;
    else this.catMark.style.display = "none";
  }

  /** ?debug 의 빌드 표시(커밋 앞 7자와 빌드 시각) — 왼쪽 아래 구석에 작게 */
  showStamp(text: string) {
    this.stamp.textContent = text;
    this.stamp.style.display = "block";
  }

  /** 말풍선을 seconds 초 띄운다(통 튀어나온다). where 가 프레임마다 그 말풍선이 붙을 세계 자리를 채운다 */
  bubble(text: string, where: (out: THREE.Vector3) => void, seconds: number) {
    const free = this.bubbles.find((b) => b.left <= 0) ?? this.bubbles[0];
    free.el.firstChild!.textContent = text;
    free.where = where;
    free.left = seconds;
    pop(free.el, 1.2);
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

  /** 한 프레임: 큰 글자의 시간, 말풍선을 세계 자리에 붙인다 */
  update(camera: THREE.Camera, dt: number) {
    if (this.bigLeft > 0) {
      this.bigLeft -= dt;
      if (this.bigLeft <= 0) {
        this.big.style.opacity = "0";
        this.big.style.transform = "translateX(-50%) rotate(-3deg) scale(.5)";
      }
    }
    for (const b of this.bubbles) {
      if (b.left <= 0 || !b.where) continue;
      b.left -= dt;
      b.where(at);
      const isLive = b.left > 0;
      pin(b.el, at, camera, isLive, true);
    }
    if (!this.catWhere) return;
    this.catWhere(at);
    pin(this.catMark, at, camera, true, false);
  }

  /** 잰 값(줄들, null 이면 숨긴다) */
  showStats(lines: readonly string[] | null) {
    const s = this.stats;
    s.style.display = lines ? "block" : "none";
    s.textContent = lines ? lines.join("\n") : "";
  }

  dispose() {
    for (const b of this.bubbles) b.el.remove();
    const own = [this.slots, this.hint, this.big, this.ending, this.catMark, this.stats];
    for (const el of [...own, this.stamp, ...this.lids]) el.remove();
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

// 알약 단추: 라임(먹색 글자) 또는 흰 바탕, 먹색 테두리
function pill(text: string, height: number, isLime: boolean): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  Object.assign(b.style, {
    height: `${height}px`,
    padding: isLime ? "0 40px" : "0 20px",
    borderRadius: "999px",
    border: `3px solid ${INK}`,
    background: isLime ? LIME : "#fff",
    color: INK,
    fontFamily: HUD_FONT,
    fontSize: isLime ? "23px" : "17px",
    fontWeight: "800",
    boxShadow: "0 4px 0 rgba(20,20,20,.25)",
    cursor: "pointer",
    touchAction: "manipulation",
    whiteSpace: "nowrap",
  });
  return b;
}

// 말풍선: 흰 바탕에 먹색 테두리와 글자, 꼬리가 오른쪽 아래에 있어 가리키는 것의 위 왼쪽에 뜬다
function bubbleElement(): HTMLDivElement {
  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "fixed",
    transform: "translate(-82%, -100%)",
    marginTop: "-10px",
    padding: "5px 11px",
    borderRadius: "14px",
    border: `2px solid ${INK}`,
    background: "#fff",
    color: INK,
    fontFamily: HUD_FONT,
    fontSize: "15px",
    fontWeight: "800",
    whiteSpace: "nowrap",
    display: "none",
    zIndex: "3",
    pointerEvents: "none",
  });
  const label = document.createElement("span");
  const tail = document.createElement("div");
  Object.assign(tail.style, {
    position: "absolute",
    right: "14%",
    bottom: "-7px",
    width: "10px",
    height: "10px",
    background: "#fff",
    borderRight: `2px solid ${INK}`,
    borderBottom: `2px solid ${INK}`,
    transform: "rotate(45deg)",
  });
  el.append(label, tail);
  return el;
}

// 세계 자리(at)에 붙는 것을 화면에 놓는다. isLive 가 아니면 숨긴다. 카메라 뒤·화면 밖이면 숨기되,
// atEdge 면 그쪽 화면 가장자리에 붙여 둔다(화면 밖 상자의 재채기가 어느 쪽에서 났는지 보이게)
function pin(
  el: HTMLElement,
  at: THREE.Vector3,
  camera: THREE.Camera,
  isLive: boolean,
  atEdge: boolean,
) {
  at.project(camera);
  const isBehind = at.z >= 1,
    isInside = !isBehind && Math.abs(at.x) < 1.1 && Math.abs(at.y) < 1.1,
    shown = isLive && (isInside || atEdge);
  el.style.display = shown ? "block" : "none";
  if (!shown) return;
  let nx = at.x,
    ny = at.y;
  if (!isInside) {
    // 카메라 뒤의 것은 좌우·위아래가 뒤집혀 나온다 — 되돌리고, 바로 뒤면 화면 아래쪽으로 보낸다. 그 방향으로 가장자리까지 민다
    const flip = isBehind ? -1 : 1,
      down = isBehind ? 1 : 0,
      fx = at.x * flip,
      fy = at.y * flip - down,
      ax = Math.abs(fx),
      ay = Math.abs(fy),
      far = Math.max(ax, ay, 1e-6);
    nx = fx / far;
    ny = fy / far;
  }
  if (atEdge) {
    nx = Math.max(-EDGE_X, nx);
    nx = Math.min(EDGE_X, nx);
    ny = Math.max(-EDGE_DOWN, ny);
    ny = Math.min(EDGE_UP, ny);
  }
  const x = (nx + 1) * 0.5 * innerWidth,
    y = (1 - ny) * 0.5 * innerHeight;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

// 통 튀어나오는 느낌(칸이 찰 때·말풍선이 뜰 때): 제 자리 변환은 그대로 두고 크기만
function pop(el: HTMLElement, peak: number) {
  if (typeof el.animate !== "function") return;
  el.animate([{ scale: "0.5" }, { scale: `${peak}` }, { scale: "0.92" }, { scale: "1" }], {
    duration: 320,
    easing: "ease-out",
  });
}
