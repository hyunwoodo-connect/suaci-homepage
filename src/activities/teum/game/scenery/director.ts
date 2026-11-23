import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Services } from "../services";
import { S } from "../settings";
import type { BubbleTrail } from "./bubbleTrail";

// 지루함 감독(오너 목표: 적어도 5초에 한 번은 다른 걸 만나거나 다른 경험을 한다).
// 3초 넘게 아무 일도 없으면, 가는 길 바로 앞(2초쯤 뒤에 닿을 자리)에 무언가를 피워 올린다.
// 땅에서는 방울 길 → 구름 싹 → 바람 고리 차례로 돌려서 같은 것이 연달아 나오지 않게 하고,
// 높이 떠 있을 때는 떨어질 길을 어림해서 그 위에 방울을 놓는다(마지막 방울이 다시 튕겨 올려 하늘에서 이어 탄다).
// '일이 있었다'로 치는 것: 방울·고리를 터뜨림, 놀이기구에 붙잡힘, 위로 튕김(vy 가 5 를 넘는 순간), 생물을 새로 마주친 순간

/** 바람 고리 하나(지나가면 빨라진다) */
interface Gust {
  m: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  v: THREE.Vector3;
  alt: number;
  on: boolean;
  t: number;
}

/** 구름 싹을 피우는 창구(봉오리 밭) */
interface SproutSource {
  sprout(v: THREE.Vector3, g: number, cool: number, sq: number): void;
}

/** 생물 곁인지 묻는 창구 */
interface CreatureSense {
  /** 따라오지 않는 생물 하나라도 14m 안에 있나 */
  isAnyNear(p: Readonly<THREE.Vector3>): boolean;
}

const td = new THREE.Vector3(),
  cand = new THREE.Vector3(),
  spot = new THREE.Vector3(),
  gm = new THREE.Matrix4(),
  gx = new THREE.Vector3(),
  gz = new THREE.Vector3();

/** 지루함 감독 */
export class Director implements Thing {
  private readonly GUST: Gust[] = [];
  /** 아무 일 없이 지난 시간 */
  private bored = 0;
  private lastPops = 0;
  /** 지난 프레임의 vy(튕김을 '넘는 순간'으로 센다) */
  private pvy = 0;
  /** 생물 곁인지 다시 볼 때까지 */
  private crT = 0;
  /** 다음에 피울 것(방울 길·구름 싹·바람 고리 차례) */
  private dirK = 0;
  private gI = 0;
  private wasNear = false;
  private readonly geo = new THREE.TorusGeometry(2.7, 0.2, 10, 44);

