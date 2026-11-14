import * as THREE from "three";

import type { Frame } from "../core/frame";
import { Fifo } from "../core/pool";
import type { Random } from "../core/random";
import { LOOK } from "../look";
import type { Player } from "../player/player";

// 빛과 입자: 위로 튀어 오르는 빛 방울(최근 60개), 반응한 것 둘레에 번지는 라임 빛(한 프레임 80개까지),
// 공기 중에 떠다니는 작은 입자. 모두 처음에 만들어 두고 돌려 쓴다(프레임 중에 새로 만들지 않는다).
// 다른 것들은 burst(튀기기)와 glow(이번 프레임 빛 하나)로만 부탁한다

/** 빛 방울 하나 */
interface Spark {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  t: number;
  life: number;
  size: number;
}

const SPARK_N = 60,
  GLOW_N = 80,
  MOTE_N = 240;
const gp = new THREE.Vector3();

/** 빛·입자 */
export class Fx {
  private readonly sparks = new Fifo<Spark>(SPARK_N, () => ({
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    t: 0,
    life: 1,
    size: 1,
  }));
  private readonly glows: THREE.Sprite[] = [];
  private gi = 0;
  private readonly glowK = 0.7;
  private readonly motes: THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial>;
  private readonly motePos: Float32Array;
  private moteInit = false;
  private readonly glowTex: THREE.CanvasTexture;

  constructor(
    scene: THREE.Scene,
    private readonly player: Player,
    private readonly rng: Random,
  ) {
    this.glowTex = createGlowTexture();
    for (let i = 0; i < GLOW_N; i++) {
      const glowMat = new THREE.SpriteMaterial({
        map: this.glowTex,
        color: LOOK.glow,
        transparent: true,
        depthWrite: false,
        fog: false,
        opacity: 0,
      });
      const sp = new THREE.Sprite(glowMat);
      sp.visible = false;
      scene.add(sp);
      this.glows.push(sp);
    }
    const moteFloats = MOTE_N * 3;
    this.motePos = new Float32Array(moteFloats);
    const moteCol = new Float32Array(moteFloats),
      moteGeo = new THREE.BufferGeometry();
    for (let i = 0; i < MOTE_N; i++) {
      const isLime = i % 3 === 0;
      const rgb = isLime ? [0.66, 1, 0.22] : [1, 1, 1];
      const at = i * 3;
      moteCol.set(rgb, at);
    }
    const posAttr = new THREE.BufferAttribute(this.motePos, 3);
    moteGeo.setAttribute("position", posAttr);
    const colAttr = new THREE.BufferAttribute(moteCol, 3);
    moteGeo.setAttribute("color", colAttr);
    const moteMat = new THREE.PointsMaterial({
      map: this.glowTex,
      size: 0.55,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      vertexColors: true,
      fog: false,
    });
    this.motes = new THREE.Points(moteGeo, moteMat);
    this.motes.frustumCulled = false;
    scene.add(this.motes);
  }

  /** 빛 방울을 튀긴다(pos 는 복사해 쓴다 — 부른 쪽 벡터를 그대로 넘겨도 된다) */
  burst(pos: THREE.Vector3, n: number, power: number) {
    const r = this.rng;
    for (let k = 0; k < n; k++) {
      const sk = this.sparks.push();
      // 흩어지는 방향 x·y·z → 위로 솟는 힘 → 수명 → 크기
      const dirX = r.next() - 0.5,
        dirY = r.next() - 0.5,
        dirZ = r.next() - 0.5;
      const spread = power * 0.7;
      const lift = power * (0.6 + r.next() * 0.7);
      gp.copy(pos).normalize();
      sk.vel.set(dirX, dirY, dirZ).multiplyScalar(spread).addScaledVector(gp, lift);
      sk.life = 1.1 + r.next() * 0.7;
      sk.size = 1.2 + r.next() * 1.4;
      sk.pos.copy(pos);
      sk.t = 0;
    }
  }

  /** 빛 하나를 이번 프레임 그 자리에 둔다(80 개까지) */
  glow(pos: THREE.Vector3, size: number, a: number) {
    if (this.gi >= GLOW_N || a < 0.03) return;
    const sp = this.glows[this.gi++];
    sp.visible = true;
    sp.position.copy(pos);
    sp.scale.setScalar(size);
    sp.material.opacity = Math.min(1, a) * this.glowK;
  }

  /** 프레임 처음: 빛 칸을 비운다 */
  begin() {
    this.gi = 0;
  }

  /** 프레임 끝: 빛 방울을 빛으로 그리고 움직이고, 입자를 띄우고, 안 쓴 빛을 숨긴다 */
  update(f: Frame) {
    const dt = f.dt,
      p = this.player.p,
      P = this.player.P;
    for (let i = 0; i < this.sparks.size; i++) {
      const sk = this.sparks.at(i);
      const remain = 1 - sk.t / sk.life;
      const size = sk.size * remain + 0.3;
      this.glow(sk.pos, size, remain);
    }
    // 입자: 내 둘레 45 안에서 천천히 떠오른다. 멀어지면 내 둘레에 다시 놓는다
    const motePos = this.motePos,
      r = this.rng;
    for (let i = 0; i < MOTE_N; i++) {
      const j = i * 3;
      gp.fromArray(motePos, j);
      if (!this.moteInit || gp.distanceToSquared(P) > 2025) {
        const dirX = r.next() - 0.5,
          dirY = r.next() - 0.5,
          dirZ = r.next() - 0.5;
        const dist = 8 + r.next() * 36;
        gp.set(dirX, dirY, dirZ).normalize().multiplyScalar(dist).add(P);
      }
      const rise = dt * (0.25 + (i % 5) * 0.08);
      gp.addScaledVector(p, rise);
      const swayPhase = f.time * 0.7 + i;
      gp.x += Math.sin(swayPhase) * dt * 0.3;
      motePos[j] = gp.x;
      motePos[j + 1] = gp.y;
      motePos[j + 2] = gp.z;
    }
    this.moteInit = true;
    this.motes.geometry.attributes.position.needsUpdate = true;
    // 빛 방울: 떠올랐다 떨어지며 사라진다
    const fall = -9 * dt;
    this.sparks.sweep((sk) => {
      sk.t += dt;
      if (sk.t >= sk.life) return false;
      gp.copy(sk.pos).normalize();
      sk.vel.addScaledVector(gp, fall);
      sk.pos.addScaledVector(sk.vel, dt);
      return true;
    });
    for (let k = this.gi; k < GLOW_N; k++) this.glows[k].visible = false;
  }

  /** 치운다 */
  dispose() {
    for (const sp of this.glows) {
      sp.removeFromParent();
      sp.material.dispose();
    }
    this.motes.removeFromParent();
    this.motes.geometry.dispose();
    this.motes.material.dispose();
    this.glowTex.dispose();
  }
}

/* ─── 내부 ─────────────────────────── */

// 빛 스프라이트와 입자가 같이 쓰는 둥근 번짐 그림(가운데 흰색 → 가장자리 투명)
function createGlowTexture() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const c = cv.getContext("2d")!;
  const gr = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.3, "rgba(255,255,255,.5)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = gr;
  c.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}
