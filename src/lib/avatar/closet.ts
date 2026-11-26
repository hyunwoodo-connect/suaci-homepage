import type { ClosetLabels } from "./closet-labels";
import type { AvatarLook, LookTab } from "./outfit";
import { isPartTab, isPrint, LOOK_TABS, optionsFor, printKey } from "./outfit";
import { thumbKey } from "./parts";

// 꾸미기 씬의 화면: 세상에서 여는 옷장 단추, 무대(밀어서 돌리기·되돌리기·아무거나), 아래 옷장(탭·칸·완성).
// 무엇을 할지는 꾸미기 씬(Studio)이 정한다 — 여기는 그리고, 눌린 것을 알리기만 한다. 누르는 칸은 44px 이상

/** 옷장 글자의 글꼴(놀이 화면 글자와 같은 시스템 글꼴) */
const FONT = '-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Noto Sans KR",sans-serif';
const INK = "#2b2e2d",
  LIME = "#a9ff39",
  CHIP = "#eef1f0";

/**
 * 옷장 판이 오르내리는 움직임. 닫힐 때는 다 내려간 뒤에 숨긴다 — 화면 밖에 내려가 있어도 판의 그림자가 화면 맨 아래에 비치기 때문이다
 * (열릴 때는 바로 보여야 올라오는 것이 보인다)
 */
const SHEET_OPENING = "transform .25s",
  SHEET_CLOSING = "transform .25s, visibility 0s linear .25s";

/** 옷 단추 그림(티셔츠) */
const SHIRT_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 4 4 6.5 5.6 10.4 7.5 9.6V20h9V9.6l1.9.8L20 6.5 15.5 4a3.5 3.5 0 0 1-7 0z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

/** 눌린 것을 알리는 곳 */
interface ClosetHandlers {
  /** 세상의 옷장 단추 */
  onOpen(): void;
  onPick(tab: LookTab, value: string): void;
  onUndo(): void;
  onShuffle(): void;
  /** 완성 — 세상으로 */
  onDone(): void;
  /** 무대를 가로로 민 만큼(px) */
  onTurn(dx: number): void;
}

/** 옷장 화면 */
export class Closet {
  /** 닫혀 있을 때 화면 구석에 떠 있는 옷장 단추(제 단추로 여는 곳에는 없다) */
  private readonly wearButton: HTMLButtonElement | null;
  private readonly stage: HTMLDivElement;
  private readonly tip: HTMLDivElement;
  private readonly sheet: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly tabs = new Map<LookTab, HTMLButtonElement>();
  private tab: LookTab = "top";
  private look: Readonly<AvatarLook> | null = null;