  /** 감독이 피우는 바람 고리 둘을 만든다(라임과 겹치지 않게 연노랑) */
  constructor(
    private readonly s: Services,
    private readonly trail: BubbleTrail,
    private readonly seeds: SproutSource,
    private readonly creatures: CreatureSense,
  ) {
    for (let i = 0; i < 2; i++) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xfff3b0,
        transparent: true,
        opacity: 0.9,
        fog: false,
      });
      const m = new THREE.Mesh(this.geo, ringMat);
      m.visible = false;
      m.frustumCulled = false;
      s.scene.add(m);
      const gust: Gust = { m, v: new THREE.Vector3(), alt: 0, on: false, t: 0 };
      this.GUST.push(gust);
    }
  }

  /** 바람 고리를 움직이고, 빈 구간을 재고, 3초(떠 있으면 2.2초) 넘으면 앞길에 하나 피운다. 방울 길 바로 뒤에 부른다 */
  update(f: Frame) {
    const { player, fx } = this.s,
      p = player.p,
      dt = f.dt,
      held = player.held,
      B = this.trail;
    const altA = player.P.length() - S.R;
    for (const gu of this.GUST) {
      if (!gu.on) {
        if (gu.m.visible) {
          gu.m.material.opacity -= dt * 3;
          const grow = 1 + dt * 2.5;
          gu.m.scale.multiplyScalar(grow);
          if (gu.m.material.opacity <= 0) gu.m.visible = false;
        }
        continue;
      }
      gu.t += dt;
      gu.m.visible = true;
      const fadeIn = gu.t * 3;
      const shown = Math.min(1, fadeIn);
      gu.m.material.opacity = 0.9 * shown;
      const pulsePhase = f.time * 5;
      const pulse = 1 + 0.06 * Math.sin(pulsePhase);
      const ringScale = shown * pulse;
      gu.m.scale.setScalar(ringScale);
      const altGap = altA - gu.alt;
      if (!held && gu.v.dot(p) > 0.9999 && p.angleTo(gu.v) * S.R < 3 && Math.abs(altGap) < 3.4) {
        gu.on = false;
        player.boostAtLeast(1.6);
        player.lift(3.2);
        B.pops++;
        fx.burst(gu.m.position, 12, 10);
      } else if (gu.t > 14 || p.angleTo(gu.v) * S.R > 120) gu.on = false;
    }
    this.bored += dt;
    if (B.pops !== this.lastPops) {
      this.lastPops = B.pops;
      this.bored = 0;
    }
    if (held || (player.vy > 5 && this.pvy <= 5)) this.bored = 0;
    this.pvy = player.vy;
    this.crT -= dt;
    if (this.crT <= 0) {
      this.crT = 0.25;
      const nearC = this.creatures.isAnyNear(p);
      // 새로 마주친 순간만 '일이 있었다'로 친다. 곁에 계속 있는 것은 치지 않는다
      if (nearC && !this.wasNear) this.bored = 0;
      this.wasNear = nearC;
    }
    const patience = player.air > 2.5 ? 2.2 : 3;
    if (!B.off && this.bored > patience && B.moved > 0.3 && !held)
      this.bored = this.direct(altA) ? 0.8 : 2.4;
  }

  /** 치운다 */
  dispose() {
    for (const gu of this.GUST) {
      gu.m.removeFromParent();
      gu.m.material.dispose();
    }
    this.geo.dispose();
  }

  // 가는 쪽에서 side 라디안 비튼 방향으로 d 만큼 앞의 자리를 out 에
  private onPath(out: THREE.Vector3, d: number, side: number): THREE.Vector3 {
    const { p, h } = this.s.player;
    td.copy(h).applyAxisAngle(p, side);
    const arc = d / S.R;
    const stepLen = Math.tan(arc);
    return out.copy(p).addScaledVector(td, stepLen).normalize();
  }

  // 앞길에 하나 피운다. 놀이기구 길목(nearCorridor)과 막힌 자리(isFree)에는 놓지 않는다(입구 앞에서 튕겨 내면 기구를 못 탄다)
  private direct(altA: number): boolean {
    const { player, occ, terrain } = this.s,
      spd = this.trail.spd;
    const leadFar = spd * 1.9;
    const lead = Math.max(15, leadFar);
    if (player.air > 2.5) {
      // 떠 있을 때: 떨어질 길 위에 방울
      const dropFar = spd * 1.1;
      const dropDist = Math.max(8, dropFar);
      const v = this.onPath(spot, dropDist, 0);
      const pace = Math.max(4, spd);
      const step = 5 / pace;
      let a = altA,
        vv = player.vy * 2.2;
      for (let k = 0; k < 22; k++) {
        const fall = vv - 7.04 * 0.05;
        vv = Math.max(-9.2, fall);
        a += vv * 0.05;
      }
      const ticks = step / 0.05;
      const ticksPerBubble = Math.round(ticks);
      this.trail.layTrail(v, (j, bv) => {
        for (let k = 0; k < ticksPerBubble; k++) {
          const fall = vv - 7.04 * 0.05;
          vv = Math.max(-9.2, fall);
          a += vv * 0.05;
        }
        const ground = terrain.groundAt(bv);
        const floor = Math.max(ground, 0) + S.hover + 0.2;
        return Math.max(a, floor);
      });
      return true;
    }
    let found = false;
    for (const side of [0, 0.1, -0.1, 0.2, -0.2]) {
      const c = this.onPath(cand, lead, side);
      if (occ.isFree(c, 3) && !occ.nearCorridor(c, 5)) {
        spot.copy(c);
        found = true;
        break;
      }
    }
    if (!found) return false;
    const v = spot;
    const kind = this.dirK++ % 3;
    if (kind === 0) {
      this.trail.layTrail(v, (j, bv) => {
        const ground = terrain.groundAt(bv);
        return Math.max(ground, 0) + S.hover + 0.2;
      });
    } else if (kind === 1) {
      const ground = terrain.groundAt(v);
      const sproutG = Math.max(ground, 0);
      this.seeds.sprout(v, sproutG, 0, 0);
    } else {
      const gu = this.GUST[this.gI++ % this.GUST.length];
      gu.v.copy(v);
      const ground = terrain.groundAt(v);
      gu.alt = Math.max(ground, 0) + S.hover + 0.4;
      gu.on = true;
      gu.t = 0;
      const h = player.h;
      const hUp = h.dot(v);
      gz.copy(h).addScaledVector(v, -hUp).normalize();
      gx.crossVectors(v, gz).normalize();
      gm.makeBasis(gx, v, gz);
      gu.m.quaternion.setFromRotationMatrix(gm);
      const ringR = S.R + gu.alt;
      gu.m.position.copy(v).multiplyScalar(ringR);
    }
    return true;
  }
}
