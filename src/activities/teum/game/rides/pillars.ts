import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Echoing, Tap, Tappable } from "../core/tap";
import { ECHO_REACH, echoTime } from "../core/tap";
import type { Services } from "../services";
import { S } from "../settings";
import type { LayoutRow } from "../world/layout";
import { from, FWD, heading, step, UP } from "../world/sphere";

// 기둥 줄 — 지나가면 하나씩 불이 켜지며 솟는다.
// 풍선 꽃: 줄기 하나에 꽃잎 일곱. 지나가면 줄기가 자라고 꽃이 활짝 핀다(줄기는 길이만 늘어나서 모양이 뭉개지지 않는다).
// 줄기·꽃잎·꽃 심을 각각 한 번에 그린다(기둥 360여 개 × 아홉 조각을 낱개로 두면 장면이 무거워진다).
// 불이 꺼진 기둥은 모양이 그대로라, 불이 켜졌거나 막 꺼진 것만 다시 찍는다

/** 풍선 꽃 기둥 하나 */
export interface Pillar {
  r: LayoutRow;
  i: number;
  v: THREE.Vector3;
  lit: number;
  base: number;
  /** 칙 했을 때 울릴 시각(-1 이면 없음) */
  ringAt: number;
  /** 줄기 밑동(세계 자리)과 땅에 세운 돌림 */
  root: THREE.Vector3;
  q: THREE.Quaternion;
  /** 꽃이 보는 쪽(줄을 따라 날아오는 쪽을 보고 살짝 위로 든다) */
  headQ: THREE.Quaternion;
  /** 이번 프레임 꽃 자리(빛을 둔다) */
  head: THREE.Vector3;
  /** 그리는 칸(-1 이면 지금 안 그림) */
  slot: number;
  /** 지난번에 찍을 때 불이 켜져 있었나(꺼지는 순간 한 번 더 찍는다) */
  drawnLit: boolean;
}

/** 꽃잎 수 */
const PETALS = 7;

const fz = new THREE.Vector3(),
  bx = new THREE.Vector3(),
  hy = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  headM = new THREE.Matrix4(),
  sc = new THREE.Vector3(),
  col = new THREE.Color();
/** 기둥에 닿는 거리(5.6m)보다 확실히 먼 것은 거리 셈(acos)을 건너뛴다 — 경계는 아래 셈이 정한다 */
const TOUCH_ARC = 5.6 / S.R;
const COS_TOUCH = Math.cos(TOUCH_ARC) - 1e-9;

/** 기둥 줄 전체 */
export class Pillars implements Thing, Tappable, Echoing {
  readonly list: Pillar[] = [];
  /** 꽃 심 재질(흰색) */
  readonly core: THREE.MeshStandardMaterial;
  private readonly stemGeo: THREE.BufferGeometry;
  private readonly petalGeo: THREE.SphereGeometry;
  private readonly bodyMat: THREE.MeshStandardMaterial;
  private readonly stems: THREE.InstancedMesh;
  private readonly petals: THREE.InstancedMesh;
  private readonly cores: THREE.InstancedMesh;
  /** 꽃 그룹 안에서 꽃잎 일곱·심의 자리(꽃 행렬 뒤에 곱한다) */
  private readonly petalLocal: THREE.Matrix4[] = [];
  private readonly coreLocal = new THREE.Matrix4();
  /** 지난 프레임 시각(가까운 것을 다시 고를 때 꽃의 박동을 맞춘다) */
  private lastTime = 0;

