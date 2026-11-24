import type { Frame } from "../core/frame";
import { HUD_FONT } from "../hud";
import { INK, LIME, PAPER, REDUCED_MOTION } from "./hudStyle";
import type { EdgeHint, HintBox } from "./rules";
import type { SuccessPanelHandlers } from "./successPanel";
import { SuccessPanel } from "./successPanel";

// 물풍선 놀이의 화면(DOM, 폰 세로 기준): 위 가운데 개수 알약, 화면에 보이는 물풍선 위의 물방울 핀, 화면 밖 물풍선을 가리키는
// 물방울 화살표, 다 먹었을 때의 성공 판. 핀·화살표·알약의 물방울이 모두 같은 모양이라 "이 표시가 붙은 것이 먹을 것"임을 안다.
// 무엇을 보일지는 물풍선(waterBalloons.ts)이 정한다 — 여기는 그리고, 눌린 단추를 알리기만 한다.
// 알약·핀·화살표는 손가락을 받지 않아 끌기를 막지 않는다. 성공 판의 단추만 누를 수 있다(44px 이상)

/** 물풍선 위의 핀 하나: 자리(px — 뾰족한 끝이 가리키는 점)·색(CSS)·진하기(0..1) */
export interface BalloonPin {
  x: number;
  y: number;
  tint: string;
  alpha: number;
}

/** 화살표가 다니는 칸의 안쪽 여백(px): 위는 개수 알약·소리 단추 아래로, 아래는 옷장 단추·안내 줄 위로 */
const EDGE_TOP = 78,
  EDGE_BOTTOM = 100,
  EDGE_SIDE = 30;
/** 핀: 크기(px) · 까딱이는 폭(px)과 빠르기 */
const PIN_SIZE = 22,
  PIN_BOB = 3,
  PIN_BOB_RATE = 4;
/** 개수가 오를 때 알약이 커져 있는 시간(초)과 그때의 크기 */
const BUMP_SECONDS = 0.14,
  BUMP_SCALE = 1.24;
/** 화살표 물방울의 뾰족한 끝이 처음 가리키는 쪽(오른쪽 위)을 오른쪽(0)으로 돌려 놓는 각 */
const TIP_OFFSET = Math.PI / 4;
/** 물풍선 놀이의 화면 */
export class WaterBalloonHud {
  private readonly root: HTMLDivElement;
  private readonly pill: HTMLDivElement;
  private readonly countText: HTMLSpanElement;
  private readonly arrow: HTMLDivElement;
  private readonly arrowDrop: HTMLDivElement;
  private readonly pinLayer: HTMLDivElement;
  private readonly pins: HTMLDivElement[] = [];
  private time = 0;
  private readonly success: SuccessPanel;
  private count = 0;
  private bump = 0;
  private readonly box: HintBox = { left: 0, top: 0, right: 0, bottom: 0 };

  /** 캔버스 위(같은 부모)에 얹는다 */
  constructor(parent: HTMLElement, on: SuccessPanelHandlers) {
    this.root = document.createElement("div");
    Object.assign(this.root.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      fontFamily: HUD_FONT,
      color: INK,
    });

    // 개수 알약: 소리 단추(오른쪽 위 44px)와 같은 줄, 가운데
    this.pill = document.createElement("div");
    this.pill.setAttribute("role", "status");
    Object.assign(this.pill.style, {
      position: "absolute",
      top: "calc(12px + env(safe-area-inset-top))",
      left: "50%",
      height: "36px",
      padding: "0 15px 0 12px",
      display: "flex",
      alignItems: "center",
      gap: "9px",
      borderRadius: "999px",
      background: PAPER,
      boxShadow: "0 2px 10px rgba(0,0,0,.14)",
      fontSize: "16px",
      fontWeight: "700",
      fontVariantNumeric: "tabular-nums",
      whiteSpace: "nowrap",
      transform: "translateX(-50%) scale(1)",
      transition: REDUCED_MOTION ? "none" : "transform .3s cubic-bezier(.3,1.7,.5,1)",
    });
    const drop = droplet(16, LIME);
    drop.style.border = `2px solid ${INK}`;
    // 뾰족한 끝(오른쪽 위)을 위로 세운다
    drop.style.transform = "rotate(-45deg)";
    drop.style.marginTop = "3px";
    this.countText = document.createElement("span");
    this.pill.append(drop, this.countText);

