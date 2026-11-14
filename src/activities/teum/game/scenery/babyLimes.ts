import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Instancer } from "../models/instancer";
import type { Services } from "../services";
import { S } from "../settings";
import { fr } from "../world/hash";
import type { Footsteps } from "./footsteps";

// 꼬마 라임: 마을마다 둘씩 여기저기 숨어 있다가, 닿으면 졸졸 따라온다(줄 선 순서만큼 뒤의 발자취를 따라간다)

/** 꼬마 라임 하나 */
export interface Baby {
  v: THREE.Vector3;
  g: number;
  ph: number;
  join: boolean;
  order: number;
  pos: THREE.Vector3;
  a: number;
  i: number;
}

/** 꼬마 라임 */
export class BabyLimes implements Thing {
  readonly list: Baby[] = [];
  /** 따라오는 수(만난 손님은 이 뒤에 줄 선다) */
  joined = 0;
  private readonly BL: Instancer | null;

  constructor(
    private readonly s: Services,
    private readonly footsteps: Footsteps,
  ) {
    const { models, occ, terrain } = s;
    const BL = models.inst("lime", 12);
    this.BL = BL;
    if (!BL) return;
    // 늘 따라다니므로 가까운 것만 그리기에서 뺀다
    BL.noCull = true;
    const HV = occ.hubs;
    for (let hk = 0; hk < HV.length; hk++)
      for (let i0 = 0, got = 0; i0 < 40 && got < 2; i0++) {
        const i = hk * 50 + i0,
          distRoll = fr(i, 81),
          dist = 34 + 170 * Math.sqrt(distRoll),
          bearing = 360 * fr(i, 82),
          v = occ.hubAt(hk, dist, bearing);
        if (!occ.isFree(v, 4)) continue;
        got++; // 마을마다 둘
        const ground = terrain.groundAt(v);
        const baby: Baby = {
          v,
          g: ground,
          ph: 6.28 * fr(i, 83),
          join: false,
          order: 0,
          pos: v.clone(),
          a: 0,
          i: BL.stamp(v, ground, 1.4, 0),
        };
        this.list.push(baby);
        occ.fill(v, 4);
      }
  }

  /** 숨어서 통통 뛰다가, 닿으면 줄지어 따라온다 */
  update(f: Frame) {
    const BL = this.BL;
    if (!BL) return;
    const { player, fx, hud } = this.s,
      p = player.p,
      P = player.P,
      held = player.held,
      time = f.time,
      hist = this.footsteps.hist;
    for (const b of this.list) {
      if (!b.join) {
        const hopPhase = time * 2.4 + b.ph,
          hopWave = Math.sin(hopPhase),
          hop = Math.abs(hopWave) * 0.9,
          height = b.g + hop,
          yaw = time * 1.2 + b.ph;
        BL.put(b.i, b.v, height, 1.4, yaw);
        if (!held && player.air < 4 && p.angleTo(b.v) * S.R < 2.6) {
          b.join = true;
          b.order = this.joined++;
          b.pos.copy(b.v);
          b.a = b.g;
          fx.burst(P, 8, 7);
          const n = this.joined,
            all = this.list.length;
          const joinLine =
            n < all
              ? "꼬마 라임 — 졸졸 따라옵니다 (" + n + "/" + all + ")"
              : "꼬마 라임을 모두 모았습니다";
          hud.say(joinLine);
          if (n === all)
            for (let k = 0; k < 3; k++) {
              const power = 9 + k * 4;
              fx.burst(P, 20, power);
            }
        }
      } else {
        // 줄 선 순서만큼 뒤의 발자취를 따라간다
        const lastStep = hist.length - 1,
          trailGap = 6 * (b.order + 1),
          gapIndex = Math.min(lastStep, trailGap),
          hgt = hist[gapIndex],
          followRate = -9 * f.dt,
          follow = 1 - Math.exp(followRate);
        b.pos.lerp(hgt.p, follow).normalize();
        b.a += (hgt.a - 0.7 - b.a) * follow;
        const hopPhase = time * 7 + b.order * 1.3,
          hopWave = Math.sin(hopPhase),
          height = b.a + Math.abs(hopWave) * 0.45,
          yaw = time * 3 + b.order;
        BL.put(b.i, b.pos, height, 1.2, yaw);
      }
    }
  }

  /** 찍어 둔 묶음은 모델 자리(ModelLibrary)가 치운다 */
  dispose() {}
}
