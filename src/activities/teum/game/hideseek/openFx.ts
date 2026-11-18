import * as THREE from "three";

// 열어 보기의 효과(조각 03). 찾음과 꽝은 색·방향이 정반대다:
//   찾음 — 라임 빛이 사방으로, 색종이(라임·흰색)가 위로 뿜고, 상자가 내려앉으면 먼지 고리, 춤 박자마다 발밑에 라임 별
//   꽝 — 흰 김 한 줄기가 삐뚤빼뚤 올라가고, 물건에서 시시한 것 하나가 나온다(회색 먼지 뭉치 · 거미줄 한 가닥 · 빈 사탕 껍질).
//        위로 솟는 것도 빛도 색종이도 없다
// 조각마다 새로 만들지 않고 미리 만들어 둔 것을 돌려 쓴다(판 중에 여러 번 열어 본다)

/** 꽝에서 나오는 것: 먼지 뭉치 · 거미줄 · 사탕 껍질 */
export type Junk = "dust" | "web" | "wrapper";

/** 돌려 쓰는 차례 */
export const JUNKS: readonly Junk[] = ["dust", "web", "wrapper"];

/** 조각 하나(색종이·김·별·빛·먼지 뭉치·사탕 껍질) */
interface Bit {
  o: THREE.Object3D;
  kind: "piece" | "steam" | "star" | "flash" | "dust" | "wrapper" | "web" | "ring";
  vel: THREE.Vector3;
  /** 그 자리의 위쪽(단위) · 옆으로 흔들리는 쪽(단위) */
  up: THREE.Vector3;
  side: THREE.Vector3;
  t: number;
  life: number;
  size: number;
  /** 땅의 반지름(m — 먼지 뭉치가 튀는 바닥) · 조각마다의 위상 */
  floor: number;
  phase: number;
  on: boolean;
}

/** 미리 만들어 두는 수: 색종이 · 김·별·빛 · 먼지 뭉치·껍질·거미줄·고리 */
const PIECES = 56,
  PUFFS = 24,
  JUNK_N = 4;
/** 색종이: 크기(m) · 솟는 빠르기(m/s, 이 사이) · 옆으로 퍼지는 빠르기(m/s) · 내려오게 당기는 힘(m/s²) · 떠 있는 시간(초) */
const PIECE = { size: 0.42, rise: [7, 12], out: 3.4, pull: 15, life: 1.25 } as const;
/** 김: 덩이 수 · 덩이 사이(초) · 오르는 빠르기(m/s) · 좌우로 흔들리는 폭(m)과 빠르기(rad/s) · 크기(m) · 떠 있는 시간(초) */
const STEAM = {
  puffs: 6,
  every: 0.07,
  rise: 2.6,
  wobble: 0.55,
  rate: 9,
  size: 1.1,
  life: 0.9,
} as const;
/** 먼지 뭉치: 크기(m) · 굴러 나오는 빠르기(m/s) · 튀는 빠르기(m/s) · 당기는 힘(m/s²) · 튈 때 남는 몫 */
const DUST = { size: 1.15, roll: 3.2, hop: 4.2, pull: 18, keep: 0.5 } as const;
/** 사탕 껍질: 크기(m) · 내려오는 빠르기(m/s) · 좌우로 팔랑이는 폭(m)과 빠르기(rad/s) */
const WRAPPER = { size: 1.35, fall: 1.9, sway: 0.8, rate: 7 } as const;
/** 거미줄: 굵기(m) · 길이(m) · 늘어지는 시간(초) · 흔들리는 각(rad) */
const WEB = { thick: 0.1, long: 2.1, drop: 0.16, swing: 0.22 } as const;
/** 별·고리가 사라지는 시간(초) */
const STAR_LIFE = 0.45,
  RING_LIFE = 0.5;

const UP = new THREE.Vector3(0, 1, 0),
  tmp = new THREE.Vector3(),
  axis = new THREE.Vector3(),
  quat = new THREE.Quaternion(),
  basis = new THREE.Matrix4();

/** 열어 보기의 효과 */
export class OpenFx {
  private readonly bits: Bit[] = [];
  private readonly pending: { at: number; run: () => void }[] = [];
  private readonly owned: { dispose(): void }[] = [];
  private clock = 0;

