import * as THREE from "three";

// 작은 먼지 방울: 내려앉을 때·상자가 달릴 때 발밑에서 퐁퐁 올라와 커지며 옅어진다(라임 아닌 흰·회색).
// 한 번에 그리도록 정해진 수만 돌려 쓴다

/** 한꺼번에 떠 있을 수 있는 먼지 수 */
const COUNT = 48;
/** 먼지 하나가 사는 시간(초) */
const LIFE = 0.7;

/** 먼지 하나 */
interface Puff {
  at: THREE.Vector3;
  rise: THREE.Vector3;
  size: number;
  age: number;
}

/** 먼지 방울 */
export class Puffs {
  private readonly sprites: THREE.Sprite[] = [];
  private readonly list: Puff[] = [];
  private readonly tex: THREE.CanvasTexture;
  private readonly mats: THREE.SpriteMaterial[] = [];
  private next = 0;

  constructor(scene: THREE.Scene, color: THREE.ColorRepresentation) {
    this.tex = softDot();
    for (let i = 0; i < COUNT; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.tex,
        color,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      scene.add(sprite);
      this.sprites.push(sprite);
      this.mats.push(mat);
      const at = new THREE.Vector3(),
        rise = new THREE.Vector3();
      this.list.push({ at, rise, size: 0, age: LIFE });
    }
  }

  /** at 에서 up 쪽으로 n 개를 퐁퐁(크기 size m) */
  burst(at: THREE.Vector3, up: THREE.Vector3, n: number, size: number) {
    for (let i = 0; i < n; i++) {
      const p = this.list[this.next];
      this.next = (this.next + 1) % COUNT;
      const angle = (i / n) * Math.PI * 2;
      p.at.copy(at);
      const sx = Math.cos(angle),
        sz = Math.sin(angle);
      p.rise.set(sx, 0, sz).multiplyScalar(0.8).addScaledVector(up, 0.9);
      p.size = size;
      p.age = 0;
    }
  }

  /** 먼지가 오르며 옅어진다 */
  update(dt: number) {
    for (let i = 0; i < COUNT; i++) {
      const p = this.list[i],
        sprite = this.sprites[i];
      if (p.age >= LIFE) {
        sprite.visible = false;
        continue;
      }
      p.age += dt;
      const share = p.age / LIFE;
      const k = Math.min(1, share);
      p.at.addScaledVector(p.rise, dt);
      sprite.position.copy(p.at);
      const grow = p.size * (0.6 + k * 0.9);
      sprite.scale.setScalar(grow);
      this.mats[i].opacity = 0.55 * (1 - k);
      sprite.visible = true;
    }
  }

  /** 치운다 */
  dispose() {
    for (const s of this.sprites) s.removeFromParent();
    for (const m of this.mats) m.dispose();
    this.tex.dispose();
  }
}

/* ─── 내부 ─────────────────────────── */

// 가장자리가 부드러운 둥근 점
function softDot(): THREE.CanvasTexture {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const half = size / 2;
    const grad = g.createRadialGradient(half, half, 0, half, half, half);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  return new THREE.CanvasTexture(canvas);
}
