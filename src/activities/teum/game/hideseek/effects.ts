import * as THREE from "three";

import { LIME, S } from "../settings";
import { FWD } from "../world/sphere";

// 숨바꼭질의 눈에 보이는 신호(소리를 꺼도 알 수 있게). 모두 미리 만들어 두고 돌려 쓴다:
//   칙 안개 — 내 둘레로 칙이 닿는 거리까지 퍼지는 라임 고리(금색 상자가 쿵 할 때의 먼지 고리도 이 고리다)
//   재채기 연기 — 상자 자리에서 터지는 라임 연기. 찾았을 때의 종이 꽃가루는 더 잘고 멀리 튄다
//   라임 점 — 달려가는 상자 발밑의 먼지, 칙 안개가 상자로 흘러가는 알갱이, 전설의 생물이 지나간 자리의 빛가루

/** 칙 안개가 다 퍼지는 시간(초) */
const SONAR_TIME = 0.9;
/** 동시에 피어오르는 연기 수 */
const PUFF_N = 48;
/** 재채기 한 번의 연기 수·피는 시간(초)·가장 클 때 크기(m) */
const PUFF_PER = 7,
  PUFF_LIFE = 1.1,
  PUFF_SIZE = 2.6;
/** 종이 꽃가루 한 번의 조각 수·크기(m) */
const CONFETTI_PER = 12,
  CONFETTI_SIZE = 0.7;
/** 점 수(발자국 한 줄이 다 들어가게) */
const DOT_N = 240;

/** 연기 하나 */
interface Puff {
  sp: THREE.Sprite;
  vel: THREE.Vector3;
  t: number;
  size: number;
  on: boolean;
}

/** 라임 점 하나(제자리에 떠 있다가 옅어진다) */
interface Dot {
  sp: THREE.Sprite;
  t: number;
  life: number;
  size: number;
}

const tmp = new THREE.Vector3(),
  side = new THREE.Vector3();

/** 칙 안개·재채기 연기·라임 점 */
export class HideFx {
  private readonly ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly fog: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private sonarT = -1;
  private sonarR = 20;
  private sonarFor = SONAR_TIME;
  private readonly puffs: Puff[] = [];
  private readonly dots: Dot[] = [];
  private nextDot = 0;
  private readonly tex: THREE.CanvasTexture;
  private readonly mats: THREE.Material[] = [];

  constructor(scene: THREE.Scene) {
    this.tex = softDot();
    const ringGeo = new THREE.RingGeometry(0.93, 1, 96),
      ringMat = flatLime();
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    const fogGeo = new THREE.CircleGeometry(1, 64),
      fogMat = flatLime();
    this.fog = new THREE.Mesh(fogGeo, fogMat);
    for (const m of [this.ring, this.fog]) {
      m.visible = false;
      m.renderOrder = 5;
      scene.add(m);
    }
    this.mats.push(ringMat, fogMat);
    for (let i = 0; i < PUFF_N; i++) {
      const sp = this.sprite(scene);
      const puff: Puff = { sp, vel: new THREE.Vector3(), t: 0, size: 1, on: false };
      this.puffs.push(puff);
    }
    for (let i = 0; i < DOT_N; i++) {
      const sp = this.sprite(scene);
      const dot: Dot = { sp, t: 0, life: 0, size: 1 };
      this.dots.push(dot);
    }
  }

