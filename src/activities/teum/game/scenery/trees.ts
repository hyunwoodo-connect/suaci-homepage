import * as THREE from "three";

import { TREE_CROWN_BASE } from "../../assets/settings";
import type { Frame, Thing } from "../core/frame";
import type { Instancer } from "../models/instancer";
import type { Services } from "../services";
import { S } from "../settings";
import type { Clouds } from "../world/clouds";
import { fr } from "../world/hash";
import { from } from "../world/sphere";
import type { Height, HasHeights } from "../world/tall";
import { CLOUD_N } from "../world/terrain";

// 키 큰 솜사탕 나무: 자리표에 정해 둔 나무(놀이와 겹치지 않게 미리 고른 자리)와 조형물 숲의 나무(sculptures 가 심는다).
// 위에 내려앉으면 통 튀고, 갓 옆으로는 갓에, 갓 아래로는 줄기에 막힌다. 눌리면 꿀렁

/** 키 큰 나무 한 종류: 찍는 묶음과 갓이 시작하는 높이(키 대비) */
export interface TreeKind {
  I: Instancer;
  cb: number;
}

/** 키 큰 솜사탕 나무 하나: 갓 반지름(cr)·갓 높이(cb)·줄기 반지름(tr) */
export interface Tree {
  v: THREE.Vector3;
  g: number;
  H: number;
  T: TreeKind;
  yaw: number;
  cr: number;
  cb: number;
  tr: number;
  sq: number;
  i: number;
}

/** 한 종류에 찍는 나무 수 */
const TREES_PER_KIND = 300;

/**
 * 가까운 것만 보기: 닿을 수 있는 거리(reach, m)가 저마다 다른 것들 가운데 지금 내 자리에서 닿을 수 있는 것의 번호.
 * 내가 margin(m) 넘게 움직였을 때만 다시 고른다 — 그 사이에는 고른 것이 늘 닿을 수 있는 것을 다 담는다(구면 삼각 부등식).
 * 넣은 차례로 돌려준다(전부 훑을 때와 같은 차례)
 */
export class NearSet {
  private readonly vs: THREE.Vector3[] = [];
  private readonly reach: number[] = [];
  private readonly ids: number[] = [];
  private readonly p0 = new THREE.Vector3();
  private dirty = true;
  private readonly moveCos: number;

  constructor(private readonly margin: number) {
    const moveAngle = margin / S.R;
    this.moveCos = Math.cos(moveAngle);
  }

  /** 하나 더한다(자리, 닿는 거리 m) */
  add(v: THREE.Vector3, reach: number) {
    this.vs.push(v);
    this.reach.push(reach);
    this.dirty = true;
  }

  /** 지금 자리 p 에서 닿을 수 있는 것의 번호 */
  around(p: THREE.Vector3): readonly number[] {
    if (this.dirty || p.dot(this.p0) < this.moveCos) this.rebuild(p);
    return this.ids;
  }

  private rebuild(p: THREE.Vector3) {
    this.p0.copy(p);
    this.dirty = false;
    const ids = this.ids;
    ids.length = 0;
    for (let i = 0; i < this.vs.length; i++) {
      // 반올림에 흔들리지 않게 1m 더 넉넉히
      const angle = (this.reach[i] + this.margin + 1) / S.R;
      const reachAngle = Math.min(Math.PI, angle);
      if (this.vs[i].dot(p) >= Math.cos(reachAngle)) ids.push(i);
    }
  }
}

/** 키 큰 솜사탕 나무 */
export class Trees implements Thing, HasHeights {
  readonly list: Tree[] = [];
  /** 종류(있는 것만, 갓 높이 표의 차례) */
  readonly kinds: TreeKind[] = [];
  private readonly byKey: Record<string, TreeKind | null> = {};
  private readonly near = new NearSet(30);
  /** 눌려서 꿀렁이는 중인 나무 */
  private readonly squashing = new Set<Tree>();

