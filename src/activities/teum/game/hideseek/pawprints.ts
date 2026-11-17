import * as THREE from "three";

import { S } from "../settings";
import { FWD } from "../world/sphere";

// 토끼 발자국 도장: 발 모양 한 쌍(라임, 먹색 테두리)이 땅에 납작 붙는다. 정한 시간 동안 남았다가 옅어지고,
// 내가 밟고 지나가면 그 도장은 통 튀며 사라진다(밟는 맛). 마지막 셋은 다른 것보다 크고 밝다(여기가 끝이라는 뜻)

/** 동시에 남는 도장 수 · 한 쌍의 폭(m — 폰에서 15m 거리면 40px 쯤) · 마지막 도장의 크기 배수 · 밟은 것으로 치는 거리(m)·높이(m) · 밟으면 튀는 시간(초) */
const PRINTS = 48,
  PRINT_W = 0.85,
  LAST_SCALE = 1.45,
  STOMP_REACH = 1.1,
  STOMP_AIR = 1.2,
  POP_SECONDS = 0.25;
/** 땅에서 띄우는 높이(m) · 끝에서 옅어지는 시간(초) */
const LIFT = 0.07,
  FADE_SECONDS = 1.5,
  TAU = Math.PI * 2;

/** 도장 하나 */
interface Print {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  v: THREE.Vector3;
  t: number;
  life: number;
  size: number;
  popT: number;
}

const up = new THREE.Vector3(),
  spin = new THREE.Quaternion();

/** 토끼 발자국 */
export class Pawprints {
  private readonly prints: Print[] = [];
  private next = 0;
  private readonly tex: THREE.CanvasTexture;
  private readonly geo = new THREE.PlaneGeometry(1, 1);

  constructor(scene: THREE.Scene) {
    this.tex = pawTexture();
    for (let i = 0; i < PRINTS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.tex,
        transparent: true,
        depthWrite: false,
        fog: false,
      });
      const mesh = new THREE.Mesh(this.geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 4;
      scene.add(mesh);
      const v = new THREE.Vector3();
      this.prints.push({ mesh, v, t: 0, life: 0, size: 1, popT: -1 });
    }
  }

  /** 도장을 찍는다: 땅 위 v(단위 벡터, 땅 높이 ground), 발끝이 향하는 쪽 f(접선), life 초 동안 */
  stamp(v: THREE.Vector3, ground: number, f: THREE.Vector3, life: number) {
    const pr = this.prints[this.next];
    this.next = (this.next + 1) % PRINTS;
    pr.v.copy(v).normalize();
    const lift = S.R + ground + LIFT;
    pr.mesh.position.copy(pr.v).multiplyScalar(lift);
    // 판(+z 가 위)을 땅에 눕히고, 판의 +y(발끝)가 f 를 보게 돌린다
    pr.mesh.quaternion.setFromUnitVectors(FWD, pr.v);
    up.set(0, 1, 0).applyQuaternion(pr.mesh.quaternion);
    const fUp = f.dot(pr.v),
      ahead = f.clone().addScaledVector(pr.v, -fUp).normalize();
    spin.setFromUnitVectors(up, ahead);
    pr.mesh.quaternion.premultiply(spin);
    pr.t = 0;
    pr.life = life;
    pr.size = PRINT_W;
    pr.popT = -1;
    pr.mesh.material.color.setScalar(1);
    pr.mesh.visible = true;
  }

  /** 마지막 n 개를 크고 밝게(끝이라는 뜻) */
  markLast(n: number) {
    for (let i = 1; i <= n; i++) {
      const at = (this.next - i + PRINTS) % PRINTS,
        pr = this.prints[at];
      if (pr.life <= 0) continue;
      pr.size = PRINT_W * LAST_SCALE;
      pr.mesh.material.color.setScalar(1.35);
    }
  }

  /** 모두 지운다(새 판) */
  clear() {
    for (const pr of this.prints) {
      pr.life = 0;
      pr.mesh.visible = false;
    }
  }

  /** 한 프레임: 옅어지고, 내가 밟은 것은 통 튀며 사라진다. 이번에 밟은 수 */
  update(dt: number, me: THREE.Vector3, air: number): number {
    let stomped = 0;
    for (const pr of this.prints) {
      if (pr.life <= 0) continue;
      pr.t += dt;
      if (pr.popT >= 0) {
        pr.popT += dt;
        const u = pr.popT / POP_SECONDS;
        if (u >= 1) {
          pr.life = 0;
          pr.mesh.visible = false;
          continue;
        }
        const grown = pr.size * (1 + 0.8 * u);
        pr.mesh.scale.setScalar(grown);
        pr.mesh.material.opacity = 1 - u;
        continue;
      }
      if (pr.t >= pr.life) {
        pr.life = 0;
        pr.mesh.visible = false;
        continue;
      }
      const near = pr.v.angleTo(me) * S.R;
      if (near < STOMP_REACH && air < STOMP_AIR) {
        pr.popT = 0;
        stomped++;
        continue;
      }
      const left = pr.life - pr.t,
        fadeShare = left / FADE_SECONDS,
        fade = Math.min(1, fadeShare),
        popIn = pr.t * 8,
        grown = Math.min(1, popIn),
        scale = pr.size * grown;
      pr.mesh.scale.setScalar(scale);
      pr.mesh.material.opacity = fade;
    }
    return stomped;
  }

  dispose() {
    for (const pr of this.prints) {
      pr.mesh.removeFromParent();
      pr.mesh.material.dispose();
    }
    this.geo.dispose();
    this.tex.dispose();
  }
}

/* ─── 내부 ─────────────────────────── */

// 발 한 쌍: 라임 발바닥 둘(왼발은 조금 뒤)과 발가락 셋씩, 먹색 테두리
function pawTexture(): THREE.CanvasTexture {
  const size = 128,
    cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d");
  if (g) {
    g.lineWidth = 6;
    g.strokeStyle = "#141414";
    g.fillStyle = "#A9FF39";
    const foot = (cx: number, cy: number) => {
      g.beginPath();
      g.ellipse(cx, cy, 15, 22, 0, 0, TAU);
      g.fill();
      g.stroke();
      for (const dx of [-12, 0, 12]) {
        g.beginPath();
        const tx = cx + dx,
          ty = cy - 30;
        g.arc(tx, ty, 7, 0, TAU);
        g.fill();
        g.stroke();
      }
    };
    foot(40, 82);
    foot(88, 66);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
