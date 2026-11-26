import type { Frame, Thing } from "../core/frame";
import type { Cannons } from "../rides/cannons";
import { NearSet } from "../scenery/trees";
import type { Trees } from "../scenery/trees";
import type { Services } from "../services";
import { S } from "../settings";
import type { Height, HasHeights } from "../world/tall";
import type { Deco } from "./deco";
import type { PlaceStats } from "./placement";
import { placeSculptures } from "./placement";

// 조형물: 밟으면 꿀렁이고, 꼭대기에 내려앉으면 튀고, 문은 지나가면 빨라지고, 몸통은 막히고, 팽이는 곁에 가면 돈다.
// 어디에 무엇을 놓는지는 놓기(placement)가 정하고, 여기는 놓인 것을 받아 두고 매 프레임 곁의 것만 본다

/** 조형물 전체(숲의 나무는 Trees 가 갖는다) */
export class Sculptures implements Thing, HasHeights {
  readonly list: Deco[] = [];
  readonly stats: PlaceStats = {
    anchor: 0,
    gate: 0,
    avenue: 0,
    grove: 0,
    ladder: 0,
    crown: 0,
    fill: 0,
    lone: 0,
    sky: 0,
  };
  /** 마을마다의 랜드마크: 그 마을 기준탑(지역 종류에서 뽑힌 큰 조형물). 못 놓은 마을은 비어 있다 */
  readonly landmarks: (Deco | undefined)[] = [];
  private readonly near = new NearSet(30);
  private readonly squashing = new Set<Deco>();

  constructor(
    private readonly s: Services,
    trees: Trees,
    cannons: Cannons,
  ) {
    const into = {
      list: this.list,
      stats: this.stats,
      landmarks: this.landmarks,
      near: this.near,
    };
    placeSculptures(s, trees, cannons, into);
  }

  /** 고래 길을 정할 때 보는 꼭대기 높이 */
  pushHeights(out: Height[]) {
    for (const o of this.list) {
      const top = o.g + o.H;
      out.push({ v: o.v, r: o.r, bottom: 0, top });
    }
  }

  /** 눌리면 꿀렁, 꼭대기에 내려앉으면 통 튀고(푸딩은 더 높이), 문은 지나가면 빨라지고, 몸통은 막힌다. 팽이는 곁에 가면 돈다 */
  update(f: Frame) {
    const { player, fx } = this.s,
      p = player.p,
      P = player.P,
      dt = f.dt;
    const altA = P.length() - S.R;
    // 눌린 것만 다시 찍는다(먼 것도 다 펴질 때까지)
    for (const o of this.squashing) {
      const squashLeft = o.sq - dt * 1.5;
      o.sq = Math.max(0, squashLeft);
      const sink = o.floats ? 0 : o.H * 0.02;
      const base = o.g - sink;
      const wobblePhase = o.sq * Math.PI * 3;
      const squash = 1 - 0.08 * Math.sin(wobblePhase) * o.sq;
      o.I.restamp(o.i, o.v, base, o.H, o.yaw, squash);
      if (o.sq <= 0) this.squashing.delete(o);
    }
    if (player.held) return;
    for (const idx of this.near.around(p)) {
      const o = this.list[idx];
      if (o.v.dot(p) < 0.99) continue;
      const d = p.angleTo(o.v) * S.R,
        a = altA - o.g;
      if (d > o.r + 1 || a > o.H + 2 || a < -1) continue;
      if ((o.cool ?? 0) > 0) o.cool! -= dt;
      if (o.spins && d < o.r + 1) {
        o.yaw += dt * 2.5;
        if (o.sq <= 0) {
          const base = o.g - o.H * 0.02;
          o.I.restamp(o.i, o.v, base, o.H, o.yaw, 1);
        }
      } // 팽이는 곁에 가면 돈다
      if (player.vy <= 0.5 && a > o.H * 0.82 && d < o.r * 0.9) {
        const launch = (8.5 + o.H * 0.13) * o.bounce;
        const capped = Math.min(22, launch);
        player.bounce(capped);
        this.squash(o, 1);
        fx.burst(P, 7, 7);
      } // 꼭대기에 내려앉으면 통 튄다(푸딩은 더 높이)
      else if (o.gate) {
        if (a < o.H * 0.8 && d < o.r * 0.55 && !((o.cool ?? 0) > 0)) {
          player.boostAtLeast(1.4);
          o.cool = 2.5;
          this.squash(o, 1);
          fx.burst(P, 9, 9);
        }
      } // 도넛·사탕 문: 막지 않는다. 지나가면 휙 빨라진다
      else if (a < o.H * 0.82 && d < o.r * 0.6) {
        const blockR = o.r * 0.6;
        player.blockBody(o.v, blockR);
        if (o.sq < 0.3) this.squash(o, 0.5);
      } // 몸통은 막힌다
    }
  }

  /** 찍어 둔 묶음은 모델 자리(ModelLibrary)가 치운다 */
  dispose() {}

  private squash(o: Deco, k: number) {
    o.sq = k;
    this.squashing.add(o);
  }
}
