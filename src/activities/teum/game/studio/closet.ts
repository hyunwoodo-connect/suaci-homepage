import type { AvatarLook, LookTab } from "../avatar/outfit";
import { isPartTab, isPrint, LOOK_TABS, optionsFor, printKey } from "../avatar/outfit";
import { thumbKey } from "../avatar/parts";
import { HUD_FONT } from "../hud";

// 꾸미기 씬의 화면: 세상에서 여는 옷장 단추, 무대(밀어서 돌리기·되돌리기·아무거나), 아래 옷장(탭·칸·완성).
// 무엇을 할지는 꾸미기 씬(Studio)이 정한다 — 여기는 그리고, 눌린 것을 알리기만 한다. 누르는 칸은 44px 이상

const INK = "#2b2e2d",
  LIME = "#a9ff39",
  CHIP = "#eef1f0";

/** 탭 이름 */
const TAB_LABEL: Readonly<Record<LookTab, string>> = {
  top: "윗옷",
  bot: "치마",
  shoe: "신발",
  hair: "머리",
  face: "얼굴",
  ear: "귀",
  hand: "손",
  board: "보드",
};

/** 칸의 읽는 이름(그림만 보이는 칸이라 화면 읽기 프로그램에 알린다) */
const OPTION_LABEL: Readonly<Record<string, string>> = {
  daisy: "데이지",
  ditsy: "잔꽃",
  stripe: "줄무늬",
  patch: "패치워크",
  rose: "장미",
  gingham: "깅엄",
  "#2b2e2d": "먹색",
  "#ff5a1f": "주황",
  "#ffd400": "노랑",
  "#1e8fff": "파랑",
  "#a9ff39": "라임",
  "#ff8fbd": "분홍",
  "#ff3d2e": "빨강",
  "#8a5cff": "보라",
  "#b5651d": "갈색",
  hair_bob: "단발",
  scarf: "스카프",
  glass_heart: "하트 선글라스",
  sunglass: "선글라스",
  earring: "귀걸이",
  bouquet: "꽃다발",
  bag: "가방",
  board: "스케이트보드",
};

/** 옷 단추 그림(티셔츠) */
const SHIRT_ICON = `<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 4 4 6.5 5.6 10.4 7.5 9.6V20h9V9.6l1.9.8L20 6.5 15.5 4a3.5 3.5 0 0 1-7 0z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

/** 눌린 것을 알리는 곳 */
export interface ClosetHandlers {
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
  private readonly wearButton: HTMLButtonElement;
  /** 꾸미기 씬이 열려 있나 · 옷장 단추를 밖에서 숨겼나 */
  private isShown = false;
  private wearHidden = false;
  private readonly stage: HTMLDivElement;
  private readonly tip: HTMLDivElement;
  private readonly sheet: HTMLDivElement;
  private readonly grid: HTMLDivElement;
  private readonly tabs = new Map<LookTab, HTMLButtonElement>();
  private tab: LookTab = "top";
  private look: Readonly<AvatarLook> | null = null;

  /** urlOf: 에셋 키 → 받을 주소(없는 키면 null) */
  constructor(
    parent: HTMLElement,
    private readonly urlOf: (key: string) => string | null,
    private readonly on: ClosetHandlers,
  ) {
    this.wearButton = roundButton("옷장", SHIRT_ICON);
    Object.assign(this.wearButton.style, {
      position: "fixed",
      left: "calc(14px + env(safe-area-inset-left))",
      bottom: "calc(14px + env(safe-area-inset-bottom))",
      zIndex: "3",
    });
    this.wearButton.addEventListener("click", () => on.onOpen());

    // 무대: 화면을 덮어 게임 입력을 막고, 가로로 밀면 아바타 둘레를 돈다
    this.stage = document.createElement("div");
    Object.assign(this.stage.style, {
      position: "fixed",
      inset: "0",
      zIndex: "3",
      display: "none",
      touchAction: "none",
    });
    const undo = roundButton("되돌리기", "↶");
    Object.assign(undo.style, {
      position: "absolute",
      top: "calc(14px + env(safe-area-inset-top))",
      left: "14px",
    });
    undo.addEventListener("click", () => on.onUndo());
    const shuffle = roundButton("아무거나", "⚄");
    Object.assign(shuffle.style, {
      position: "absolute",
      top: "calc(14px + env(safe-area-inset-top))",
      right: "14px",
    });
    shuffle.addEventListener("click", () => on.onShuffle());
    this.tip = document.createElement("div");
    this.tip.textContent = "밀어서 돌려 봐";
    Object.assign(this.tip.style, {
      position: "absolute",
      left: "0",
      right: "0",
      top: "calc(28px + env(safe-area-inset-top))",
      textAlign: "center",
      fontSize: "13px",
      fontFamily: HUD_FONT,
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
      transition: "transform .25s",
      zIndex: "4",
      fontFamily: HUD_FONT,
    });
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
      const b = pill(TAB_LABEL[t]);
      b.addEventListener("click", () => {
        this.tab = t;
        this.redraw();
      });
      this.tabs.set(t, b);
      tabRow.append(b);
    }
    const done = pill("완성");
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
    parent.append(this.wearButton, this.stage, this.sheet);
  }

  /** 꾸미기 씬을 열고 닫는다(열면 옷장 단추는 숨는다) */
  show(on: boolean, look: Readonly<AvatarLook>) {
    this.isShown = on;
    this.wearButton.style.display = on || this.wearHidden ? "none" : "";
    this.stage.style.display = on ? "block" : "none";
    this.sheet.style.transform = on ? "none" : "translateY(105%)";
    if (!on) return;
    this.tip.style.opacity = "1";
    this.draw(look);
  }

  /** 옷장 단추를 숨긴다(숨바꼭질의 꼭꼭 숨어라·언박싱 동안 — 눌러서 판이 꼬이지 않게) */
  setWearHidden(hidden: boolean) {
    this.wearHidden = hidden;
    this.wearButton.style.display = hidden || this.isShown ? "none" : "";
  }

  /** 지금 차림으로 칸을 다시 그린다 */
  draw(look: Readonly<AvatarLook>) {
    this.look = look;
    this.redraw();
  }

  /** '밀어서 돌려 봐'를 숨긴다(한 번 밀면) */
  hideTip() {
    this.tip.style.opacity = "0";
  }

  dispose() {
    this.wearButton.remove();
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
          fontFamily: HUD_FONT,
          cursor: "pointer",
        });
        this.paint(b, tab, value);
        const label = optionLabel(tab, value),
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
        b.textContent = value ? (OPTION_LABEL[value] ?? value) : "없음";
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

function optionLabel(tab: LookTab, value: string): string {
  if (value) return OPTION_LABEL[value] ?? value;
  return isPartTab(tab) ? "없음" : "원래 옷";
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
    fontFamily: HUD_FONT,
    cursor: "pointer",
    touchAction: "manipulation",
  });
  return b;
}
