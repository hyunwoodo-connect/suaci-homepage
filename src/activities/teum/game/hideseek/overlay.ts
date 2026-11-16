import * as THREE from "three";

import { HUD_FONT } from "../hud";
import type { ItemKind } from "./tuning";
import { HIDE } from "./tuning";

// 숨바꼭질 화면 위 표시. 자리와 크기는 화면 시안(폰 390×844 기준 px)대로, 글은 hideseek.data.json 의 copy, 색은 colors:
//   위 가운데(위에서 56) — 상자 칸 넷(40×40, 간격 10). 빈 칸은 어두운 반투명에 점선, 찬 칸은 라임에 먹색 테두리, 눈으로만 찾은 상자는 금색 테두리
//   칸 밑(위에서 108) — 한 줄 안내(톡 · 칸을 눌러 써 봐). 한 번에 하나
//   한가운데 조금 위(위에서 232) — 큰 글자(라임 바탕·먹색 글자와 테두리, 3도 기울임): 꼭꼭 숨어라 · 술래는 너 · 찾았다! · 깔까? · 우리가 이겼다!
//   아래 양쪽 — 왼쪽 아이템 칸(지름 64, 비면 점선 윤곽), 오른쪽 '못 찾겠다'(높이 52, 조건이 될 때만, 밑에 작게 값)
//   아래 가운데 — 판이 끝난 뒤의 '한 판 더'(해가 졌는데 찾은 것이 있으면 '깔까?'도)
// 그 밖에 세계에 붙는 말풍선(에취! · 킁? · 여기야!), 눈을 가린 손가락 틈(판 시작·언박싱으로 넘어갈 때), 전설의 생물 표시, ?debug 의 잰 값.
// 누르는 칸은 44px 넘게, 라임 위 글자는 먹색

const { lime: LIME, gold: GOLD, ink: INK } = HIDE.colors;
/** 손가락 틈이 닫히고 열리는 시간(초) */
export const HANDS_MOVE = 0.3;
/** 상자 칸 한 변·사이·그 안 상자 그림 한 변(px) */
const CELL = 40,
  GAP = 10,
  ICON = 30;
/** 위에서의 자리(px): 상자 칸 · 한 줄 안내 · 큰 글자 */
const SLOTS_TOP = 56,
  HINT_TOP = 108,
  BIG_TOP = 232;
/** 동시에 뜨는 말풍선 수 · 손가락 수(한 손) */
const BUBBLES = 4,
  FINGERS = 4;