  constructor(
    private readonly s: Services,
    clouds: Clouds,
  ) {
    const { models, occ, terrain } = s;
    for (const [k, cb] of Object.entries(TREE_CROWN_BASE)) {
      const I = models.inst(k, TREES_PER_KIND);
      const kind = I ? { I, cb } : null;
      this.byKey[k] = kind;
      if (kind) this.kinds.push(kind);
    }
    (s.layout.tree || []).forEach((o, i) => {
      // 자리는 놀이와 함께 겹치지 않게 미리 정해 둔 것
      const T = this.byKey[o.t];
      if (!T || T.I.n >= TREES_PER_KIND) return;
      const I = T.I;
      const v = from(o.dist, o.bear),
        grownH = o.H * 1.5,
        crownPad = I.rw * o.H * 1.5,
        // 비행 통로 가까이의 낮은 나무는 88 로 키워 갓 밑으로 지나가게 한다
        H = grownH < 86 && occ.nearCorridor(v, crownPad) ? 88 : grownH,
        yaw = 6.28 * fr(i, 37);
      this.plant(v, H, T, yaw);
    });
    // 나무에 걸리는 뭉게구름은 나무 위로 올린다(조형물 숲의 나무는 보지 않는다 — 구름을 올린 뒤에 심는다)
    const cl = terrain.clouds;
    for (let i = 0; i < CLOUD_N; i++) {
      const t = this.list.find(
        (t) => t.v.angleTo(cl.v[i]) * S.R < t.cr + cl.s[i] * 4 && cl.h[i] < t.H + 6,
      );
      if (!t) continue;
      const lifted = t.H + 10 + 18 * fr(i, 71);
      clouds.raise(i, lifted);
    }
  }

  /** 나무 하나를 심는다: 땅에 세워 찍고, 줄기 둘레를 비운 자리로 맡는다 */
  plant(v: THREE.Vector3, H: number, T: TreeKind, yaw: number): Tree {
    const gr = this.s.terrain.groundAt(v),
      t: Tree = {
        v,
        g: gr,
        H,
        T,
        yaw,
        cr: T.I.rw * H,
        cb: T.cb * H,
        tr: 0.6 + H * 0.03,
        sq: 0,
        i: 0,
      };
    const base = gr - 0.4;
    t.i = T.I.stamp(v, base, H, yaw);
    this.list.push(t);
    const crownReach = t.cr * 0.85,
      trunkReach = t.tr + 0.7,
      reach = Math.max(crownReach, trunkReach);
    this.near.add(v, reach);
    const trunkPad = t.tr + 5,
      clearance = Math.max(7, trunkPad);
    this.s.occ.fill(v, clearance);
    return t;
  }

  /** 고래 길을 정할 때 보는 꼭대기 높이 */
  pushHeights(out: Height[]) {
    for (const t of this.list) out.push([t.v, t.H]);
  }

  /** 위에 내려앉으면 통 튀고, 갓·줄기에 막히고, 눌리면 꿀렁 */
  update(f: Frame) {
    const { player, fx, hud } = this.s,
      p = player.p,
      P = player.P,
      held = player.held,
      altA = P.length() - S.R;
    for (const i of this.near.around(p)) {
      const tr = this.list[i];
      const d = p.angleTo(tr.v) * S.R,
        a = altA - tr.g,
        crownReach = tr.cr * 0.85;
      if (!held && d < crownReach && a > tr.cb && a < tr.H + 2) {
        if (player.vy <= 0.5 && a > tr.H * 0.86) {
          player.bounce(10.5);
          this.squash(tr, 1);
          fx.burst(P, 8, 7);
          hud.sayOnce("tree", "솜사탕 나무 — 위에 내려앉으면 통 튑니다");
        } else if (a < tr.H * 0.86) {
          player.blockBody(tr.v, crownReach);
          const pressed = Math.max(tr.sq, 0.5);
          this.squash(tr, pressed);
        }
      } else if (!held && a < tr.cb) {
        const trunkReach = tr.tr + 0.7;
        player.block(tr.v, trunkReach, 1e9);
      }
    }
    for (const tr of this.squashing) {
      const settled = tr.sq - f.dt * 1.6;
      tr.sq = Math.max(0, settled);
      const base = tr.g - 0.4,
        squishPhase = tr.sq * Math.PI * 3,
        squish = 1 - 0.07 * Math.sin(squishPhase) * tr.sq;
      tr.T.I.restamp(tr.i, tr.v, base, tr.H, tr.yaw, squish);
      if (tr.sq <= 0) this.squashing.delete(tr);
    }
  }

  /** 찍어 둔 묶음은 모델 자리(ModelLibrary)가 치운다 */
  dispose() {}

  private squash(tr: Tree, k: number) {
    tr.sq = k;
    if (k > 0) this.squashing.add(tr);
  }
}
