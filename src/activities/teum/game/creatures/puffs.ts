import * as THREE from "three";

// 주민 생물의 몸짓에 붙는 작은 효과: 김·반짝이·종이·물방울·음표·꽃·리본·체리·발그레. 말풍선·글자·기호는 없다.
// 라임색은 숨는 상자와 리본의 것이라 여기서는 흰색·분홍·하늘색만 쓴다.
// 모두 처음에 만들어 두고 돌려 쓴다(프레임 중에 새로 만들지 않는다) — 한꺼번에 많이 나오면 가장 오래된 것부터 덮는다

/** 효과의 갈래 */
export type PuffKind =
  | "steam"
  | "spark"
  | "trail"
  | "paper"
  | "drop"
  | "note"
  | "flower"
  | "slip"
  | "charm"
  | "berry"
  | "blush";

/** 효과를 내는 창구(주민 생물이 쓴다) */
export interface PuffSink {
  /**
   * pos(세계 자리)에서 하나 낸다. up: 그 자리의 위쪽(단위 벡터), push: 처음에 밀리는 쪽(세계 속도 m/s, 없으면 제자리에서),
   * floor: 떨어져 멈출 땅(행성 중심에서의 거리 — 체리만 쓴다)
   */
  emit(
    kind: PuffKind,
    pos: THREE.Vector3,
    up: THREE.Vector3,
    push?: THREE.Vector3 | null,
    floor?: number,
  ): void;
}

/** 갈래마다의 생김새와 움직임 */
interface PuffLook {
  shape: Shape;
  color: number;
  /** 크기(m): 처음 → 끝 */
  from: number;
  to: number;
  /** 사는 시간(초) */
  life: number;
  /** 위로 솟는 빠르기(m/s)와 떨어지는 힘(m/s²) */
  rise: number;
  fall: number;
  /** 옆으로 흩어지는 빠르기(m/s) · 좌우로 살랑이는 폭(m/s) · 도는 빠르기(rad/s) */
  scatter: number;
  sway: number;
  spin: number;
  /** 가장 진할 때 */
  alpha: number;
  /** 땅에 닿으면 멈춰 남는다(체리) */
  rests: boolean;
}

/** 그림 */
type Shape = "blob" | "twinkle" | "sheet" | "tear" | "note" | "bow" | "flower" | "dot";

/** 효과 하나 */
interface Puff {
  sp: THREE.Sprite;
  look: PuffLook;
  vel: THREE.Vector3;
  up: THREE.Vector3;
  t: number;
  /** 살랑임의 위상 · 놓인 땅의 높이(행성 중심에서) */
  phase: number;
  floor: number;
  on: boolean;
}

/** 동시에 떠 있는 효과 수 */
const POOL = 48;
const WHITE = 0xffffff,
  PINK = 0xff5fa6,
  SKY = 0xbfe6ff,
  CHERRY = 0xff2f55;

const LOOKS: Readonly<Record<PuffKind, PuffLook>> = {
  steam: look("blob", WHITE, 0.5, 1.7, 1.3, 1.7, -0.4, 0.25, 0.3, 0, 0.75, false),
  spark: look("twinkle", WHITE, 0.55, 0.15, 1.1, 1.3, 2.2, 0.9, 0, 2, 1, false),
  // 지나간 자리에 남는 반짝이(제자리에서 옅어진다 — 궤적의 모양이 읽히게)
  trail: look("twinkle", PINK, 0.6, 0.25, 1.6, 0, 0, 0.03, 0, 1.5, 1, false),
  paper: look("sheet", WHITE, 0.42, 0.36, 1.6, 1.4, 3.2, 0.5, 0.9, 5, 1, false),
  drop: look("tear", SKY, 0.34, 0.26, 0.8, 0.4, 9, 0.35, 0, 0, 1, false),
  note: look("note", PINK, 0.6, 0.75, 1.4, 1.5, 0, 0.2, 0.7, 0, 1, false),
  // 모자가 꺼냈다 도로 삼키는 것 셋: 솟았다가 제자리로 떨어진다
  flower: look("flower", PINK, 0.5, 0.85, 1.05, 3.4, 6.6, 0.05, 0, 3, 1, false),
  slip: look("sheet", WHITE, 0.5, 0.8, 1.05, 3.4, 6.6, 0.05, 0, 4, 1, false),
  charm: look("bow", PINK, 0.5, 0.8, 1.05, 3.4, 6.6, 0.05, 0, 0, 1, false),
  berry: look("dot", CHERRY, 0.42, 0.42, 2, 2.6, 9, 0, 0, 0, 1, true),
  blush: look("blob", PINK, 1.1, 1.5, 0.6, 0.1, 0, 0, 0, 0, 0.5, false),
};