  constructor(private readonly s: Services) {
    this.petalGeo = new THREE.SphereGeometry(1, 16, 12);
    this.stemGeo = new THREE.CylinderGeometry(0.3, 0.42, 1, 12).translate(0, 0.5, 0);
    // 줄기·꽃잎의 색은 기둥마다(라임으로 켜진 정도) 달라 인스턴스 색으로 칠한다(재질은 흰색 바탕)
    this.bodyMat = s.mats.grey(0xffffff);
    this.core = s.mats.grey(0xffffff);
    for (const r of s.layout.row)
      for (let i = 0; i < r.n; i++) {
        const pillar: Pillar = {
          r,
          i,
          v: new THREE.Vector3(),
          lit: 0,
          base: 2.6 + (i % 4) * 0.9,
          ringAt: -1,
          root: new THREE.Vector3(),
          q: new THREE.Quaternion(),
          headQ: new THREE.Quaternion(),
          head: new THREE.Vector3(),
          slot: -1,
          drawnLit: false,
        };
        this.list.push(pillar);
      }
    for (let k = 0; k < PETALS; k++) {
      const a = (k * Math.PI * 2) / PETALS;
      const px = Math.cos(a) * 1.2,
        py = Math.sin(a) * 1.2;
      const at = new THREE.Vector3(px, py, 0),
        turn = new THREE.Quaternion().setFromAxisAngle(FWD, a),
        size = new THREE.Vector3(0.95, 0.52, 0.42);
      const local = new THREE.Matrix4().compose(at, turn, size);
      this.petalLocal.push(local);
    }
    const coreAt = new THREE.Vector3(0, 0, 0.14),
      coreSize = new THREE.Vector3(0.66, 0.66, 0.5),
      noTurn = new THREE.Quaternion();
    this.coreLocal.compose(coreAt, noTurn, coreSize);
    const n = this.list.length,
      petalCount = n * PETALS;
    this.stems = newInstances(this.stemGeo, this.bodyMat, n);
    this.petals = newInstances(this.petalGeo, this.bodyMat, petalCount);
    this.cores = newInstances(this.petalGeo, this.core, n);
    s.scene.add(this.stems, this.petals, this.cores);
  }

  /** 자리: 좌우로 엇갈리고, 꽃은 줄을 따라 날아오는 쪽을 보고 살짝 위로 든다 */
  layout(keep: THREE.Vector3[]) {
    const terrain = this.s.terrain;
    let pi = 0;
    for (const r of this.s.layout.row) {
      let v = from(r.dist, r.bear),
        d = heading(v, r.head);
      for (let i = 0; i < r.n; i++) {
        const pl = this.list[pi++],
          side = new THREE.Vector3().crossVectors(v, d).normalize();
        const sideStep = (i % 2 ? 3.2 : -3.2) / S.R;
        pl.v.copy(v).addScaledVector(side, sideStep).normalize();
        keep.push(pl.v);
        const radius = S.R + terrain.featGround(pl.v);
        pl.root.copy(pl.v).multiplyScalar(radius);
        pl.q.setFromUnitVectors(UP, pl.v);
        fz.copy(d).multiplyScalar(-0.9).addScaledVector(pl.v, 0.44).normalize();
        bx.crossVectors(pl.v, fz).normalize();
        hy.crossVectors(fz, bx);
        m4.makeBasis(bx, hy, fz);
        pl.headQ.setFromRotationMatrix(m4);
        [v, d] = step(v, d, 5, 2);
      }
    }
    // 처음엔 모두 그린다. 그 뒤로는 가까운 것만 칸에 채운다(나머지 것들과 같은 기준·같은 때)
    this.fill(-1);
    this.s.culler.onCull((cut) => this.fill(cut));
  }

  /** 자리 차지: 기둥 둘레 */
  claim() {
    for (const pl of this.list) this.s.occ.fill(pl.v, 5);
  }

  /** 칙 둘레의 기둥은 가까운 것부터 차례로 켜진다 */
  onTap(tap: Tap) {
    const n = tap.ground;
    if (!n) return;
    for (const pl of this.list) {
      const dist = n.angleTo(pl.v) * S.R;
      if (dist < ECHO_REACH) pl.ringAt = echoTime(tap, dist);
    }
  }

  /** 울릴 시각이 된 기둥이 켜진다(종이 울리는 차례에 같이) */
  echo(time: number) {
    for (const pl of this.list)
      if (pl.ringAt > 0 && time >= pl.ringAt) {
        pl.ringAt = -1;
        pl.lit = 1;
      }
  }