  constructor(
    private readonly scene: THREE.Scene,
    lime: THREE.ColorRepresentation,
  ) {
    const quad = new THREE.PlaneGeometry(1, 1),
      strand = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0),
      hoop = new THREE.RingGeometry(0.82, 1, 40),
      soft = softTexture(),
      star = starTexture(),
      candy = wrapperTexture(),
      fluff = dustTexture();
    this.owned.push(quad, strand, hoop, soft, star, candy, fluff);
    const flat = (color: THREE.ColorRepresentation, map: THREE.Texture | null = null) => {
      const m = new THREE.MeshBasicMaterial({
        color,
        map,
        side: THREE.DoubleSide,
        transparent: true,
        depthWrite: false,
        fog: false,
      });
      this.owned.push(m);
      return m;
    };
    const glow = (color: THREE.ColorRepresentation, map: THREE.Texture) => {
      const m = new THREE.SpriteMaterial({ color, map, transparent: true, depthWrite: false });
      this.owned.push(m);
      return m;
    };
    for (let i = 0; i < PIECES; i++) {
      const color = i % 2 === 0 ? lime : 0xffffff,
        pieceMat = flat(color),
        pieceMesh = new THREE.Mesh(quad, pieceMat);
      this.make("piece", pieceMesh);
    }
    for (let i = 0; i < PUFFS; i++) {
      const steamMat = glow(0xffffff, soft),
        steamSprite = new THREE.Sprite(steamMat);
      this.make("steam", steamSprite);
      const starMat = glow(lime, star),
        starSprite = new THREE.Sprite(starMat);
      this.make("star", starSprite);
    }
    for (let i = 0; i < JUNK_N; i++) {
      const flashMat = glow(lime, soft),
        flashSprite = new THREE.Sprite(flashMat);
      this.make("flash", flashSprite);
      const dustMat = glow(0xffffff, fluff),
        dustSprite = new THREE.Sprite(dustMat);
      this.make("dust", dustSprite);
      const wrapperMat = flat(0xffffff, candy),
        wrapperMesh = new THREE.Mesh(quad, wrapperMat);
      this.make("wrapper", wrapperMesh);
      const webMat = flat(0xffffff),
        webMesh = new THREE.Mesh(strand, webMat);
      this.make("web", webMesh);
      const ringMat = flat(0xd8d8d8),
        ringMesh = new THREE.Mesh(hoop, ringMat);
      this.make("ring", ringMesh);
    }
  }

  /** 라임 빛이 at 에서 사방으로 번진다(찾음) */
  flash(at: THREE.Vector3, size: number, seconds: number) {
    const b = this.take("flash");
    if (!b) return;
    this.start(b, at, seconds, size);
  }

  /** 색종이 count 조각이 at 에서 위로 뿜는다(찾음) */
  confetti(at: THREE.Vector3, count: number, rand: () => number) {
    for (let i = 0; i < count; i++) {
      const b = this.take("piece");
      if (!b) return;
      const life = PIECE.life * (0.75 + 0.5 * rand()),
        size = PIECE.size * (0.7 + 0.6 * rand());
      this.start(b, at, life, size);
      this.tangent(b.side, b.up, rand);
      const rise = PIECE.rise[0] + (PIECE.rise[1] - PIECE.rise[0]) * rand(),
        out = PIECE.out * rand();
      b.vel.copy(b.up).multiplyScalar(rise).addScaledVector(b.side, out);
      b.phase = rand() * Math.PI * 2;
    }
  }

  /** 흰 김 한 줄기가 at 에서 삐뚤빼뚤 올라간다(꽝) */
  steam(at: THREE.Vector3, rand: () => number) {
    const from = at.clone(),
      lean = new THREE.Vector3(),
      up = tmp.copy(at).normalize();
    this.tangent(lean, up, rand);
    for (let i = 0; i < STEAM.puffs; i++)
      this.later(i * STEAM.every, () => {
        const b = this.take("steam");
        if (!b) return;
        const size = STEAM.size * (0.7 + 0.1 * i);
        this.start(b, from, STEAM.life, size);
        b.side.copy(lean);
        b.vel.copy(b.up).multiplyScalar(STEAM.rise);
        b.phase = i * 0.9;
      });
  }

  /**
   * 꽝에서 나오는 시시한 것 하나. top: 물건 윗면 가운데(세계 자리), toward: 내 쪽(접선, 단위), reach: 물건 반너비(m),
   * floor: 그 자리 땅의 반지름(m), seconds: 보이는 시간(초)
   */
  junk(
    kind: Junk,
    top: THREE.Vector3,
    toward: THREE.Vector3,
    reach: number,
    floor: number,
    seconds: number,
  ) {
    const b = this.take(kind);
    if (!b) return;
    const up = tmp.copy(top).normalize(),
      edge = top.clone().addScaledVector(toward, reach);
    if (kind === "dust") {
      // 물건 가장자리에서 굴러 나와 두어 번 튄다
      this.start(b, edge, seconds, DUST.size);
      b.side.copy(toward);
      const hop = DUST.hop * 0.6;
      b.vel.copy(toward).multiplyScalar(DUST.roll).addScaledVector(up, hop);
      b.floor = floor + DUST.size / 2;
      return;
    }
    if (kind === "wrapper") {
      // 윗면에서 팔랑팔랑 내려온다
      this.start(b, edge, seconds, WRAPPER.size);
      b.side.crossVectors(up, toward).normalize();
      b.vel.copy(up).multiplyScalar(-WRAPPER.fall).addScaledVector(toward, 0.5);
      b.floor = floor + 0.1;
      return;
    }
    // 거미줄 한 가닥이 가장자리에서 툭 늘어진다. 납작한 띠라, 내 쪽(toward)을 보게 세운다
    this.start(b, edge, seconds, WEB.long);
    b.side.copy(toward);
    b.vel.set(0, 0, 0);
  }

  /** 먼지 고리가 발밑(at — 세계 자리)에서 번진다(상자가 내려앉았다) */
  ring(at: THREE.Vector3, radius: number) {
    const b = this.take("ring");
    if (!b) return;
    this.start(b, at, RING_LIFE, radius);
    const front = axis.set(0, 0, 1);
    quat.setFromUnitVectors(front, b.up);
    b.o.quaternion.copy(quat);
  }

  /** 작은 라임 별 하나(춤 박자마다 발밑에) */
  star(at: THREE.Vector3, size: number) {
    const b = this.take("star");
    if (!b) return;
    this.start(b, at, STAR_LIFE, size);
    b.vel.copy(b.up).multiplyScalar(1.4);
  }

  /** 켜 둔 것을 모두 끈다(새 판) */
  clear() {
    this.pending.length = 0;
    for (const b of this.bits) {
      b.on = false;
      b.o.visible = false;
    }
  }

  /** 한 프레임 */
  update(dt: number) {
    this.clock += dt;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      if (this.pending[i].at > this.clock) continue;
      const [due] = this.pending.splice(i, 1);
      due.run();
    }
    for (const b of this.bits) {
      if (!b.on) continue;
      b.t += dt;
      const u = b.t / b.life;
      if (u >= 1) {
        b.on = false;
        b.o.visible = false;
        continue;
      }
      this.step(b, dt, u);
    }
  }

  dispose() {
    for (const b of this.bits) b.o.removeFromParent();
    for (const o of this.owned) o.dispose();
  }

  /* ─── 내부 ─────────────────────────── */

  private make(kind: Bit["kind"], o: THREE.Object3D) {
    o.visible = false;
    o.renderOrder = 3;
    this.scene.add(o);
    this.bits.push({
      o,
      kind,
      vel: new THREE.Vector3(),
      up: new THREE.Vector3(),
      side: new THREE.Vector3(),
      t: 0,
      life: 1,
      size: 1,
      floor: 0,
      phase: 0,
      on: false,
    });
  }

  private take(kind: Bit["kind"]): Bit | null {
    return this.bits.find((b) => b.kind === kind && !b.on) ?? null;
  }

  private start(b: Bit, at: THREE.Vector3, life: number, size: number) {
    b.o.position.copy(at);
    b.up.copy(at).normalize();
    b.vel.set(0, 0, 0);
    b.t = 0;
    b.life = life;
    b.size = size;
    b.phase = 0;
    b.on = true;
    b.o.visible = true;
    b.o.scale.setScalar(size);
    this.setOpacity(b, 1);
  }

  private later(seconds: number, run: () => void) {
    const at = this.clock + seconds;
    this.pending.push({ at, run });
  }

  // up 에 수직인 아무 방향(단위)
  private tangent(out: THREE.Vector3, up: THREE.Vector3, rand: () => number) {
    const x = rand() - 0.5,
      y = rand() - 0.5,
      z = rand() - 0.5;
    out.set(x, y, z);
    const along = out.dot(up);
    out.addScaledVector(up, -along);
    if (out.lengthSq() < 1e-6) out.crossVectors(up, UP);
    out.normalize();
  }

  private setOpacity(b: Bit, opacity: number) {
    const o = b.o as THREE.Mesh | THREE.Sprite,
      material = o.material as THREE.Material;
    material.opacity = opacity;
  }

  // 조각 하나의 한 프레임(u: 산 몫 0..1)
  private step(b: Bit, dt: number, u: number) {
    const rest = 1 - u;
    switch (b.kind) {
      case "piece": {
        // 위로 솟았다가 당겨져 내려오며 팔랑팔랑 돈다
        const fall = -PIECE.pull * dt;
        b.vel.addScaledVector(b.up, fall);
        b.o.position.addScaledVector(b.vel, dt);
        const pitch = b.phase + b.t * 9,
          yaw = b.phase * 2 + b.t * 7,
          roll = b.t * 5;
        b.o.rotation.set(pitch, yaw, roll);
        const fade = rest * 3,
          opacity = Math.min(1, fade);
        this.setOpacity(b, opacity);
        return;
      }
      case "steam": {
        // 오르면서 좌우로 흔들리고, 퍼지며 옅어진다
        const angle = b.t * STEAM.rate + b.phase,
          sway = Math.cos(angle) * STEAM.wobble * STEAM.rate,
          drift = sway * dt;
        b.o.position.addScaledVector(b.vel, dt).addScaledVector(b.side, drift);
        const scale = b.size * (0.6 + 0.9 * u),
          opacity = 0.8 * rest;
        b.o.scale.setScalar(scale);
        this.setOpacity(b, opacity);
        return;
      }
      case "flash": {
        const scale = b.size * (0.3 + 1.2 * Math.sqrt(u)),
          opacity = 0.9 * rest * rest;
        b.o.scale.setScalar(scale);
        this.setOpacity(b, opacity);
        return;
      }
      case "star": {
        b.o.position.addScaledVector(b.vel, dt);
        const rush = u * 2.2,
          grown = Math.min(1, rush),
          angle = grown * Math.PI * 0.5,
          scale = b.size * Math.sin(angle),
          fade = rest * 2.5,
          opacity = Math.min(1, fade);
        b.o.scale.setScalar(scale);
        this.setOpacity(b, opacity);
        return;
      }
      case "ring": {
        const scale = b.size * (0.35 + 0.65 * Math.sqrt(u)),
          opacity = 0.7 * rest;
        b.o.scale.setScalar(scale);
        this.setOpacity(b, opacity);
        return;
      }
      case "dust": {
        // 굴러 나와 바닥에서 두어 번 튀고 작아진다
        const fall = -DUST.pull * dt;
        b.vel.addScaledVector(b.up, fall);
        b.o.position.addScaledVector(b.vel, dt);
        if (b.o.position.length() < b.floor) {
          b.o.position.setLength(b.floor);
          const down = b.vel.dot(b.up);
          if (down < 0) {
            const bounce = -down * (1 + DUST.keep);
            b.vel.addScaledVector(b.up, bounce);
          }
          b.vel.multiplyScalar(0.8);
        }
        // 데굴데굴: 그림을 돌린다
        (b.o as THREE.Sprite).material.rotation -= dt * 7;
        const fade = rest * 2.5,
          scale = b.size * Math.min(1, fade);
        b.o.scale.setScalar(scale);
        return;
      }
      case "wrapper": {
        // 좌우로 팔랑이며 내려와 바닥에 눕는다
        const isDown = b.o.position.length() <= b.floor,
          flutter = b.t * WRAPPER.rate,
          sway = isDown ? 0 : Math.cos(flutter) * WRAPPER.sway * WRAPPER.rate,
          drift = sway * dt;
        if (!isDown) b.o.position.addScaledVector(b.vel, dt).addScaledVector(b.side, drift);
        const pitch = isDown ? Math.PI / 2 : b.t * 4,
          yaw = b.t * 3,
          roll = Math.sin(flutter) * 0.7;
        b.o.rotation.set(pitch, yaw, roll);
        const fade = rest * 3,
          opacity = Math.min(1, fade);
        this.setOpacity(b, opacity);
        return;
      }
      case "web": {
        // 툭 늘어진 뒤 살짝 흔들린다
        const dropped = b.t / WEB.drop,
          grown = Math.min(1, dropped),
          wave = b.t * 8,
          swing = Math.sin(wave) * WEB.swing * rest;
        // 위는 그 자리의 위쪽, 앞은 내 쪽(side) — 띠의 넓은 면이 나를 본다
        axis.crossVectors(b.up, b.side).normalize();
        basis.makeBasis(axis, b.up, b.side);
        b.o.quaternion.setFromRotationMatrix(basis);
        const front = axis.set(0, 0, 1);
        b.o.rotateOnAxis(front, swing);
        const long = b.size * grown;
        b.o.scale.set(WEB.thick, long, 1);
        const fade = rest * 3,
          opacity = Math.min(1, fade);
        this.setOpacity(b, opacity);
      }
    }
  }
}

