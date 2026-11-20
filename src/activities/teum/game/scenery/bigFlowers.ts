import type * as THREE from "three";

import { BIG_FLOWERS } from "../../assets/settings";
import type { Frame, Thing } from "../core/frame";
import { scatterHubs, within } from "../maps/map";
import type { Instancer } from "../models/instancer";
import { bigFlowerBody } from "../maps/placed";
import type { Services } from "../services";
import { S } from "../settings";
import type { BodyField } from "../world/bodyField";
import { fr } from "../world/hash";
import type { Height, HasHeights } from "../world/tall";
import { NearSet } from "./trees";

// 큰 풍선 꽃: 마을마다 몇 송이(지도 bigFlowers — v78 은 예순). 꽃송이를 밟으면 통 튀고, 줄기에 닿으면 움츠렸다가 꽃송이 높이까지 쏘아 올린다

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
/** 마을마다 자리를 찾는 고정 난수 번호의 간격(마을끼리 번호가 겹치지 않게 — 지도의 tries 는 이보다 작다) */
const HUB_STRIDE = 200;

/** 큰 풍선 꽃 */
export class BigFlowers implements Thing, HasHeights {
  readonly list: BigFlower[] = [];
  private readonly near = new NearSet(30);
  private readonly squashing = new Set<BigFlower>();
  /** 고른 자리(build 가 심는다) */
  private readonly spots: (Omit<BigFlower, "sq" | "i"> & { tilt: number })[] = [];

  constructor(private readonly s: Services) {
    const { models, occ, terrain } = s;
    const FK: Instancer[] = [];
    for (const k of BIG_FLOWERS) {
      const I = models.inst(k, PER_KIND);
      if (I) FK.push(I);
    }
    if (!FK.length) return;
    const HV = occ.hubs,
      plan = s.map.bigFlowers,
      picked = new Map<Instancer, number>();
    const hubs = scatterHubs(plan, HV.length);
    for (const hk of hubs)
      for (let i0 = 0, got = 0; i0 < plan.tries && got < plan.perHub; i0++) {
        const i = hk * HUB_STRIDE + i0,
          distRoll = fr(i, 41),
          far = Math.sqrt(distRoll),
          dist = within(plan.dist, far),
          bearing = 360 * fr(i, 42),
          v = occ.hubAt(hk, dist, bearing),
          I = FK[i % FK.length],
          count = picked.get(I) ?? 0;
        if (count >= PER_KIND || !occ.isFree(v, plan.clear)) continue;
        got++;
        const taken = count + 1;
        picked.set(I, taken);
        const giantRoll = fr(i, 47),
          H = 8 + 15 * fr(i, 43) * fr(i, 44) + 40 * Math.pow(giantRoll, 5),
          yaw = 6.28 * fr(i, 45),
          tilt = (fr(i, 46) - 0.5) * 0.16,
          g = terrain.groundAt(v);
        this.spots.push({ v, g, H, I, yaw, tilt });
        occ.fill(v, plan.clear);
      }
  }

  /**
   * 고른 자리에 심는다(조형물까지 다 놓인 뒤). field 를 주면 다른 것과 엉키는 꽃은 심지 않는다 —
   * 꽃 자리는 조형물보다 먼저 맡아 두므로(조형물이 꽃 자리를 피한다), 뒤에 선 큰 조형물의 머리와 엉키는 꽃은 여기서 걸러진다
   */
  build(field: BodyField | null) {
    for (const spot of this.spots) {
      const { v, g, H, I, yaw, tilt } = spot,
        body = bigFlowerBody(this.list.length, I.key, I.rw, v, H);
      if (field?.tangles(body)) continue;
      field?.add(body);
      const f: BigFlower = { v, g, H, I, yaw, sq: 0, i: 0 },
        base = g - 0.2;
      f.i = I.stamp(v, base, H, yaw, tilt);
      this.list.push(f);
      const topReach = H * 0.32,
        reach = Math.max(topReach, 2.6);
      this.near.add(v, reach);
    }
    this.spots.length = 0;
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
