import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Echoing, Tap, Tappable } from "../core/tap";
import { ECHO_REACH, echoTime } from "../core/tap";
import type { GreyMesh } from "../look";
import type { Services } from "../services";
import { GREY_TOY, S } from "../settings";
import type { LayoutChain } from "../world/layout";
import { from, heading, step } from "../world/sphere";
import { basis } from "./bars";
import type { Streams } from "./streams";

// 고리 줄 — 통과하면 그 방향으로 슝 밀려 올라간다. 줄을 타면 하늘까지 간다

/** 고리 하나 */
export interface Ring {
  m: GreyMesh;
  c: LayoutChain;
  i: number;
  v: THREE.Vector3;
  d: THREE.Vector3;
  pos: THREE.Vector3;
  h: number;
  cool: number;
  lit: number;
  /** 칙 했을 때 울릴 시각(-1 이면 없음) */
  ringAt: number;
}

const tmp = new THREE.Vector3();

/** 고리 줄 전체 */
export class Rings implements Thing, Tappable, Echoing {
  readonly list: Ring[] = [];
  private readonly geo = new THREE.TorusGeometry(7, 0.9, 14, 48);

  constructor(private readonly s: Services) {
    for (const c of s.layout.chain)
      for (let i = 0; i < c.n; i++) {
        // 고리마다 반응(라임)이 달라 재질은 따로
        const mat = s.mats.grey(GREY_TOY);
        const m = new THREE.Mesh(this.geo, mat);
        s.scene.add(m);
        const ring: Ring = {
          m,
          c,
          i,
          v: new THREE.Vector3(),
          d: new THREE.Vector3(),
          pos: new THREE.Vector3(),
          h: 0,
          cool: 0,
          lit: 0,
          ringAt: -1,
        };
        this.list.push(ring);
      }
  }

  /** 자리: 바람길 끝에서 잇거나 제 자리에서, 고리마다 조금씩 높게 */
  layout(keep: THREE.Vector3[], streams: Streams) {
    let ri = 0;
    for (const c of this.s.layout.chain) {
      const af = c.afterStream != null ? streams.list[c.afterStream] : null;
      let v = af ? af.endV.clone() : from(c.dist!, c.bear!),
        d = af ? af.endD.clone() : heading(v, c.head!);
      for (let i = 0; i < c.n; i++) {
        const r = this.list[ri++];
        r.v.copy(v);
        r.d.copy(d);
        r.h = this.s.terrain.featGround(v) + 5 + i * c.rise * 2.2;
        keep.push(r.v);
        const radius = S.R + r.h;
        r.pos.copy(v).multiplyScalar(radius);
        r.m.position.copy(r.pos);
        basis(r.m, r.v, r.d);
        [v, d] = step(v, d, c.gap, c.curve);
      }
    }
    for (const r of this.list) this.s.culler.track(r.m, r.v);
  }

  /** 자리 차지: 고리 둘레, 그리고 고리 길(비행 통로) */
  claim() {
    for (const r of this.list) {
      this.s.occ.fill(r.v, 5);
      this.s.occ.addCorridor(r.v, 8);
    }
  }

  /** 칙 둘레의 고리는 가까운 것부터 차례로 울린다 */
  onTap(tap: Tap) {
    const n = tap.ground;
    if (!n) return;
    for (const r of this.list) {
      const dist = n.angleTo(r.v) * S.R;
      if (dist < ECHO_REACH) r.ringAt = echoTime(tap, dist);
    }
  }

  /** 울릴 시각이 된 고리가 빛난다(종이 울리는 차례에 같이) */
  echo(time: number) {
    for (const r of this.list)
      if (r.ringAt > 0 && time >= r.ringAt) {
        r.ringAt = -1;
        r.lit = 1;
      }
  }

  /** 통과하면 고리 방향으로 밀려 올라간다 */
  update(f: Frame) {
    const { player, mats, fx, hud } = this.s,
      dt = f.dt,
      p = player.p;
    for (const r of this.list) {
      const altOffset = player.alt - r.h;
      if (r.cool > 0) r.cool -= dt;
      else if (p.angleTo(r.v) * S.R < 7.6 && Math.abs(altOffset) < 11) {
        const sgn = player.vel.dot(r.d) >= 0 ? 1 : -1;
        tmp.copy(r.d).multiplyScalar(sgn);
        player.turnTo(tmp, 0.85);
        player.lookTo(tmp, 0.45);
        player.boost(1.7);
        const lift = sgn > 0 ? 6.6 : 2;
        player.bounce(lift);
        r.cool = 1.6;
        r.lit = 1;
        if (r.i === 0 && sgn > 0) hud.say("고리 줄 — 따라가면 하늘까지 올라갑니다");
      }
      if (r.lit > 0) {
        const dimmed = r.lit - dt * 0.5;
        r.lit = Math.max(0, dimmed);
      }
      const glowRaw = r.lit * 1.6;
      const glow = Math.min(1, glowRaw);
      r.m.material.color.copy(mats.toy.ring).lerp(mats.lime, glow);
      const swell = 1 + r.lit * 0.18;
      r.m.scale.setScalar(swell);
      if (r.lit > 0) fx.glow(r.pos, 15, r.lit);
    }
  }

  /** 치운다 */
  dispose() {
    for (const r of this.list) {
      r.m.removeFromParent();
      r.m.material.dispose();
    }
    this.geo.dispose();
  }
}