  /**
   * urlOf: 에셋 키 → 받을 주소(없는 키면 null). hasWearButton: 닫혀 있을 때 화면 구석에 옷장 단추를 띄운다.
   * labels: 옷장에 쓸 글자(여는 화면의 언어)
   */
  constructor(
    parent: HTMLElement,
    private readonly urlOf: (key: string) => string | null,
    private readonly on: ClosetHandlers,
    hasWearButton: boolean,
    private readonly labels: ClosetLabels,
  ) {
    this.wearButton = hasWearButton ? wearButton(labels.wear, on) : null;

    // 무대: 화면을 덮어 게임 입력을 막고, 가로로 밀면 아바타 둘레를 돈다
    this.stage = document.createElement("div");
    Object.assign(this.stage.style, {
      position: "fixed",
      inset: "0",
      zIndex: "3",
      display: "none",
      touchAction: "none",
    });
    const undo = roundButton(labels.undo, "↶");
    Object.assign(undo.style, {
      position: "absolute",
      top: "calc(14px + env(safe-area-inset-top))",
      left: "14px",
    });
    undo.addEventListener("click", () => on.onUndo());
    const shuffle = roundButton(labels.shuffle, "⚄");
    Object.assign(shuffle.style, {
      position: "absolute",
      top: "calc(14px + env(safe-area-inset-top))",
      right: "14px",
    });
    shuffle.addEventListener("click", () => on.onShuffle());
    this.tip = document.createElement("div");
    this.tip.textContent = labels.turnTip;
    Object.assign(this.tip.style, {
      position: "absolute",
      left: "0",
      right: "0",
      top: "calc(28px + env(safe-area-inset-top))",
      textAlign: "center",
      fontSize: "13px",
      fontFamily: FONT,
      color: "rgba(43,46,45,.6)",
      pointerEvents: "none",
      transition: "opacity .4s",
    });
    this.stage.append(undo, this.tip, shuffle);
    this.listenTurn();

    // 옷장: 아래에서 올라오는 판. 탭 줄(옆으로 밀린다) + 완성, 그 아래 칸들
    this.sheet = document.createElement("div");
    Object.assign(this.sheet.style, {
      position: "fixed",
      left: "0",
      right: "0",
      bottom: "0",
      background: "rgba(255,255,255,.96)",
      borderRadius: "18px 18px 0 0",
      padding: "10px 14px calc(16px + env(safe-area-inset-bottom))",
      boxShadow: "0 -6px 24px rgba(0,0,0,.1)",
      transform: "translateY(105%)",
      transition: SHEET_CLOSING,
      visibility: "hidden",
      zIndex: "4",
      fontFamily: FONT,
    });
    // 닫혀 있는 판은 화면 밖에 있을 뿐 문서에는 남는다 — 키보드 초점과 화면 읽기가 닿지 않게 한다
    this.sheet.inert = true;
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      gap: "6px",
      alignItems: "center",
      marginBottom: "8px",
    });
    const tabRow = document.createElement("div");
    Object.assign(tabRow.style, {
      display: "flex",
      gap: "6px",
      overflowX: "auto",
      flex: "1",
      minWidth: "0",
      scrollbarWidth: "none",
    });
    for (const t of LOOK_TABS) {
      const b = pill(labels.tabs[t]);
      b.addEventListener("click", () => {
        this.tab = t;
        this.redraw();
      });
      this.tabs.set(t, b);
      tabRow.append(b);
    }
    const done = pill(labels.done);
    Object.assign(done.style, { background: LIME, color: INK, fontWeight: "600" });
    done.addEventListener("click", () => on.onDone());
    row.append(tabRow, done);
    this.grid = document.createElement("div");
    Object.assign(this.grid.style, {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill,minmax(62px,1fr))",
      gap: "10px",
      maxHeight: "158px",
      overflowY: "auto",
      padding: "4px 3px 6px",
    });
    this.sheet.append(row, this.grid);
    if (this.wearButton) parent.append(this.wearButton);
    parent.append(this.stage, this.sheet);
  }

  /** 꾸미기 씬을 열고 닫는다(열면 옷장 단추는 숨는다) */
  show(on: boolean, look: Readonly<AvatarLook>) {
    if (this.wearButton) this.wearButton.style.display = on ? "none" : "";
    this.stage.style.display = on ? "block" : "none";
    this.sheet.style.transition = on ? SHEET_OPENING : SHEET_CLOSING;
    this.sheet.style.transform = on ? "none" : "translateY(105%)";
    this.sheet.style.visibility = on ? "visible" : "hidden";
    this.sheet.inert = !on;
    if (!on) return;
    this.tip.style.opacity = "1";
    this.draw(look);
  }

  /** 지금 차림으로 칸을 다시 그린다 */
  draw(look: Readonly<AvatarLook>) {
    this.look = look;
    this.redraw();
  }

  /** 밀면 돌아간다는 안내를 숨긴다(한 번 밀면) */
  hideTip() {
    this.tip.style.opacity = "0";
  }

  dispose() {
    this.wearButton?.remove();
    this.stage.remove();
    this.sheet.remove();
  }

  private redraw() {
    const look = this.look;
    if (!look) return;
    for (const [t, b] of this.tabs) {
      const isOn = t === this.tab;
      b.style.background = isOn ? INK : CHIP;
      b.style.color = isOn ? "#fff" : INK;
      const pressed = String(isOn);
      b.setAttribute("aria-pressed", pressed);
    }
    const tab = this.tab;
    // 칸을 새로 그리면 누르던 단추가 사라진다 — 같은 값의 새 단추로 초점을 옮긴다(키보드·화면 읽기)
    const focused = document.activeElement,
      refocus =
        focused instanceof HTMLElement && this.grid.contains(focused)
          ? focused.dataset.value
          : undefined;
    this.grid.replaceChildren(
      ...optionsFor(tab).map((value) => {
        const b = document.createElement("button");
        b.type = "button";
        const isOn = look[tab] === value;
        Object.assign(b.style, {
          aspectRatio: "1",
          width: "100%",
          borderRadius: "16px",
          border: "3px solid #fff",
          boxShadow: isOn ? `0 0 0 3px ${INK}` : "0 0 0 1px #d6d9d8",
          background: "#fff center/cover",
          padding: "0",
          fontSize: "11px",
          color: "#6c7170",
          fontFamily: FONT,
          cursor: "pointer",
        });
        this.paint(b, tab, value);
        const label = this.optionLabel(tab, value),
          pressed = String(isOn);
        b.setAttribute("aria-label", label);
        b.setAttribute("aria-pressed", pressed);
        b.dataset.value = value;
        b.addEventListener("click", () => this.on.onPick(tab, value));
        return b;
      }),
    );
    if (refocus === undefined) return;
    for (const b of this.grid.querySelectorAll("button"))
      if (b.dataset.value === refocus) b.focus();
  }

  // 칸의 그림: 소품은 옷장 칸 그림, 무늬는 무늬 그림, 색은 그 색, 기본 윗옷은 원래 스웨터의 분홍·라임
  private paint(b: HTMLButtonElement, tab: LookTab, value: string) {
    if (isPartTab(tab)) {
      const thumb = value ? thumbKey(value) : null,
        url = thumb ? this.urlOf(thumb) : null;
      if (url) b.style.backgroundImage = `url("${url}")`;
      else {
        b.style.background = CHIP;
        b.textContent = this.optionLabel(tab, value);
      }
      return;
    }
    if (isPrint(value)) {
      const key = printKey(value),
        url = this.urlOf(key);
      if (url) b.style.backgroundImage = `url("${url}")`;
      return;
    }
    if (value) b.style.background = value;
    else if (tab === "top") b.style.background = "linear-gradient(135deg,#ff2f8e 50%,#a9ff39 50%)";
  }

  // 칸의 읽는 이름: 고른 것의 이름, 비운 칸은 '없음'(소품)·'원래 옷'(옷)
  private optionLabel(tab: LookTab, value: string): string {
    const labels = this.labels;
    if (value) return labels.options[value] ?? value;
    return isPartTab(tab) ? labels.none : labels.original;
  }

  // 무대를 가로로 밀면 돈다(단추를 누른 것은 빼고)
  private listenTurn() {
    let lastX: number | null = null;
    this.stage.addEventListener("pointerdown", (e) => {
      if (e.target !== this.stage) return;
      lastX = e.clientX;
      try {
        this.stage.setPointerCapture(e.pointerId);
      } catch {}
    });
    this.stage.addEventListener("pointermove", (e) => {
      if (lastX === null) return;
      const dx = e.clientX - lastX;
      this.on.onTurn(dx);
      lastX = e.clientX;
    });
    const stop = () => {
      lastX = null;
    };
    this.stage.addEventListener("pointerup", stop);
    this.stage.addEventListener("pointercancel", stop);
  }
}

