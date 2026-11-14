import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Echoing, Tap, Tappable } from "../core/tap";
import { ECHO_REACH, echoTime } from "../core/tap";
import type { GreyMesh } from "../look";
import type { Hold } from "../models/library";
import type { Services } from "../services";
import { GREY_TOY, S } from "../settings";
import { from, UP } from "../world/sphere";

// 칙 종 — 칙 하면 가까운 것들이 가까운 순서로 울린다. 닿아도 울리고 둘레 꽃이 핀다

/** 종 하나(무리마다 큰 종 하나) */
export interface Chime {
  g: THREE.Group;
  w: THREE.Group;
  ball: GreyMesh;
  dist: number;
  bear: number;
  k: number;
  v: THREE.Vector3;
  /** 칙 했을 때 울릴 시각(-1 이면 없음) */
  ringAt: number;
  lit: number;
  model?: Hold;
}

const top = new THREE.Vector3(),
  gp = new THREE.Vector3();

/** 종 전체. 종이 울리는 차례에 기둥·통통 구름·고리도 울린다(echoes) */
export class Chimes implements Thing, Tappable {
  readonly list: Chime[] = [];
  private readonly poleGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8);
  private readonly ballGeo = new THREE.SphereGeometry(0.7, 16, 12);
  private readonly poleMat: THREE.MeshStandardMaterial;

  constructor(
    private readonly s: Services,
    private readonly echoes: readonly Echoing[],
  ) {
    this.poleMat = s.mats.grey(0xa9adac);
    for (const { dist, bear } of s.layout.chime) {
      const gr = new THREE.Group(),
        w = new THREE.Group();
      gr.add(w);
      const pole = new THREE.Mesh(this.poleGeo, this.poleMat);
      pole.position.y = 1.2;
      // 종마다 반응(라임)이 달라 공 재질은 따로
      const ballMat = s.mats.grey(GREY_TOY);
      const ball = new THREE.Mesh(this.ballGeo, ballMat);
      ball.position.y = 2.7;
      w.add(pole, ball);
      s.scene.add(gr);
      const v = new THREE.Vector3();
      const chime: Chime = { g: gr, w, ball, dist, bear, k: 0, v, ringAt: -1, lit: 0 };
      this.list.push(chime);
    }
  }

  /** 자리 */
  layout(keep: THREE.Vector3[]) {
    for (const c of this.list) {
      const spot = from(c.dist, c.bear);
      c.v.copy(spot);
      keep.push(c.v);
      const radius = S.R + this.s.terrain.featGround(c.v);
      c.g.position.copy(c.v).multiplyScalar(radius);
      c.g.quaternion.setFromUnitVectors(UP, c.v);
    }
  }

  /** 자리 차지: 종 둘레 */
  claim() {
    for (const c of this.list) this.s.occ.fill(c.v, 5);
  }

  /** 큰 종 모델(저마다 라임으로 물든다). 먼 것은 장면에서 뗀다 */
  fitModels() {
    const { models, culler } = this.s;
    for (const c of this.list) {
      culler.track(c.g, c.v);
      if (!models.has("bell")) continue;
      const prim = c.w.children.slice(),
        m = models.fit("bell", 13.5, "h", { ownLime: true });
      m.position.y = m.userData.hh;
      c.w.add(m);
      c.model = m;
      models.swapWhenReady("bell", prim);
    }
  }

  /** 칙 둘레의 종은 가까운 것부터 차례로 울린다 */
  onTap(tap: Tap) {
    const n = tap.ground;
    if (!n) return;
    for (const c of this.list) {
      const dist = n.angleTo(c.v) * S.R;
      if (dist < ECHO_REACH) c.ringAt = echoTime(tap, dist);
    }
  }

  /** 굴러온 큰 공이 v 둘레(2.8m)의 종을 울린다 */
  knock(v: THREE.Vector3) {
    for (const c of this.list) if (c.lit < 0.3 && c.v.angleTo(v) * S.R < 2.8) c.lit = 1;
  }

  /** 종이 차례로 울리고, 닿으면 울리며 둘레 꽃이 핀다. 그 차례에 기둥·구름·고리도 칙 소리에 반응한다 */
  update(f: Frame) {
    const { player, mats, fx, hud, terrain } = this.s,
      dt = f.dt,
      time = f.time;
    for (const c of this.list) {
      if (c.ringAt > 0 && time >= c.ringAt) {
        c.ringAt = -1;
        c.lit = 1;
        hud.sayOnce("chime", "칙 — 가까운 것들이 차례로 울립니다");
      }
      if (!player.held) player.block(c.v, 2.6, 8);
      const touched =
        !player.held &&
        player.air < 8 &&
        c.lit < 0.2 &&
        c.ringAt < 0 &&
        player.p.angleTo(c.v) * S.R < 4.6;
      if (touched) {
        // 닿으면 울리고 둘레 꽃이 핀다. 같은 무리의 종은 거리만큼 늦게 따라 울린다
        top.copy(c.g.position).addScaledVector(c.v, 5);
        fx.burst(top, 10, 8);
        terrain.lightFlowers(c.v, 700);
        for (const o of this.list)
          if (o.dist === c.dist && o.bear === c.bear && o.lit < 0.2)
            o.ringAt = time + 0.01 + o.v.angleTo(c.v) * S.R * 0.045;
        hud.sayOnce("chime", "종 — 닿으면 울립니다. 칙 해도 울립니다");
      }
      const dimmed = c.lit - dt * 0.7;
      c.lit = Math.max(0, dimmed);
      const wobblePhase = time * 3 + c.k;
      const swell = 1 + c.lit * 0.8 + 0.04 * Math.sin(wobblePhase);
      c.ball.scale.setScalar(swell);
      const glowRaw = c.lit * 1.5;
      const glow = Math.min(1, glowRaw);
      c.ball.material.color.copy(mats.toy.chime).lerp(mats.lime, glow);
      const swingPhase = c.lit * 16;
      c.w.rotation.z = Math.sin(swingPhase) * 0.4 * c.lit;
      if (c.model) c.model.userData.uLime.value = c.lit * 0.5;
      if (c.lit > 0) {
        gp.copy(c.g.position).addScaledVector(c.v, 2.6);
        fx.glow(gp, 3.6, c.lit);
      }
    }
    for (const e of this.echoes) e.echo(time);
  }

  /** 치운다 */
  dispose() {
    for (const c of this.list) {
      c.g.removeFromParent();
      c.ball.material.dispose();
    }
    this.poleGeo.dispose();
    this.ballGeo.dispose();
    this.poleMat.dispose();
  }
}
