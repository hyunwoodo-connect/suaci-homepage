import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Echoing, Tap, Tappable } from "../core/tap";
import { ECHO_REACH, echoTime } from "../core/tap";
import { keyify } from "../keyColor";
import { LOOK } from "../look";
import type { LayoutHop } from "../maps/layout";
import { uploadFirst } from "../models/upload";
import type { Services } from "../services";
import { S } from "../settings";
import type { Dip } from "../world/culler";
import { dipOf, horizonCos } from "../world/culler";
import { hopPath } from "../world/paths";
import type { Sight } from "../world/sight";
import { from, UP } from "../world/sphere";
import { claimSpots, cloudPadGeometry } from "./shared";

// 통통 구름 — 위에 오면 높이 튀어 오른다. 징검 구름 — 작은 구름을 통통 밟으며 건너간다.
// 구름 방석은 모두 같은 모양·같은 색이라 한 번에 그린다: 가까운 것 가운데 화면에 걸치는 것(sight.ts)만 그리기 직전에 칸에 채운다

/** 구름 방석 하나(통통 구름 또는 징검 구름의 한 칸) */
interface Pad {
  dist?: number;
  bear?: number;
  /** 징검 구름이면 그 줄과 몇 번째 */
  hop?: LayoutHop;
  i?: number;
  v: THREE.Vector3;
  dir?: THREE.Vector3;
  cool: number;
  sq: number;
  size?: number;
  g: number;
  /** 방석 꼭대기가 지평선에 걸리는 각(지평선 너머면 그리지 않는다) */
  dip: Dip;
  /** 칙 했을 때 울릴 시각(-1 이면 없음) */
  ringAt: number;
  /** 이번 프레임 방석 가운데(빛을 둔다)와 너비·높이 */
  pos: THREE.Vector3;
  w: number;
  h: number;
  /** 땅에 세운 돌림(자리를 정할 때 한 번) */
  q: THREE.Quaternion;
}

const tmp = new THREE.Vector3(),
  sc = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  ball = new THREE.Sphere();
/** 밟히는 거리(통통 구름 4.4m, 징검 구름 3.6m)보다 확실히 먼 것은 거리 셈(acos)을 건너뛴다 — 경계는 아래 셈이 정한다 */
const PAD_ARC = 4.4 / S.R,
  HOP_ARC = 3.6 / S.R;
const COS_PAD = Math.cos(PAD_ARC) - 1e-9,
  COS_HOP = Math.cos(HOP_ARC) - 1e-9;
/** 방석 꼭대기의 땅 위 높이(m, 가장 부푼 것보다 넉넉히) — 지평선 너머인지 볼 때 쓴다 */
const PAD_TOP = 5;

/** 통통 구름·징검 구름 전체 */
export class Pads implements Thing, Tappable, Echoing {
  readonly list: Pad[] = [];
  private readonly geo: THREE.BufferGeometry;
  private readonly mat: THREE.MeshStandardMaterial;
  private readonly mesh: THREE.InstancedMesh;
  /** 이번 프레임에 가까운 방석(그리기 직전에 이 가운데 화면에 걸치는 것만 칸에 채운다) */
  private readonly near: Pad[] = [];
  /** 방석 가운데에서 본 둘레(너비 1 일 때) */
  private readonly reach: number;

  constructor(private readonly s: Services) {
    this.geo = cloudPadGeometry();
    this.geo.computeBoundingSphere();
    const bound = this.geo.boundingSphere!;
    this.reach = bound.center.length() + bound.radius;
    // 통통 구름과 징검 구름은 톤에서 같은 귤색이다(LOOK.pad)
    this.mat = new THREE.MeshStandardMaterial({
      color: LOOK.pad,
      roughness: 0.32,
      metalness: 0,
      emissive: 0xffffff,
      emissiveIntensity: 0.12,
    });
    keyify(this.mat, s.mats.lookU.flood);
    for (const { dist, bear } of s.layout.pad) {
      const pad = newPad({ dist, bear });
      this.list.push(pad);
    }
    for (const hp of s.layout.hop)
      for (let i = 0; i < hp.n; i++) {
        const dir = new THREE.Vector3();
        const pad = newPad({ hop: hp, i, dir, size: 3.2 });
        this.list.push(pad);
      }
    const count = this.list.length;
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    s.scene.add(this.mesh);
  }

  /** 징검 구름 자리: 줄을 따라 조금씩 휘며 */
  layoutHops() {
    for (const hp of this.s.layout.hop) {
      const { points } = hopPath(hp);
      for (const pd of this.list)
        if (pd.hop === hp) {
          const { v, d } = points[pd.i!];
          pd.v.copy(v);
          pd.dir!.copy(d);
        }
    }
  }

