import * as THREE from "three";

import { HUD_FONT } from "../hud";
import { HIDE } from "./tuning";

// 숨바꼭질 화면 위 표시. 자리와 크기는 화면 시안(폰 390×844 기준 px)대로, 글은 hideseek.data.json 의 copy, 색은 colors.
// 판이 도는 동안 화면에 늘 떠 있는 것은 위 칸 넷뿐이다(안내 줄·기호 말풍선은 없다 — 무엇을 할지는 몸짓과 고리로 보인다):
//   위 가운데(위에서 56) — 상자 칸 넷(40×40, 간격 10). 빈 칸은 어두운 반투명에 점선, 찬 칸은 라임에 먹색 테두리(찰 때 출렁인다)
//   한가운데 조금 위(위에서 232) — 큰 글자(라임 바탕·먹색 글자와 테두리, 3도 기울임): 꼭꼭 숨어라 · 술래는 너 · 찾았다! · 깔까? · 우리가 이겼다!
//   아래 가운데 — 판이 끝난 뒤의 '한 판 더'(가장 큰 단추. 해가 졌는데 찾은 것이 있으면 작은 '깔까?'도)
// 잠깐 뜨는 것: 세계에 붙는 말풍선(상자의 에취! · 점호의 숫자), 화면 밖에서 무언가 지나간 쪽의 먼지 퐁, 가르쳐 주는 손가락,
// 전설이 화면 밖에 나타난 쪽 가장자리의 금빛, 회중시계가 해를 되감을 때 가장자리를 반시계로 도는 빛 띠, 눈꺼풀(판 시작·언박싱으로 넘어갈 때),
// ?debug 의 잰 값과 빌드 표시. 누르는 칸은 44px 넘게, 라임 위 글자는 먹색

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
/** 위에서의 자리(px): 상자 칸 · 큰 글자 */
const SLOTS_TOP = 56,
  BIG_TOP = 232;
/** 전설이 화면 밖에 나타났을 때 그쪽 가장자리가 금빛인 시간(초)·흘러드는 빛가루 수·흘러드는 거리(px)·한 바퀴(초) */
const EDGE_SECONDS = 3,
  EDGE_DUST = 7,
  EDGE_FLOW = 140,
  EDGE_CYCLE = 1.1;
/** 동시에 뜨는 말풍선 수(점호에 넷이 같이 대답한다) · 먼지 퐁퐁 수·떠 있는 시간(초) */
const BUBBLES = 8,
  PUFFS = 4,
  PUFF_TIME = 0.8;