    // 화살표: 물방울의 뾰족한 끝이 물풍선 쪽을 가리킨다
    this.arrow = document.createElement("div");
    this.arrow.setAttribute("aria-hidden", "true");
    Object.assign(this.arrow.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: "30px",
      height: "30px",
      margin: "-15px 0 0 -15px",
      display: "none",
      filter: "drop-shadow(0 2px 5px rgba(0,0,0,.3))",
    });
    this.arrowDrop = droplet(30, LIME);
    this.arrowDrop.style.border = `3px solid ${INK}`;
    this.arrow.append(this.arrowDrop);

    // 핀: 화면에 보이는 물풍선마다 하나(필요한 만큼 만들어 돌려 쓴다)
    this.pinLayer = document.createElement("div");
    this.pinLayer.setAttribute("aria-hidden", "true");
    Object.assign(this.pinLayer.style, { position: "absolute", inset: "0" });

    this.success = new SuccessPanel(on);

    // 겹치는 차례: 화살표·핀은 알약 아래로, 성공 판이 맨 위
    this.root.append(this.arrow, this.pinLayer, this.pill, this.success.el);
    parent.append(this.root);
  }

  /** 먹은 수를 적는다. 먹은 만큼 알약이 왼쪽부터 라임으로 차고(다 먹으면 온통 라임), 수가 올랐으면 통 하고 커졌다 돌아온다 */
  setCount(count: number, total: number) {
    this.countText.textContent = `${count} / ${total}`;
    const share = (count / total) * 100,
      filled = Math.round(share);
    this.pill.style.background = `linear-gradient(90deg, ${LIME} ${filled}%, ${PAPER} ${filled}%)`;
    const spoken = `물풍선 ${total}개 가운데 ${count}개`;
    this.pill.setAttribute("aria-label", spoken);
    if (count > this.count) {
      this.bump = BUMP_SECONDS;
      this.pill.style.transform = `translateX(-50%) scale(${BUMP_SCALE})`;
    }
    this.count = count;
  }

  /** 화살표가 다닐 수 있는 칸(지금 창 크기에서) */
  hintBox(): HintBox {
    const box = this.box;
    box.left = EDGE_SIDE;
    box.top = EDGE_TOP;
    box.right = innerWidth - EDGE_SIDE;
    box.bottom = innerHeight - EDGE_BOTTOM;
    return box;
  }

  /** 화살표를 그 자리에 그 색으로 둔다. null 이면 숨긴다(물풍선이 화면에 보인다) */
  pointTo(hint: EdgeHint | null, tint = LIME) {
    if (!hint) {
      this.arrow.style.display = "none";
      return;
    }
    const turn = hint.angle + TIP_OFFSET;
    this.arrow.style.display = "block";
    this.arrow.style.transform = `translate(${hint.x}px, ${hint.y}px) rotate(${turn}rad)`;
    this.arrowDrop.style.background = tint;
  }

  /** 화면에 보이는 물풍선 위에 핀을 둔다(뾰족한 끝이 물풍선을 가리키고 살짝 까딱인다). 준 것만 보인다 */
  setPins(list: readonly BalloonPin[]) {
    while (this.pins.length < list.length) {
      const el = this.addPin();
      this.pins.push(el);
    }
    const bobPhase = this.time * PIN_BOB_RATE,
      bob = Math.sin(bobPhase) * PIN_BOB;
    this.pins.forEach((el, i) => {
      const pin = list[i];
      if (!pin || pin.alpha <= 0.01) {
        el.style.display = "none";
        return;
      }
      const top = pin.y - bob;
      el.style.display = "block";
      el.style.opacity = pin.alpha.toFixed(2);
      el.style.transform = `translate(${pin.x}px, ${top}px)`;
      const drop = el.firstElementChild as HTMLDivElement;
      drop.style.background = pin.tint;
    });
  }

  /** 성공 판을 띄운다: 먹은 수와 걸린 시간 */
  showSuccess(total: number, seconds: number) {
    this.success.show(total, seconds);
  }

  /** 성공 판을 내린다 */
  hideSuccess() {
    this.success.hide();
  }

  /** 놀이를 끝낸다(계속 놀기): 알약·화살표·성공 판을 모두 치운다 */
  close() {
    this.root.remove();
  }

  /** 꾸미기 씬 동안은 통째로 숨긴다(닫으면 돌아온다) */
  setHidden(hidden: boolean) {
    const display = hidden ? "none" : "";
    if (this.root.style.display !== display) this.root.style.display = display;
  }

  /** 커진 알약을 제 크기로 돌려놓는다(핀이 까딱이는 박자도 여기서 센다) */
  update(f: Frame) {
    this.time += f.dt;
    if (this.bump <= 0) return;
    this.bump -= f.dt;
    if (this.bump <= 0) this.pill.style.transform = "translateX(-50%) scale(1)";
  }

  /** 화면에서 지운다 */
  dispose() {
    this.root.remove();
  }

  /* ─── 내부 ─────────────────────────── */

  // 핀 하나: 물방울의 뾰족한 끝을 아래로 돌려, 그 끝이 준 자리에 오게 위로 올려 둔다
  private addPin(): HTMLDivElement {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "absolute",
      left: "0",
      top: "0",
      width: `${PIN_SIZE}px`,
      height: `${PIN_SIZE}px`,
      margin: `${-PIN_SIZE * 1.25}px 0 0 ${-PIN_SIZE / 2}px`,
      display: "none",
      filter: "drop-shadow(0 2px 4px rgba(0,0,0,.3))",
    });
    const drop = droplet(PIN_SIZE, LIME);
    drop.style.border = `2px solid ${INK}`;
    // 뾰족한 끝(오른쪽 위)을 아래로
    drop.style.transform = "rotate(135deg)";
    el.append(drop);
    this.pinLayer.append(el);
    return el;
  }
}

/* ─── 내부 ─────────────────────────── */

// CSS 로 그린 물방울: 세 귀를 둥글린 네모 — 남은 한 귀(오른쪽 위)가 뾰족한 끝이다. 흰 점은 물풍선의 반짝임.
// 라임은 밝은 바탕에서 묻히므로 쓰는 쪽이 먹색 테두리를 두른다
function droplet(size: number, tint: string): HTMLDivElement {
  const el = document.createElement("div");
  Object.assign(el.style, {
    width: `${size}px`,
    height: `${size}px`,
    boxSizing: "border-box",
    borderRadius: "50% 0 50% 50%",
    background: tint,
    backgroundImage: "radial-gradient(circle at 34% 60%, #fff 0 13%, transparent 15%)",
    flex: "0 0 auto",
  });
  return el;
}
