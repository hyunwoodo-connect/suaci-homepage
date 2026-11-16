import * as THREE from "three";

import { LIME, S } from "../settings";
import { FWD } from "../world/sphere";

// 숨바꼭질의 눈에 보이는 신호(소리를 꺼도 알 수 있게): 칙 안개(내 둘레로 40m 까지 퍼지는 라임 고리)와
// 재채기 연기(상자 자리에서 터지는 라임 연기 — 멀리서도 보이게 크고 밝게). 모두 미리 만들어 두고 돌려 쓴다

/** 칙 안개가 다 퍼지는 시간(초) */
const SONAR_TIME = 1.1;
/** 동시에 피어오르는 연기 수 */
const PUFF_N = 36;
/** 재채기 한 번의 연기 수·피는 시간(초)·가장 클 때 크기(m) */
const PUFF_PER = 7,
  PUFF_LIFE = 1.1,
  PUFF_SIZE = 2.6;

/** 연기 하나 */
interface Puff {
  sp: THREE.Sprite;
  vel: THREE.Vector3;
  t: number;
  size: number;
  on: boolean;
}

const tmp = new THREE.Vector3(),
  side = new THREE.Vector3();

/** 칙 안개·재채기 연기 */
export class HideFx {
  private readonly ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private readonly fog: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private sonarT = -1;
  private sonarR = 40;
  private readonly puffs: Puff[] = [];
  private readonly tex: THREE.CanvasTexture;
  private readonly mats: THREE.Material[] = [];

  constructor(scene: THREE.Scene) {
    this.tex = softDot();
    const ringGeo = new THREE.RingGeometry(0.93, 1, 96),
      ringMat = new THREE.MeshBasicMaterial({
        color: LIME,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        fog: false,
      });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    const fogGeo = new THREE.CircleGeometry(1, 64),
      fogMat = new THREE.MeshBasicMaterial({
        color: LIME,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        fog: false,
      });
    this.fog = new THREE.Mesh(fogGeo, fogMat);
    for (const m of [this.ring, this.fog]) {
      m.visible = false;
      m.renderOrder = 5;
      scene.add(m);
    }
    this.mats.push(ringMat, fogMat);
    for (let i = 0; i < PUFF_N; i++) {
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
      const puff: Puff = { sp, vel: new THREE.Vector3(), t: 0, size: 1, on: false };
      this.puffs.push(puff);
    }
  }

  /** 칙 안개: 발밑(n 단위 벡터, 땅 높이 ground)에서 radius 까지 라임 고리가 퍼지고 사라진다 */
  sonar(n: THREE.Vector3, ground: number, radius: number) {
    this.sonarT = 0;
    this.sonarR = radius;
    const lift = S.R + ground + 0.15;
    for (const m of [this.ring, this.fog]) {
      m.position.copy(n).multiplyScalar(lift);
      m.quaternion.setFromUnitVectors(FWD, n);
      m.visible = true;
    }
  }

  /** 재채기 연기: 상자 가운데(at)에서 라임 연기가 위로 터진다 */
  sneeze(at: THREE.Vector3, rand: () => number) {
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
      const out = 1.2 + rand() * 1.6,
        rise = 1.6 + rand() * 1.4;
      p.vel.copy(side).multiplyScalar(out).addScaledVector(up, rise);
      p.sp.position.copy(at);
      p.t = 0;
      p.size = PUFF_SIZE * (0.6 + rand() * 0.5);
      p.on = true;
      p.sp.visible = true;
      if (++made >= PUFF_PER) break;
    }
  }

  /** 고리는 퍼지며 옅어지고, 연기는 부풀며 사라진다 */
  update(dt: number) {
    if (this.sonarT >= 0) {
      this.sonarT += dt;
      const u = this.sonarT / SONAR_TIME;
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
  }

  dispose() {
    for (const m of [this.ring, this.fog]) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    for (const p of this.puffs) p.sp.removeFromParent();
    for (const m of this.mats) m.dispose();
    this.tex.dispose();
  }
}

/* ─── 내부 ─────────────────────────── */

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
