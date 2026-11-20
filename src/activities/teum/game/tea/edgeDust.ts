// 화면 가장자리 먼지(기획서 v3.1 5장 "발소리와 먼지"): 화면 밖에서 상자가 몰래 움직이면 그쪽 화면 가장자리에 작은 먼지가 퐁퐁 오른다.
// 소리가 꺼져 있어도 "뒤에서 뭐가 지나갔다"를 알게. 글자·기호·화살표가 아니라 흰 먼지 방울뿐이다

const STYLE_ID = "teum-tea-dust";
const KEYFRAMES = `@keyframes teumTeaDust { 0% { transform: translate(-50%, -50%) scale(0.4); opacity: 0.85; } 100% { transform: translate(-50%, -140%) scale(1.5); opacity: 0; } }`;
/** 가장자리에서 안쪽으로 띄우는 거리(px)와 먼지 크기(px)·사는 시간(ms) */
const INSET = 22;
const SIZE = 22;
const LIFE_MS = 650;

/** 화면 가장자리 먼지 */
export class EdgeDust {
  /** rand: 먼지 자리를 흩는 난수(판 씨앗에서 갈라 쓴다) */
  constructor(
    private readonly parent: HTMLElement,
    private readonly rand: () => number,
  ) {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = KEYFRAMES;
    document.head.append(style);
  }

  /**
   * 화면 가운데에서 (dx, dy) 쪽(화면 좌표 방향, 크기는 상관없다) 가장자리에 먼지 두세 방울.
   * 상자가 카메라 뒤에 있으면 부르는 쪽이 방향을 뒤집어 넘긴다
   */
  puffToward(dx: number, dy: number) {
    const w = innerWidth,
      h = innerHeight;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    const ux = dx / len,
      uy = dy / len;
    // 가운데에서 그 방향으로 화면 가장자리(안쪽 INSET)까지
    const halfW = w / 2 - INSET,
      halfH = h / 2 - INSET;
    const tx = Math.abs(ux) > 1e-6 ? halfW / Math.abs(ux) : Infinity,
      ty = Math.abs(uy) > 1e-6 ? halfH / Math.abs(uy) : Infinity;
    const reach = Math.min(tx, ty);
    const x = w / 2 + ux * reach,
      y = h / 2 + uy * reach;
    for (let i = 0; i < 3; i++) {
      const jitterX = (this.rand() - 0.5) * 26,
        jitterY = (this.rand() - 0.5) * 26;
      const delay = i * 90;
      const px = x + jitterX,
        py = y + jitterY;
      this.spawn(px, py, delay);
    }
  }

  /** 치운다(떠 있는 먼지는 저절로 사라진다) */
  dispose() {}

  // 먼지 방울 하나
  private spawn(x: number, y: number, delay: number) {
    const dot = document.createElement("div");
    Object.assign(dot.style, {
      position: "fixed",
      left: `${x}px`,
      top: `${y}px`,
      width: `${SIZE}px`,
      height: `${SIZE}px`,
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(255,255,255,.95) 0%, rgba(255,255,255,0) 70%)",
      pointerEvents: "none",
      zIndex: "4",
      opacity: "0",
      animation: `teumTeaDust ${LIFE_MS}ms ease-out ${delay}ms forwards`,
    });
    this.parent.append(dot);
    const total = LIFE_MS + delay + 50;
    setTimeout(() => dot.remove(), total);
  }
}