  /** 굴러온 큰 공이 v 둘레(2.8m)의 기둥을 켠다 */
  knock(v: THREE.Vector3) {
    for (const pl of this.list) if (pl.v.angleTo(v) * S.R < 2.8) pl.lit = 1;
  }

  /** 지나가면 불이 켜지며 솟고 꽃이 핀다 */
  update(f: Frame) {
    const { player, hud, fx } = this.s,
      dt = f.dt,
      p = player.p;
    this.lastTime = f.time;
    let changed = false;
    for (const pl of this.list) {
      const close = player.air < 7 && p.dot(pl.v) > COS_TOUCH && p.angleTo(pl.v) * S.R < 5.6;
      if (close) {
        if (pl.lit <= 0.2 && pl.i === 0) hud.say("기둥 줄 — 지나가면 하나씩 솟습니다");
        pl.lit = 1;
      } else if (pl.lit > 0) {
        const dimmed = pl.lit - dt * 0.45;
        pl.lit = Math.max(0, dimmed);
      }
      const isLit = pl.lit > 0;
      if (!isLit && !pl.drawnLit) continue;
      this.shape(pl, f.time);
      pl.drawnLit = isLit;
      changed = true;
      if (isLit) {
        const alpha = pl.lit * 0.8;
        fx.glow(pl.head, 6.5, alpha);
      }
    }
    if (changed) this.flag();
  }

  /** 치운다 */
  dispose() {
    for (const m of [this.stems, this.petals, this.cores]) {
      m.removeFromParent();
      m.dispose();
    }
    this.stemGeo.dispose();
    this.petalGeo.dispose();
    this.bodyMat.dispose();
    this.core.dispose();
  }

  // 가까운 것(v·p > cut)만 칸에 채운다
  private fill(cut: number) {
    const p = this.s.player.p;
    let n = 0;
    for (const pl of this.list) {
      pl.slot = pl.v.dot(p) > cut ? n++ : -1;
      if (pl.slot >= 0) this.shape(pl, this.lastTime);
    }
    this.stems.count = n;
    this.cores.count = n;
    this.petals.count = n * PETALS;
    this.flag();
  }

  // 기둥 하나의 줄기·꽃잎·심을 지금 불빛대로 찍는다(그리는 칸이 있을 때만)
  private shape(pl: Pillar, time: number) {
    const e = pl.lit * pl.lit * (3 - 2 * pl.lit);
    const hgt = pl.base * (1 + e * 0.9);
    const headLift = hgt + 0.7;
    pl.head.copy(pl.root).addScaledVector(pl.v, headLift);
    if (pl.slot < 0) return;
    const { mats } = this.s;
    col.copy(mats.toy.pillar).lerp(mats.lime, e);
    sc.set(1, hgt, 1);
    m4.compose(pl.root, pl.q, sc);
    this.stems.setMatrixAt(pl.slot, m4);
    this.stems.setColorAt(pl.slot, col);
    const pulsePhase = time * 10 + pl.i;
    const bloom = (0.72 + 0.7 * e) * (1 + 0.1 * Math.sin(pulsePhase) * e);
    sc.setScalar(bloom);
    headM.compose(pl.head, pl.headQ, sc);
    const first = pl.slot * PETALS;
    for (let k = 0; k < PETALS; k++) {
      m4.multiplyMatrices(headM, this.petalLocal[k]);
      const at = first + k;
      this.petals.setMatrixAt(at, m4);
      this.petals.setColorAt(at, col);
    }
    m4.multiplyMatrices(headM, this.coreLocal);
    this.cores.setMatrixAt(pl.slot, m4);
  }

  private flag() {
    for (const m of [this.stems, this.petals, this.cores]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}

/* ─── 내부 ─────────────────────────── */

// 한 번에 그리는 묶음 하나(가까운 것만 칸을 채우므로 three 의 화면 밖 거르기는 끈다)
function newInstances(
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  count: number,
): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.frustumCulled = false;
  m.count = 0;
  return m;
}