/* ─── 내부 ─────────────────────────── */

// 닫혀 있을 때 화면 왼쪽 아래 구석에 떠 있는 옷장 단추
function wearButton(label: string, on: ClosetHandlers): HTMLButtonElement {
  const button = roundButton(label, SHIRT_ICON);
  Object.assign(button.style, {
    position: "fixed",
    left: "calc(14px + env(safe-area-inset-left))",
    bottom: "calc(14px + env(safe-area-inset-bottom))",
    zIndex: "3",
  });
  button.addEventListener("click", () => on.onOpen());
  return button;
}

// 흰 동그라미 단추(46px)
function roundButton(label: string, inner: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.setAttribute("aria-label", label);
  b.innerHTML = inner;
  Object.assign(b.style, {
    width: "46px",
    height: "46px",
    borderRadius: "50%",
    border: "0",
    background: "rgba(255,255,255,.9)",
    boxShadow: "0 2px 10px rgba(0,0,0,.08)",
    padding: "0",
    color: INK,
    fontSize: "20px",
    lineHeight: "46px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    touchAction: "manipulation",
  });
  return b;
}

// 탭·완성 단추(높이 44px)
function pill(text: string): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  Object.assign(b.style, {
    flex: "0 0 auto",
    minHeight: "44px",
    minWidth: "44px",
    fontSize: "13px",
    border: "0",
    borderRadius: "999px",
    padding: "0 14px",
    background: CHIP,
    color: INK,
    fontFamily: FONT,
    cursor: "pointer",
    touchAction: "manipulation",
  });
  return b;
}