// 칸에 들어가는 상자 그림(먹색 선 — 리본과 귀)
const BOX_ICON = `<svg width="${ICON}" height="${ICON}" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="9.5" width="16" height="10.5" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 9.5v10.5M4 13.5h16M12 9.5c-2-4.5-6.5-4.5-6.5-1.5S10 9.5 12 9.5c2 0 6.5 1.5 6.5-1.5S14 5 12 9.5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
// 전설의 생물이 판 위에 있다는 작은 표시(고래)
const WHALE_ICON =
  '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 13c0-4 3.500-6.500 8-6.500 5 0 7.500 3 9 3.500 1 .300 2-.500 2-2 .800 2.500 0 5-2 6-1.500 3-4.500 4.500-8.500 4.500-5 0-8.500-2-8.500-5.500z" fill="#fff" stroke="#141414" stroke-width="1.600" stroke-linejoin="round"/><circle cx="7.200" cy="12" r="1" fill="#141414"/></svg>';
// 아이템 칸의 생물 그림: 일러바치기(날개 달린 편지) · 깨우기(컵케이크)
const ITEM_ICON: Readonly<Record<ItemKind, string>> = {
  tattle:
    '<svg width="44" height="44" viewBox="0 0 32 32" aria-hidden="true"><g fill="#fff" stroke="#141414" stroke-width="1.6" stroke-linejoin="round"><path d="M10 15c-3.500-5.500-9-3.500-8 .8.600 2.700 4.200 3.700 8 2.200z"/><path d="M22 15c3.500-5.500 9-3.500 8 .8-.600 2.700-4.200 3.700-8 2.200z"/><rect x="8.500" y="11" width="15" height="12" rx="2.500"/></g><path d="M9.200 12.500l6.800 5.200 6.800-5.200" fill="none" stroke="#141414" stroke-width="1.6" stroke-linejoin="round"/><circle cx="13" cy="20" r="1.100" fill="#141414"/><circle cx="19" cy="20" r="1.100" fill="#141414"/></svg>',
  wake: '<svg width="44" height="44" viewBox="0 0 32 32" aria-hidden="true"><g stroke="#141414" stroke-width="1.6" stroke-linejoin="round"><path d="M7.500 15.500c-2.200-6 3.500-10 8.500-10s10.700 4 8.500 10z" fill="#fff"/><circle cx="16" cy="5" r="2" fill="#a9ff39"/><path d="M8.500 15.500h15l-2 11.500h-11z" fill="#fff"/></g><circle cx="13.200" cy="20" r="1.100" fill="#141414"/><circle cx="18.800" cy="20" r="1.100" fill="#141414"/><path d="M14.200 22.800c1.100.900 2.500.900 3.600 0" fill="none" stroke="#141414" stroke-width="1.400" stroke-linecap="round"/></svg>',
};

/** 손가락 틈: 열림 · 틈으로 봄(가운데 60%가 보인다) · 닫힘(암전) */
export type Hands = "open" | "peeking" | "closed";

/** 말풍선 하나: 세계의 어느 자리에 붙는지(프레임마다 묻는다)와 남은 시간 */
interface Bubble {
  el: HTMLDivElement;
  where: ((out: THREE.Vector3) => void) | null;
  left: number;
}

const at = new THREE.Vector3();

/** 숨바꼭질 표시 */
export class HideOverlay {
  private readonly hands: HTMLDivElement;
  private readonly fingers: HTMLDivElement[] = [];
  private readonly slots: HTMLDivElement;
  private readonly cells: HTMLDivElement[] = [];
  private readonly mark: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly big: HTMLDivElement;
  private readonly item: HTMLButtonElement;
  private readonly giveUp: HTMLDivElement;
  private readonly ending: HTMLDivElement;
  private readonly open: HTMLButtonElement;
  private readonly again: HTMLButtonElement;
  private readonly stats: HTMLDivElement;
  private readonly bubbles: Bubble[] = [];
  private readonly flying = new Set<HTMLElement>();
  private onOpen: () => void = () => {};
  private onAgain: () => void = () => {};
  private onItem: () => void = () => {};
  private onGiveUp: () => void = () => {};
  private endingAway = false;
  private bigLeft = 0;

  constructor(private readonly parent: HTMLElement) {
    this.hands = document.createElement("div");
    Object.assign(this.hands.style, {
      position: "fixed",
      inset: "0",
      zIndex: "6",
      pointerEvents: "none",
      background: "rgba(20,20,20,0)",
      transition: `background ${HANDS_MOVE}s ease-in`,
    });
    // 손가락: 양쪽 가장자리에서 가운데로 뻗는 둥근 막대 넷씩. 사이사이 틈으로 세상이 보인다
    for (let i = 0; i < FINGERS * 2; i++) {
      const isLeft = i < FINGERS,
        row = i % FINGERS;
      const finger = document.createElement("div");
      Object.assign(finger.style, {
        position: "absolute",
        top: `${row * 25 + 1.5}%`,
        height: "22%",
        width: "0%",
        background: INK,
        opacity: "0.9",
        borderRadius: isLeft ? "0 999px 999px 0" : "999px 0 0 999px",
        transition: `width ${HANDS_MOVE}s cubic-bezier(.4,0,.2,1)`,
      });
      if (isLeft) finger.style.left = "0";
      else finger.style.right = "0";
      this.fingers.push(finger);
      this.hands.append(finger);
    }
    this.slots = document.createElement("div");
    Object.assign(this.slots.style, {
      position: "fixed",
      top: `max(${SLOTS_TOP}px, calc(env(safe-area-inset-top) + 12px))`,
      left: "50%",
      transform: "translateX(-50%)",
      display: "none",
      gap: `${GAP}px`,
      zIndex: "3",
      pointerEvents: "none",
    });
    for (let i = 0; i < 4; i++) {
      const cell = document.createElement("div");
      Object.assign(cell.style, {
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
    this.mark = document.createElement("div");
    this.mark.innerHTML = WHALE_ICON;
    Object.assign(this.mark.style, {
      position: "absolute",
      left: "100%",
      top: "7px",
      marginLeft: "8px",
      display: "none",
    });
    this.slots.append(this.mark);
    this.hint = document.createElement("div");
    Object.assign(this.hint.style, {
      position: "fixed",
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
    this.big = document.createElement("div");
    Object.assign(this.big.style, {
      position: "fixed",
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
    this.item = document.createElement("button");
    this.item.type = "button";
    Object.assign(this.item.style, {
      position: "fixed",
      left: "calc(20px + env(safe-area-inset-left))",
      bottom: "calc(44px + env(safe-area-inset-bottom))",
      width: "64px",
      height: "64px",
      padding: "0",
      borderRadius: "50%",
      boxSizing: "border-box",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      touchAction: "manipulation",
      zIndex: "4",
    });
    this.item.addEventListener("click", () => this.onItem());
    this.giveUp = document.createElement("div");
    Object.assign(this.giveUp.style, {
      position: "fixed",
      right: "calc(20px + env(safe-area-inset-right))",
      bottom: "calc(14px + env(safe-area-inset-bottom))",
      display: "none",
      flexDirection: "column",
      alignItems: "center",
      gap: "5px",
      zIndex: "4",
    });
    const giveUpButton = pill(HIDE.copy.giveUp, 52, false);
    giveUpButton.addEventListener("click", () => this.onGiveUp());
    const cost = document.createElement("div");
    cost.textContent = HIDE.copy.giveUpCost;
    Object.assign(cost.style, {
      height: "17px",
      fontFamily: HUD_FONT,
      fontSize: "12px",
      fontWeight: "600",
      color: "#fff",
      textShadow: "0 1px 4px rgba(0,0,0,.6)",
      pointerEvents: "none",
    });
    this.giveUp.append(giveUpButton, cost);
    this.ending = document.createElement("div");
    Object.assign(this.ending.style, {
      position: "fixed",
      left: "50%",
      bottom: "calc(36px + env(safe-area-inset-bottom))",
      transform: "translateX(-50%)",
      display: "none",
      gap: "10px",
      zIndex: "4",
    });
    this.open = pill(HIDE.copy.open, 56, false);
    this.open.addEventListener("click", () => this.onOpen());
    this.again = pill(HIDE.copy.again, 56, true);
    this.again.addEventListener("click", () => this.onAgain());
    this.ending.append(this.open, this.again);
    this.stats = document.createElement("div");
    Object.assign(this.stats.style, {
      position: "fixed",
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
    for (let i = 0; i < BUBBLES; i++) {
      const el = bubbleElement();
      const bubble: Bubble = { el, where: null, left: 0 };
      this.bubbles.push(bubble);
      parent.append(el);
    }
    parent.append(this.slots, this.hint, this.big, this.item, this.giveUp, this.ending);
    parent.append(this.stats, this.hands);
    this.resetSlots();
    this.setItem(null);
  }

  /** 눈을 가린 손가락 틈: 열림 · 틈으로 봄(양쪽 가장자리 20%씩 가리고 가운데는 보인다) · 닫힘(암전) */
  setHands(hands: Hands) {
    const reach = hands === "open" ? 0 : hands === "peeking" ? 20 : 56;
    this.fingers.forEach((finger, i) => {
      // 손가락마다 길이가 조금씩 다르다
      const extra = hands === "peeking" ? (i % FINGERS) % 2 : 0;
      finger.style.width = `${reach + extra * 3}%`;
    });
    this.hands.style.background = hands === "closed" ? "rgba(20,20,20,1)" : "rgba(20,20,20,0)";
  }

  /** 위 가운데 상자 칸 넷을 보이거나 숨긴다 */
  showSlots(on: boolean) {
    this.slots.style.display = on ? "flex" : "none";
  }

  /** 칸을 모두 비운다(판 시작) */
  resetSlots() {
    for (const el of this.flying) el.remove();
    this.flying.clear();
    for (const cell of this.cells) {
      cell.replaceChildren();
      cell.style.border = "2px dashed rgba(255,255,255,.75)";
      cell.style.background = "rgba(20,20,20,.38)";
      cell.style.boxShadow = "none";
    }
    this.slots.setAttribute("aria-label", "찾은 상자 없음");
  }

  /**
   * i 번째 칸을 채운다. from(화면 좌표)이 있으면 상자 그림이 거기서 칸으로 포물선을 그리며 seconds 동안 날아와(꼬리에 라임 반짝이) 착 들어가고 칸이 출렁인다.
   * eyes: 눈으로만 찾은 상자 — 금색 테두리가 반짝 돌아간다
   */
  fillSlot(i: number, eyes: boolean, from: { x: number; y: number } | null, seconds: number) {
    const cell = this.cells[i];
    if (!cell) return;
    const fill = () => {
      cell.style.border = `3px solid ${eyes ? GOLD : INK}`;
      cell.style.background = LIME;
      cell.innerHTML = BOX_ICON;
      pop(cell, 1.25);
      if (eyes) glint(cell);
    };
    this.slots.setAttribute("aria-label", `상자 ${i + 1}개 찾음`);
    if (!from || typeof cell.animate !== "function") {
      fill();
      return;
    }
    const to = cell.getBoundingClientRect();
    const dx = from.x - to.left - CELL / 2,
      dy = from.y - to.top - CELL / 2,
      ms = seconds * 1000;
    // 포물선: 가로는 고르게, 세로는 먼저 솟았다가 칸으로
    const midX = dx * 0.5,
      low = Math.min(dy, 0),
      midY = low - 70;
    const path = [
      { transform: `translate(${dx}px, ${dy}px) scale(1.6) rotate(-20deg)`, offset: 0 },
      { transform: `translate(${midX}px, ${midY}px) scale(1.25) rotate(160deg)`, offset: 0.55 },
      { transform: "translate(0, 0) scale(1) rotate(360deg)", offset: 1 },
    ];
    for (let k = 0; k < 4; k++) {
      const size = 10 + k * 2,
        delay = 40 + k * 45;
      const spark = this.ghost(to, size, "50%");
      spark.style.opacity = "0.85";
      const trail = spark.animate(path, { duration: ms, delay, fill: "backwards" });
      trail.onfinish = () => this.land(spark);
    }
    const ghost = this.ghost(to, CELL, "10px");
    ghost.innerHTML = BOX_ICON;
    ghost.style.border = `3px solid ${INK}`;
    const flight = ghost.animate(path, { duration: ms, easing: "ease-in" });
    flight.onfinish = () => {
      if (this.land(ghost)) fill();
    };
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

  /** 왼쪽 아래 아이템 칸을 보이거나 숨긴다 */
  showItemSlot(on: boolean) {
    this.item.style.display = on ? "flex" : "none";
  }

  /**
   * 아이템 칸에 든 것(null 이면 비어 점선 윤곽). 누르면 onPress.
   * from(화면 좌표)이 있으면 그 생물 그림이 거기서 칸으로 빨려 들어오고 칸이 출렁인다
   */
  setItem(
    kind: ItemKind | null,
    onPress: () => void = () => {},
    from: { x: number; y: number } | null = null,
  ) {
    this.onItem = onPress;
    const b = this.item;
    b.innerHTML = kind ? ITEM_ICON[kind] : "";
    b.style.background = kind ? "#fff" : "rgba(20,20,20,.18)";
    b.style.border = kind ? `3px solid ${INK}` : "2px dashed rgba(255,255,255,.75)";
    b.style.boxShadow = kind ? "0 4px 0 rgba(20,20,20,.25)" : "none";
    b.style.cursor = kind ? "pointer" : "default";
    b.style.pointerEvents = kind ? "auto" : "none";
    const use = kind === "tattle" ? "일러바치기 쓰기" : "깨우기 쓰기",
      label = kind ? use : "아이템 칸(비었음)";
    b.setAttribute("aria-label", label);
    if (!kind) return;
    pop(b, 1.25);
    const icon = b.firstElementChild as HTMLElement | null;
    if (!from || !icon || typeof icon.animate !== "function") return;
    const to = b.getBoundingClientRect();
    const dx = from.x - to.left - to.width / 2,
      dy = from.y - to.top - to.height / 2;
    icon.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(1.8)`, opacity: 0.6 },
        { transform: "translate(0, 0) scale(1)", opacity: 1 },
      ],
      { duration: 500, easing: "cubic-bezier(.5,-0.4,.3,1)" },
    );
  }

  /** 오른쪽 아래 '못 찾겠다'(누르면 onPress) */
  showGiveUp(on: boolean, onPress: () => void = () => {}) {
    this.onGiveUp = onPress;
    this.giveUp.style.display = on ? "flex" : "none";
  }

  /** 말풍선을 seconds 초 띄운다(통 튀어나온다). where 가 프레임마다 그 말풍선이 붙을 세계 자리를 채운다 */
  bubble(text: string, where: (out: THREE.Vector3) => void, seconds: number) {
    const free = this.bubbles.find((b) => b.left <= 0) ?? this.bubbles[0];
    free.el.firstChild!.textContent = text;
    free.where = where;
    free.left = seconds;
    pop(free.el, 1.2);
  }

  /** 화면이 살짝 흔들린다(큰 생물의 울음·금색 상자가 쿵) */
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
      at.project(camera);
      const shown = b.left > 0 && at.z < 1 && Math.abs(at.x) < 1.1 && Math.abs(at.y) < 1.1;
      b.el.style.display = shown ? "block" : "none";
      if (!shown) continue;
      const x = (at.x + 1) * 0.5 * innerWidth,
        y = (1 - at.y) * 0.5 * innerHeight;
      b.el.style.left = `${x}px`;
      b.el.style.top = `${y}px`;
    }
  }

  /** 잰 값(줄들, null 이면 숨긴다) */
  showStats(lines: readonly string[] | null) {
    const s = this.stats;
    s.style.display = lines ? "block" : "none";
    s.textContent = lines ? lines.join("\n") : "";
  }

  dispose() {
    for (const el of this.flying) el.remove();
    for (const b of this.bubbles) b.el.remove();
    const own = [this.hands, this.slots, this.hint, this.big, this.item, this.giveUp, this.ending];
    for (const el of own) el.remove();
    this.stats.remove();
  }

  // 칸으로 날아가는 그림 하나(칸 자리에 두고 움직임으로 옮긴다)
  private ghost(to: DOMRect, size: number, radius: string): HTMLDivElement {
    const el = document.createElement("div");
    const inset = (CELL - size) / 2;
    Object.assign(el.style, {
      position: "fixed",
      left: `${to.left + inset}px`,
      top: `${to.top + inset}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: radius,
      background: LIME,
      color: INK,
      boxSizing: "border-box",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "5",
      pointerEvents: "none",
    });
    this.parent.append(el);
    this.flying.add(el);
    return el;
  }

  // 다 날아온 그림을 치운다. 이미 치워졌으면(새 판) false
  private land(el: HTMLElement): boolean {
    if (!this.flying.delete(el)) return false;
    el.remove();
    return true;
  }
}

/* ─── 내부 ─────────────────────────── */

// 알약 단추: 라임(먹색 글자) 또는 흰 바탕, 먹색 테두리
function pill(text: string, height: number, isLime: boolean): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  Object.assign(b.style, {
    height: `${height}px`,
    padding: isLime ? "0 34px" : "0 20px",
    borderRadius: "999px",
    border: `3px solid ${INK}`,
    background: isLime ? LIME : "#fff",
    color: INK,
    fontFamily: HUD_FONT,
    fontSize: isLime ? "20px" : "17px",
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

// 눈으로만 찾은 상자: 금색 테두리가 반짝 돌아간다(빛이 테두리를 한 바퀴 돈다)
function glint(cell: HTMLElement) {
  if (typeof cell.animate !== "function") return;
  cell.animate(
    [
      { boxShadow: `0 0 0 0 ${GOLD}, 0 0 0 0 #fff` },
      { boxShadow: `0 0 0 5px ${GOLD}, 0 0 14px 6px #fff` },
      { boxShadow: `0 0 0 0 ${GOLD}, 0 0 0 0 #fff` },
    ],
    { duration: 700, iterations: 2 },
  );
  cell.style.boxShadow = `0 0 0 1.5px ${GOLD}`;
}

// 통 튀어나오는 느낌(칸이 찰 때·말풍선이 뜰 때): 제 자리 변환은 그대로 두고 크기만
function pop(el: HTMLElement, peak: number) {
  if (typeof el.animate !== "function") return;
  el.animate([{ scale: "0.5" }, { scale: `${peak}` }, { scale: "0.92" }, { scale: "1" }], {
    duration: 320,
    easing: "ease-out",
  });
}