  /** 구름 방석 자리와 땅 높이 */
  layout(keep: THREE.Vector3[]) {
    for (const pd of this.list) {
      if (!pd.hop) {
        const spot = from(pd.dist!, pd.bear!);
        pd.v.copy(spot);
      }
      keep.push(pd.v);
      pd.g = this.s.terrain.featGround(pd.v);
      const top = pd.g + PAD_TOP;
      pd.dip = dipOf(top);
      pd.q.setFromUnitVectors(UP, pd.v);
    }
  }

  /** 자리 차지: 방석 둘레, 그리고 튕겨 보내는 길(비행 통로) */
  claim() {
    claimSpots(this.s.occ, this.list, 5, 8);
  }

  /** 칙 둘레의 방석은 가까운 것부터 차례로 울린다 */
  onTap(tap: Tap) {
    const n = tap.ground;
    if (!n) return;
    for (const pd of this.list) {
      const dist = n.angleTo(pd.v) * S.R;
      if (dist < ECHO_REACH) pd.ringAt = echoTime(tap, dist);
    }
  }

  /** 울릴 시각이 된 방석이 꿀렁인다(종이 울리는 차례에 같이) */
  echo(time: number) {
    for (const pd of this.list)
      if (pd.ringAt > 0 && time >= pd.ringAt) {
        pd.ringAt = -1;
        pd.sq = 1;
      }
  }

  /** 밟으면 튀고, 가만히 있을 때도 숨 쉬듯 부푼다 */
  update(f: Frame) {
    const { player, fx, culler } = this.s,
      dt = f.dt,
      p = player.p,
      cut = culler.cut,
      eye = culler.eye,
      near = this.near;
    near.length = 0;
    for (const pd of this.list) {
      const reachCos = pd.hop ? COS_HOP : COS_PAD;
      if (pd.cool > 0) pd.cool -= dt;
      else if (!player.held && player.air < 0.9 && p.dot(pd.v) > reachCos) {
        const reach = pd.hop ? 3.6 : 4.4;
        if (p.angleTo(pd.v) * S.R < reach) this.bounce(pd);
      }
      const squashLeft = pd.sq - dt * 2.2;
      pd.sq = Math.max(0, squashLeft);
      const squashPhase = pd.sq * Math.PI;
      const breathPhase = f.time * 2.6 + pd.v.x * 40;
      const k = (1 - Math.sin(squashPhase) * 0.55) * (1 + 0.05 * Math.sin(breathPhase)),
        w = (pd.size || 4.6) * (1 + (1 - k) * 0.5); // 가만히 있을 때도 숨 쉬듯 부푼다
      pd.w = w;
      pd.h = 2.3 * k;
      const radius = S.R + pd.g + 0.9 * k;
      pd.pos.copy(pd.v).multiplyScalar(radius);
      const along = pd.v.dot(p),
        seen = horizonCos(eye, pd.dip);
      if (along > cut && along > seen) near.push(pd);
      if (pd.sq > 0) {
        const size = pd.hop ? 7 : 11;
        const alpha = Math.sin(squashPhase);
        fx.glow(pd.pos, size, alpha);
      }
    }
  }

  /** 그리기 직전: 가까운 방석 가운데 화면에 걸치는 것만 칸에 채워 올린다 */
  flush(sight: Sight) {
    let n = 0;
    for (const pd of this.near) {
      ball.center.copy(pd.pos);
      ball.radius = pd.w * this.reach;
      if (!sight.sees(ball)) continue;
      sc.set(pd.w, pd.h, pd.w);
      m4.compose(pd.pos, pd.q, sc);
      this.mesh.setMatrixAt(n++, m4);
    }
    this.mesh.count = n;
    uploadFirst(this.mesh.instanceMatrix, n);
  }

  /** 치운다 */
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.geo.dispose();
    this.mat.dispose();
  }

  // 밟았다: 통통 구름은 높이, 징검 구름은 낮게 다음 칸 쪽으로
  private bounce(pd: Pad) {
    const { player, hud } = this.s;
    pd.cool = 1.2;
    pd.sq = 1;
    if (pd.hop) {
      player.hop(3.5);
      const sg = player.vel.dot(pd.dir!) >= 0 ? 1 : -1;
      tmp.copy(pd.dir!).multiplyScalar(sg);
      player.turnTo(tmp, 0.7);
      player.boostAtLeast(0.7);
      const lastI = pd.hop.n - 1;
      if (pd.i === 0 || pd.i === lastI) hud.say("징검 구름 — 통통 밟으며 건너갑니다");
    } else {
      player.hop(11.5);
      hud.say("통통 구름 — 높이 튀어 올라 멀리 봅니다");
    }
  }
}

/* ─── 내부 ─────────────────────────── */

// 방석 하나의 처음 값
function newPad(o: Partial<Pad>): Pad {
  return {
    ...o,
    v: new THREE.Vector3(),
    cool: 0,
    sq: 0,
    g: 0,
    dip: dipOf(PAD_TOP),
    ringAt: -1,
    pos: new THREE.Vector3(),
    w: 0,
    h: 0,
    q: new THREE.Quaternion(),
  };
}
