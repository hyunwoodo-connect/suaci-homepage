import * as THREE from "three";

import type { Spot } from "./spots";

// ?debug=1 (기획서 v3.1 14장): 숨는 자리 후보 번호, 상자 상태·다음 이동까지 남은 초, 보인다 판정 선을 그린다.
// 판 중 화면 규칙(글자·기호 없음)의 예외 — 디버그로 연 탭에서만 보인다

/** 층마다 후보 표시 색 */
const TIER_COLORS = ["#ff6fa5", "#4a63d9", "#b79bff", "#6b3e36"];

/** 디버그 그림 */
export class DebugView {
  private readonly panel: HTMLDivElement;
  private readonly root = new THREE.Group();
  private readonly owned: { dispose(): void }[] = [];
  private readonly line: THREE.Line;
  private readonly linePos: Float32Array;
  private readonly lineMat: THREE.LineBasicMaterial;
  private fpsTime = 0;
  private fpsFrames = 0;
  private fps = 0;

  constructor(parent: HTMLElement, scene: THREE.Scene, spots: readonly Spot[]) {
    this.panel = document.createElement("div");
    Object.assign(this.panel.style, {
      position: "fixed",
      left: "8px",
      top: "calc(64px + env(safe-area-inset-top))",
      font: "11px/1.35 ui-monospace, Menlo, monospace",
      color: "#141414",
      background: "rgba(255,255,255,.72)",
      padding: "4px 6px",
      borderRadius: "4px",
      pointerEvents: "none",
      whiteSpace: "pre",
      zIndex: "7",
    });
    parent.append(this.panel);
    for (const s of spots) this.addMarker(s);
    this.linePos = new Float32Array(6);
    const lineGeo = new THREE.BufferGeometry();
    const lineAttr = new THREE.BufferAttribute(this.linePos, 3);
    lineGeo.setAttribute("position", lineAttr);
    this.lineMat = new THREE.LineBasicMaterial({ color: 0xff0000, depthTest: false });
    this.line = new THREE.Line(lineGeo, this.lineMat);
    this.line.frustumCulled = false;
    this.line.visible = false;
    this.line.renderOrder = 10;
    this.root.add(this.line);
    this.owned.push(lineGeo, this.lineMat);
    scene.add(this.root);
  }

  /** 보인다 판정 선: from(카메라 앞)에서 to(상자)까지 — 보이면 초록, 안 보이면 빨강 */
  sightLine(from: THREE.Vector3 | null, to: THREE.Vector3 | null, isSeen: boolean) {
    if (!from || !to) {
      this.line.visible = false;
      return;
    }
    from.toArray(this.linePos, 0);
    to.toArray(this.linePos, 3);
    (this.line.geometry.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    const color = isSeen ? 0x13a10e : 0xe81123;
    this.lineMat.color.set(color);
    this.line.visible = true;
  }

  /** 글 판을 새로 쓴다 */
  update(dt: number, lines: readonly string[]) {
    this.fpsTime += dt;
    this.fpsFrames++;
    if (this.fpsTime >= 0.5) {
      const rate = this.fpsFrames / this.fpsTime;
      this.fps = Math.round(rate);
      this.fpsTime = 0;
      this.fpsFrames = 0;
    }
    this.panel.textContent = [`fps ${this.fps}`, ...lines].join("\n");
  }

  /** 치운다 */
  dispose() {
    this.panel.remove();
    this.root.removeFromParent();
    for (const o of this.owned) o.dispose();
  }

  // 후보 자리 하나: 바닥에 작은 기둥과 번호
  private addMarker(s: Spot) {
    const color = TIER_COLORS[s.tier] ?? "#141414";
    const label = labelSprite(`${s.index}`, color);
    const lift = s.mount === "under" ? -2.2 : 2.4;
    label.position.copy(s.base).addScaledVector(s.up, lift);
    this.root.add(label);
    this.owned.push(label.material, label.material.map!);
  }
}

/* ─── 내부 ─────────────────────────── */

// 동그라미 안 번호(늘 화면을 본다)
function labelSprite(text: string, color: string): THREE.Sprite {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const half = size / 2;
    g.fillStyle = color;
    g.beginPath();
    const ring = half - 2,
      turn = Math.PI * 2;
    g.arc(half, half, ring, 0, turn);
    g.fill();
    g.fillStyle = "#fff";
    g.font = "bold 30px sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    const baseline = half + 1;
    g.fillText(text, half, baseline);
  }
  const tex = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: tex,
    depthTest: false,
    transparent: true,
    opacity: 0.7,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.setScalar(0.6);
  sprite.renderOrder = 11;
  return sprite;
}