/* ─── 내부 ─────────────────────────── */

function canvasOf(size: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("[teum] 열어 보기 효과: 2D 캔버스를 만들지 못했다");
  return { canvas, ctx };
}

// 가장자리가 부드러운 둥근 점(김·빛)
function softTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvasOf(64),
    fade = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  fade.addColorStop(0, "rgba(255,255,255,1)");
  fade.addColorStop(0.55, "rgba(255,255,255,0.55)");
  fade.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

// 끝이 둥근 다섯 꼭지 별
function starTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvasOf(64);
  ctx.translate(32, 32);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 28 : 12,
      a = (i / 10) * Math.PI * 2 - Math.PI / 2,
      x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.lineJoin = "round";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}

// 회색 먼지 뭉치: 몽글몽글한 덩어리에 엉킨 실 몇 가닥
function dustTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvasOf(96),
    fullTurn = Math.PI * 2;
  ctx.fillStyle = "#a9a9a9";
  ctx.strokeStyle = "#7d7d7d";
  ctx.lineWidth = 3;
  for (const [x, y, r] of [
    [48, 50, 26],
    [30, 42, 16],
    [66, 40, 17],
    [36, 64, 15],
    [62, 64, 16],
    [48, 30, 14],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, fullTurn);
    ctx.fill();
  }
  ctx.lineCap = "round";
  for (const [x, y, a] of [
    [40, 46, 0.4],
    [56, 54, 2.1],
    [50, 38, 4.0],
  ]) {
    const end = a + 3.6;
    ctx.beginPath();
    ctx.arc(x, y, 9, a, end);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}

// 빈 사탕 껍질: 가운데가 홀쭉한 종이와 양끝의 꼬인 날개(연분홍 줄무늬)
function wrapperTexture(): THREE.CanvasTexture {
  const { canvas, ctx } = canvasOf(128),
    fullTurn = Math.PI * 2;
  ctx.fillStyle = "#ffd9e6";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  for (const side of [-1, 1]) {
    const neck = 64 + side * 22,
      tip = 64 + side * 58,
      notch = 64 + side * 50;
    ctx.beginPath();
    ctx.moveTo(neck, 64);
    ctx.lineTo(tip, 34);
    ctx.lineTo(notch, 64);
    ctx.lineTo(tip, 94);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(64, 64, 26, 15, 0, 0, fullTurn);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#ff9fc0";
  ctx.lineWidth = 4;
  for (const x of [52, 64, 76]) {
    const left = x - 4,
      right = x + 4;
    ctx.beginPath();
    ctx.moveTo(left, 53);
    ctx.lineTo(right, 75);
    ctx.stroke();
  }
  return new THREE.CanvasTexture(canvas);
}