const side = new THREE.Vector3(),
  ref = new THREE.Vector3(0, 1, 0),
  refAlt = new THREE.Vector3(1, 0, 0);

/** 주민 생물의 작은 효과 */
export class Puffs implements PuffSink {
  private readonly pool: Puff[] = [];
  private readonly textures: Record<Shape, THREE.CanvasTexture>;
  private next = 0;
  private seed = 1;

  constructor(scene: THREE.Scene) {
    this.textures = {
      blob: draw(paintBlob),
      twinkle: draw(paintTwinkle),
      sheet: draw(paintSheet),
      tear: draw(paintTear),
      note: draw(paintNote),
      bow: draw(paintBow),
      flower: draw(paintFlower),
      dot: draw(paintDot),
    };
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.textures.blob,
        transparent: true,
        depthWrite: false,
        fog: false,
        opacity: 0,
      });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      scene.add(sp);
      this.pool.push({
        sp,
        look: LOOKS.steam,
        vel: new THREE.Vector3(),
        up: new THREE.Vector3(),
        t: 0,
        phase: 0,
        floor: 0,
        on: false,
      });
    }
  }

  /** 하나 낸다 */
  emit(
    kind: PuffKind,
    pos: THREE.Vector3,
    up: THREE.Vector3,
    push: THREE.Vector3 | null = null,
    floor = 0,
  ) {
    const puff = this.pool[this.next],
      L = LOOKS[kind];
    this.next = (this.next + 1) % POOL;
    puff.look = L;
    puff.on = true;
    puff.t = 0;
    puff.up.copy(up);
    puff.phase = this.roll() * 6.28;
    // 흩어지는 쪽: 위와 수직인 아무 방향
    const axis = Math.abs(up.y) > 0.9 ? refAlt : ref,
      turn = this.roll() * 6.28,
      scatter = L.scatter * (0.4 + this.roll() * 0.6);
    side.crossVectors(up, axis).normalize().applyAxisAngle(up, turn);
    puff.vel.copy(up).multiplyScalar(L.rise).addScaledVector(side, scatter);
    if (push) puff.vel.add(push);
    puff.floor = floor;
    const sp = puff.sp;
    sp.position.copy(pos);
    sp.material.map = this.textures[L.shape];
    sp.material.color.setHex(L.color);
    sp.material.rotation = 0;
    sp.material.opacity = L.alpha;
    sp.scale.setScalar(L.from);
    sp.visible = true;
  }

  /** 한 프레임: 솟고 떨어지고 살랑이며 옅어진다 */
  update(dt: number) {
    for (const puff of this.pool) {
      if (!puff.on) continue;
      const L = puff.look,
        sp = puff.sp;
      puff.t += dt;
      const k = puff.t / L.life;
      if (k >= 1) {
        puff.on = false;
        sp.visible = false;
        continue;
      }
      const drop = -L.fall * dt;
      puff.vel.addScaledVector(puff.up, drop);
      sp.position.addScaledVector(puff.vel, dt);
      if (L.sway) {
        const swing = puff.t * 5 + puff.phase,
          sideways = Math.sin(swing) * L.sway * dt;
        side.crossVectors(puff.up, ref).normalize();
        sp.position.addScaledVector(side, sideways);
      }
      if (L.rests && puff.floor > 0 && sp.position.length() < puff.floor) {
        sp.position.setLength(puff.floor);
        puff.vel.set(0, 0, 0);
      }
      sp.material.rotation += L.spin * dt;
      const size = L.from + (L.to - L.from) * k,
        fade = 1 - k * k;
      sp.scale.setScalar(size);
      sp.material.opacity = L.alpha * fade;
    }
  }

  /** 치운다 */
  dispose() {
    for (const puff of this.pool) {
      puff.sp.removeFromParent();
      puff.sp.material.dispose();
    }
    for (const texture of Object.values(this.textures)) texture.dispose();
  }

  // 효과의 흩어짐은 게임 난수와 따로 돈다(같은 씨앗의 판이 효과 수에 따라 달라지지 않게)
  private roll(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }
}