  /** 부드러운 라임 빛 한 덩이(전설의 생물 몸에 붙이는 빛) — 치우는 것은 여기서 한다 */
  glowSprite(size: number): THREE.Sprite {
    const mat = new THREE.SpriteMaterial({
      map: this.tex,
      color: LIME,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      fog: false,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    this.mats.push(mat);
    const sp = new THREE.Sprite(mat);
    sp.scale.setScalar(size);
    sp.renderOrder = 3;
    return sp;
  }

  /** 칙 안개: 발밑(n 단위 벡터, 땅 높이 ground)에서 radius 까지 seconds 동안 라임 고리가 퍼지고 사라진다 */
  sonar(n: THREE.Vector3, ground: number, radius: number, seconds = SONAR_TIME) {
    this.sonarT = 0;
    this.sonarR = radius;
    this.sonarFor = seconds;
    const lift = S.R + ground + 0.15;
    for (const m of [this.ring, this.fog]) {
      m.position.copy(n).multiplyScalar(lift);
      m.quaternion.setFromUnitVectors(FWD, n);
      m.visible = true;
    }
  }

  /** 종이 꽃가루: 상자 가운데(at)에서 잔 라임 조각이 사방으로 퐁 튄다(찾았다!) */
  confetti(at: THREE.Vector3, rand: () => number) {
    this.burst(at, rand, CONFETTI_PER, CONFETTI_SIZE, 2.4);
  }

  /** 재채기 연기: 상자 가운데(at)에서 라임 연기가 위로 터진다 */
  sneeze(at: THREE.Vector3, rand: () => number) {
    this.burst(at, rand, PUFF_PER, PUFF_SIZE, 1);
  }

  // 연기 n 덩이를 at 에서 터뜨린다(size m, speed 배로 빠르게)
  private burst(at: THREE.Vector3, rand: () => number, n: number, size: number, speed: number) {
    const up = tmp.copy(at).normalize();
    let made = 0;
    for (const p of this.puffs) {
      if (p.on) continue;
      // 옆으로 퍼지는 방향(아무 접선) → 위로
      const sx = rand() - 0.5,
        sy = rand() - 0.5,
        sz = rand() - 0.5;
      side.set(sx, sy, sz);
      const radial = side.dot(up);
      side.addScaledVector(up, -radial).normalize();
      const out = (1.2 + rand() * 1.6) * speed,
        rise = (1.6 + rand() * 1.4) * speed;
      p.vel.copy(side).multiplyScalar(out).addScaledVector(up, rise);
      p.sp.position.copy(at);
      p.t = 0;
      p.size = size * (0.6 + rand() * 0.5);
      p.on = true;
      p.sp.visible = true;
      if (++made >= n) break;
    }
  }

  /** 점 하나를 그 자리에 남긴다(size m, life 초 동안 옅어진다 — 색은 라임, 다른 색이면 color) */
  dot(at: THREE.Vector3, size: number, life: number, color: THREE.ColorRepresentation = LIME) {
    const d = this.dots[this.nextDot];
    this.nextDot = (this.nextDot + 1) % DOT_N;
    d.sp.material.color.set(color);
    d.sp.position.copy(at);
    d.sp.visible = true;
    d.t = 0;
    d.life = life;
    d.size = size;
  }

  /** 켜 둔 것을 모두 끈다(새 판) */
  clear() {
    for (const d of this.dots) {
      d.life = 0;
      d.sp.visible = false;
    }
  }

  /** 고리는 퍼지며 옅어지고, 연기는 부풀며 사라지고, 점은 제자리에서 옅어진다 */
  update(dt: number) {
    if (this.sonarT >= 0) {
      this.sonarT += dt;
      const u = this.sonarT / this.sonarFor;
      if (u >= 1) {
        this.sonarT = -1;
        this.ring.visible = this.fog.visible = false;
      } else {
        const rest = 1 - u,
          out = 1 - rest * rest * rest,
          r = 1 + out * (this.sonarR - 1),
          fade = 1 - u;
        this.ring.scale.setScalar(r);
        this.fog.scale.setScalar(r);
        this.ring.material.opacity = 0.75 * fade;
        this.fog.material.opacity = 0.12 * fade;
      }
    }
    for (const p of this.puffs) {
      if (!p.on) continue;
      p.t += dt;
      const u = p.t / PUFF_LIFE;
      if (u >= 1) {
        p.on = false;
        p.sp.visible = false;
        continue;
      }
      p.sp.position.addScaledVector(p.vel, dt);
      const grow = 0.35 + 0.65 * Math.sqrt(u),
        scale = p.size * grow;
      p.sp.scale.setScalar(scale);
      p.sp.material.opacity = 0.85 * (1 - u);
    }
    for (const d of this.dots) {
      if (d.life <= 0) continue;
      d.t += dt;
      const u = d.t / d.life;
      if (u >= 1) {
        d.life = 0;
        d.sp.visible = false;
        continue;
      }
      const grown = d.t * 6,
        popIn = Math.min(1, grown),
        scale = d.size * popIn;
      d.sp.scale.setScalar(scale);
      d.sp.material.opacity = 0.95 * (1 - u * u);
    }
  }

  dispose() {
    for (const m of [this.ring, this.fog]) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    for (const p of this.puffs) p.sp.removeFromParent();
    for (const d of this.dots) d.sp.removeFromParent();
    for (const m of this.mats) m.dispose();
    this.tex.dispose();
  }

  // 라임 연기·점 한 덩이(안개에 묻히지 않는다)
  private sprite(scene: THREE.Scene): THREE.Sprite {
    const mat = new THREE.SpriteMaterial({
      map: this.tex,
      color: LIME,
      transparent: true,
      depthWrite: false,
      fog: false,
      opacity: 0,
    });
    this.mats.push(mat);
    const sp = new THREE.Sprite(mat);
    sp.visible = false;
    scene.add(sp);
    return sp;
  }
}

/* ─── 내부 ─────────────────────────── */

// 안개에 묻히지 않는 납작한 라임 면(고리·안개·기둥)
function flatLime(): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: LIME,
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });
}

// 가운데가 진하고 가장자리로 옅어지는 동그라미(연기 한 덩이)
function softDot(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.45, "rgba(255,255,255,.7)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  return new THREE.CanvasTexture(c);
}