// 누르기 안내 손가락(먹색 선, 흰 바탕)
const FINGER_ICON = `<svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15c0 3.3-2.2 6-5.5 6-2.4 0-3.8-1-5.2-3L5.2 15c-.8-1.3.9-2.6 2-1.5L9 15" fill="#fff" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;

// 칸에 들어가는 상자 그림(먹색 선 — 리본과 귀)
const BOX_ICON = `<svg width="${ICON}" height="${ICON}" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="9.5" width="16" height="10.5" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9.5v10.5M4 13.5h16M12 9.5c-2-4.5-6.5-4.5-6.5-1.5S10 9.5 12 9.5c2 0 6.5 1.5 6.5-1.5S14 5 12 9.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
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
  private readonly big: HTMLDivElement;
  private readonly ending: HTMLDivElement;
  private readonly open: HTMLButtonElement;
  private readonly again: HTMLButtonElement;
  private readonly stats: HTMLDivElement;
  private readonly stamp: HTMLDivElement;
  private readonly bubbles: Bubble[] = [];
  private readonly puffs: Bubble[] = [];
  private readonly pointer: HTMLDivElement;
  private pointerWhere: ((out: THREE.Vector3) => void) | null = null;
  /** 전설이 화면 밖에 나타난 쪽: 가장자리 금빛 · 흘러드는 빛가루 · 붙을 세계 자리 · 남은 시간(초) · 흐른 시간 */
  private readonly edge: HTMLDivElement;
  private readonly edgeDust: HTMLDivElement[] = [];
  private edgeWhere: ((out: THREE.Vector3) => void) | null = null;
  private edgeLeft = 0;
  private edgeT = 0;
  /** 회중시계의 빛 띠(가장자리를 반시계로 한 바퀴) */
  private readonly band: HTMLDivElement;
  private readonly bandSpin: HTMLDivElement;
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
    this.edge = fixedBox({
      inset: "0",
      display: "none",
      zIndex: "2",
      pointerEvents: "none",
    });
    for (let i = 0; i < EDGE_DUST; i++) {
      const dot = styledBox({
        position: "fixed",
        width: "7px",
        height: "7px",
        borderRadius: "50%",
        background: "#ffe08a",
        boxShadow: "0 0 8px 2px rgba(255,209,102,.8)",
        display: "none",
        zIndex: "2",
        pointerEvents: "none",
        transform: "translate(-50%, -50%)",
      });
      this.edgeDust.push(dot);
    }
    this.band = fixedBox({
      inset: "0",
      overflow: "hidden",
      opacity: "0",
      zIndex: "2",
      pointerEvents: "none",
    });
    const edgeOnly = "radial-gradient(ellipse at center, transparent 58%, #000 78%)";
    this.band.style.setProperty("mask-image", edgeOnly);
    this.band.style.setProperty("-webkit-mask-image", edgeOnly);
    this.bandSpin = styledBox({
      position: "absolute",
      left: "50%",
      top: "50%",
      width: "220vmax",
      height: "220vmax",
      marginLeft: "-110vmax",
      marginTop: "-110vmax",
      background:
        "conic-gradient(from 0deg, rgba(255,255,255,0) 0deg, rgba(255,255,255,.75) 50deg, rgba(255,255,255,0) 100deg, rgba(255,255,255,0) 360deg)",
    });
    this.band.append(this.bandSpin);
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
    for (let i = 0; i < BUBBLES; i++) {
      const el = bubbleElement();
      const bubble: Bubble = { el, where: null, left: 0 };
      this.bubbles.push(bubble);
      parent.append(el);
    }
    for (let i = 0; i < PUFFS; i++) {
      const el = puffElement();
      const puff: Bubble = { el, where: null, left: 0 };
      this.puffs.push(puff);
      parent.append(el);
    }
    this.pointer = styledBox({
      position: "fixed",
      display: "none",
      zIndex: "3",
      pointerEvents: "none",
      transform: "translate(-30%, 10%)",
    });
    this.pointer.innerHTML = FINGER_ICON;
    parent.append(this.pointer);
    parent.append(this.edge, ...this.edgeDust, this.band);
    parent.append(this.slots, this.big, this.ending);
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

  /** 전설이 나타났다: 화면 밖이면 where 쪽 가장자리가 3초 동안 금빛으로 은은하고 빛가루가 흘러든다 */
  legendEdge(where: (out: THREE.Vector3) => void) {
    this.edgeWhere = where;
    this.edgeLeft = EDGE_SECONDS;
    this.edgeT = 0;
  }

  /** 회중시계: 화면 가장자리에 옅은 빛 띠가 seconds 동안 반시계로 한 바퀴 */
  rewindBand(seconds: number) {
    const band = this.band,
      spin = this.bandSpin,
      ms = seconds * 1000;
    if (typeof band.animate !== "function" || typeof spin.animate !== "function") return;
    band.animate(
      [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.75 }, { opacity: 0 }],
      {
        duration: ms,
      },
    );
    spin.animate([{ transform: "rotate(0deg)" }, { transform: "rotate(-360deg)" }], {
      duration: ms,
      easing: "ease-in-out",
    });
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

  /** 화면 밖에서 무언가 지나갔다: where 쪽 화면 가장자리에 먼지가 퐁 오른다 */
  puff(where: (out: THREE.Vector3) => void) {
    const free = this.puffs.find((b) => b.left <= 0) ?? this.puffs[0];
    free.where = where;
    free.left = PUFF_TIME;
    pop(free.el, 1.4);
  }

  /** 누르기 안내 손가락: where 위에서 톡톡(null 이면 숨긴다) */
  setPointer(where: ((out: THREE.Vector3) => void) | null) {
    const isNew = where !== null && this.pointerWhere === null;
    this.pointerWhere = where;
    if (!where) this.pointer.style.display = "none";
    if (!isNew || typeof this.pointer.animate !== "function") return;
    for (const a of this.pointer.getAnimations?.() ?? []) a.cancel();
    this.pointer.animate([{ marginTop: "0px" }, { marginTop: "10px" }, { marginTop: "0px" }], {
      duration: 700,
      iterations: Infinity,
    });
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
    for (const b of this.puffs) {
      if (b.left <= 0 || !b.where) continue;
      b.left -= dt;
      b.where(at);
      const isLive = b.left > 0;
      pin(b.el, at, camera, isLive, true);
      b.el.style.opacity = `${Math.max(0, b.left / PUFF_TIME)}`;
    }
    if (this.pointerWhere) {
      this.pointerWhere(at);
      pin(this.pointer, at, camera, true, false);
    }
    this.showEdge(camera, dt);
  }

  // 전설이 화면 밖이면 그쪽 가장자리가 금빛(남은 시간 동안 옅어진다), 빛가루가 그쪽에서 화면 안으로 흘러든다
  private showEdge(camera: THREE.Camera, dt: number) {
    const where = this.edgeWhere;
    if (where) this.edgeLeft -= dt;
    this.edgeT += dt;
    let isShown = false,
      x = 0,
      y = 0,
      nx = 0,
      ny = 0;
    if (where && this.edgeLeft > 0) {
      where(at);
      at.project(camera);
      const isBehind = at.z >= 1,
        isInside = !isBehind && Math.abs(at.x) < 1 && Math.abs(at.y) < 1;
      if (!isInside) {
        const flip = isBehind ? -1 : 1,
          fx = at.x * flip,
          fy = at.y * flip,
          ax = Math.abs(fx),
          ay = Math.abs(fy),
          far = Math.max(ax, ay, 1e-6);
        nx = fx / far;
        ny = fy / far;
        x = (nx + 1) * 0.5 * innerWidth;
        y = (1 - ny) * 0.5 * innerHeight;
        isShown = true;
      }
    }
    if (!where || this.edgeLeft <= 0) this.edgeWhere = null;
    this.edge.style.display = isShown ? "block" : "none";
    for (const d of this.edgeDust) d.style.display = isShown ? "block" : "none";
    if (!isShown) return;
    const fading = this.edgeLeft / 0.8,
      fade = Math.min(1, fading);
    this.edge.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,209,102,${0.55 * fade}) 0, rgba(255,209,102,0) 45vmin)`;
    // 화면 안쪽으로 흘러든다
    const len = Math.hypot(nx, ny) || 1,
      inX = -nx / len,
      inY = ny / len;
    this.edgeDust.forEach((d, i) => {
      const phase = (this.edgeT / EDGE_CYCLE + i / EDGE_DUST) % 1,
        spread = ((i * 37) % 11) - 5,
        along = phase * EDGE_FLOW,
        px = x + inX * along - inY * spread * 9,
        py = y + inY * along + inX * spread * 9;
      d.style.left = `${px}px`;
      d.style.top = `${py}px`;
      d.style.opacity = `${(1 - phase) * fade}`;
    });
  }

  /** 잰 값(줄들, null 이면 숨긴다) */
  showStats(lines: readonly string[] | null) {
    const s = this.stats;
    s.style.display = lines ? "block" : "none";
    s.textContent = lines ? lines.join("\n") : "";
  }

  dispose() {
    for (const b of [...this.bubbles, ...this.puffs]) b.el.remove();
    this.pointer.remove();
    const own = [this.slots, this.big, this.ending, this.stats, this.edge, this.band];
    for (const el of [...own, ...this.edgeDust, this.stamp, ...this.lids]) el.remove();
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

// 먼지 퐁(화면 밖에서 무언가 지나갔다): 흰 구름 세 덩이
function puffElement(): HTMLDivElement {
  const el = styledBox({
    position: "fixed",
    width: "34px",
    height: "22px",
    transform: "translate(-50%, -50%)",
    background:
      "radial-gradient(circle at 25% 65%, #fff 0 30%, transparent 32%), radial-gradient(circle at 55% 40%, #fff 0 36%, transparent 38%), radial-gradient(circle at 80% 68%, #fff 0 28%, transparent 30%)",
    filter: "drop-shadow(0 1px 2px rgba(20,20,20,.45))",
    display: "none",
    zIndex: "3",
    pointerEvents: "none",
  });
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
