import type * as THREE from "three";

import { BIG_FLOWERS } from "../../assets/settings";
import type { Frame, Thing } from "../core/frame";
import type { Instancer } from "../models/instancer";
import type { Services } from "../services";
import { S } from "../settings";
import { fr } from "../world/hash";
import type { Height, HasHeights } from "../world/tall";
import { NearSet } from "./trees";

// 큰 풍선 꽃: 마을마다 예순 송이. 꽃송이를 밟으면 통 튀고, 줄기에 닿으면 움츠렸다가 꽃송이 높이까지 쏘아 올린다

/** 큰 풍선 꽃 하나 */
export interface BigFlower {
  v: THREE.Vector3;
  g: number;
  H: number;
  I: Instancer;
  yaw: number;
  sq: number;
  i: number;
}

/** 한 종류에 찍는 꽃 수 */
const PER_KIND = 220;

/** 큰 풍선 꽃 */
export class BigFlowers implements Thing, HasHeights {
  readonly list: BigFlower[] = [];
  private readonly near = new NearSet(30);
  private readonly squashing = new Set<BigFlower>();

  constructor(private readonly s: Services) {
    const { models, occ, terrain } = s;
    const FK: Instancer[] = [];
    for (const k of BIG_FLOWERS) {
      const I = models.inst(k, PER_KIND);
      if (I) FK.push(I);
    }
    if (!FK.length) return;
    const HV = occ.hubs;
    for (let hk = 0; hk < HV.length; hk++)
      for (let i0 = 0, got = 0; i0 < 150 && got < 60; i0++) {
        // 마을마다 예순 송이
        const i = hk * 200 + i0,
          distRoll = fr(i, 41),
          dist = 22 + 200 * Math.sqrt(distRoll),
          bearing = 360 * fr(i, 42),
          v = occ.hubAt(hk, dist, bearing),
          I = FK[i % FK.length];
        if (I.n >= PER_KIND || !occ.isFree(v, 5)) continue;
        got++;
        const giantRoll = fr(i, 47),
          H = 8 + 15 * fr(i, 43) * fr(i, 44) + 40 * Math.pow(giantRoll, 5),
          gr = terrain.groundAt(v),
          yaw = 6.28 * fr(i, 45),
          f: BigFlower = { v, g: gr, H, I, yaw, sq: 0, i: 0 };
        const base = gr - 0.2,
          tilt = (fr(i, 46) - 0.5) * 0.16;
        f.i = I.stamp(v, base, H, yaw, tilt);
        this.list.push(f);
        const topReach = H * 0.32,
          reach = Math.max(topReach, 2.6);
        this.near.add(v, reach);
        occ.fill(v, 5);
      }
  }

  /** 고래 길을 정할 때 보는 꼭대기 높이 */
  pushHeights(out: Height[]) {
    for (const f of this.list) out.push([f.v, f.H]);
  }

  /** 꽃송이를 밟으면 통 튀고, 줄기에 닿으면 꽃 위로 쏘아 올린다. 눌리면 흔들리며 꿀렁 */
  update(frame: Frame) {
    const { player, fx, hud } = this.s,
      p = player.p,
      P = player.P,
      held = player.held,
      altA = P.length() - S.R;
    for (const i of this.near.around(p)) {
      const f = this.list[i];
      const d = p.angleTo(f.v) * S.R,
        a = altA - f.g;
      const onTop = d < f.H * 0.32 && a > f.H * 0.55 && a < f.H + 1.6;
      if (!held && onTop && player.vy <= 0.5 && f.sq < 0.3) {
        player.bounce(7.5);
        this.squash(f);
        fx.burst(P, 5, 6);
        hud.sayOnce("flower", "큰 풍선 꽃 — 밟으면 통 튑니다");
      } else if (!held && d < 2.6 && a < f.H * 0.55 && f.sq < 0.3) {
        // 줄기에 닿으면 꽃이 움츠렸다가 꽃송이 높이까지 쏘아 올린다
        this.squash(f);
        const climb = f.H + 5 - Math.max(0, a),
          launchSquared = climb / 0.344,
          launch = Math.sqrt(launchSquared);
        player.lift(launch);
        fx.burst(P, 8, 8);
        hud.sayOnce("flower", "큰 풍선 꽃 — 줄기에 닿으면 꽃 위로 쏘아 올립니다");
      }
    }
    for (const f of this.squashing) {
      const settled = f.sq - frame.dt * 1.4;
      f.sq = Math.max(0, settled);
      const base = f.g - 0.2,
        wigglePhase = f.sq * 14,
        yaw = f.yaw + Math.sin(wigglePhase) * 0.25 * f.sq,
        squishPhase = f.sq * Math.PI * 3,
        squish = 1 - 0.1 * Math.sin(squishPhase) * f.sq;
      f.I.restamp(f.i, f.v, base, f.H, yaw, squish);
      if (f.sq <= 0) this.squashing.delete(f);
    }
  }

  /** 찍어 둔 묶음은 모델 자리(ModelLibrary)가 치운다 */
  dispose() {}

  private squash(f: BigFlower) {
    f.sq = 1;
    this.squashing.add(f);
  }
}