/* ─── 내부 ─────────────────────────── */

/** 그림 한 변(px) */
const TILE = 64;

function look(
  shape: Shape,
  color: number,
  from: number,
  to: number,
  life: number,
  rise: number,
  fall: number,
  scatter: number,
  sway: number,
  spin: number,
  alpha: number,
  rests: boolean,
): PuffLook {
  return { shape, color, from, to, life, rise, fall, scatter, sway, spin, alpha, rests };
}

// 흰 그림을 그려 둔다(색은 재질이 입힌다)
function draw(paint: (c: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TILE;
  const c = canvas.getContext("2d");
  if (c) {
    c.fillStyle = "#fff";
    c.strokeStyle = "#fff";
    paint(c);
  }
  return new THREE.CanvasTexture(canvas);
}

function paintBlob(c: CanvasRenderingContext2D) {
  const fill = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  fill.addColorStop(0, "rgba(255,255,255,1)");
  fill.addColorStop(0.45, "rgba(255,255,255,.6)");
  fill.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = fill;
  c.fillRect(0, 0, TILE, TILE);
}

function paintTwinkle(c: CanvasRenderingContext2D) {
  c.beginPath();
  c.moveTo(32, 2);
  c.quadraticCurveTo(34, 30, 62, 32);
  c.quadraticCurveTo(34, 34, 32, 62);
  c.quadraticCurveTo(30, 34, 2, 32);
  c.quadraticCurveTo(30, 30, 32, 2);
  c.fill();
}

function paintSheet(c: CanvasRenderingContext2D) {
  c.fillRect(14, 20, 36, 24);
  c.fillStyle = "rgba(0,0,0,.18)";
  c.fillRect(20, 27, 24, 2);
  c.fillRect(20, 33, 18, 2);
}

function paintTear(c: CanvasRenderingContext2D) {
  c.beginPath();
  c.moveTo(32, 6);
  c.bezierCurveTo(50, 30, 50, 58, 32, 58);
  c.bezierCurveTo(14, 58, 14, 30, 32, 6);
  c.fill();
}

function paintNote(c: CanvasRenderingContext2D) {
  c.beginPath();
  c.ellipse(24, 46, 12, 9, -0.4, 0, 6.3);
  c.fill();
  c.fillRect(33, 10, 5, 36);
  c.beginPath();
  c.moveTo(38, 10);
  c.quadraticCurveTo(56, 16, 52, 32);
  c.quadraticCurveTo(50, 22, 38, 22);
  c.fill();
}

// 리본 매듭: 양쪽 고리 둘과 가운데 매듭
function paintBow(c: CanvasRenderingContext2D) {
  c.beginPath();
  c.moveTo(32, 32);
  c.lineTo(6, 14);
  c.lineTo(6, 50);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(32, 32);
  c.lineTo(58, 14);
  c.lineTo(58, 50);
  c.closePath();
  c.fill();
  c.beginPath();
  c.arc(32, 32, 8, 0, 6.3);
  c.fill();
}

function paintFlower(c: CanvasRenderingContext2D) {
  for (let i = 0; i < 5; i++) {
    const turn = (i * 6.283) / 5,
      x = 32 + Math.cos(turn) * 15,
      y = 32 + Math.sin(turn) * 15;
    c.beginPath();
    c.arc(x, y, 12, 0, 6.3);
    c.fill();
  }
  c.fillStyle = "rgba(0,0,0,.2)";
  c.beginPath();
  c.arc(32, 32, 7, 0, 6.3);
  c.fill();
}

function paintDot(c: CanvasRenderingContext2D) {
  c.beginPath();
  c.arc(32, 32, 26, 0, 6.3);
  c.fill();
}
