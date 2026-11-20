import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { scatterHubs, within } from "../maps/map";
import { bubbleBody } from "../maps/placed";
import type { Services } from "../services";
import { S } from "../settings";
import type { BodyField } from "../world/bodyField";
import { fr } from "../world/hash";
import { offset } from "../world/sphere";

// 비눗방울: 닿으면 뽁 터지며 살짝 튀어 오른다. 잇달아 터뜨릴수록 더 높이 튄다. 마을마다 방울 무리 몇(지도 bubbles — v78 은 열, 최대 420 개)

/** 비눗방울 하나: 땅 높이(g)·떠 있는 높이(h)·반지름(r)·다시 생길 때까지(t)·크기(s) */
export interface Bubble {
  v: THREE.Vector3;
  g: number;
  h: number;
  r: number;
  ph: number;
  t: number;
  s: number;
  far?: boolean;
  /** 무리 번호(한 무리의 방울끼리는 겹쳐도 된다) */
  c: number;
}

/** 방울 밑이 이보다 낮으면(m) 땅 위의 것과 닿는다 — 그 방울만 자리를 맡는다 */
const LOW_BUBBLE = 3;
/** 방울 색: 흰색·분홍·하늘·노랑을 돌려 가며 */
const BUBBLE_TINTS = [0xffffff, 0xffc4e0, 0xcfe0ff, 0xfff3b0];

/** 마을마다 무리 자리를 찾는 고정 난수 번호의 간격(지도의 tries 는 이보다 작다) · 무리 안 방울 번호의 간격(perCluster 는 이보다 작다) */
const HUB_STRIDE = 40,
  CLUSTER_STRIDE = 9;
const qI = new THREE.Quaternion(),
  pI = new THREE.Vector3(),
  sI = new THREE.Vector3(),
  mI = new THREE.Matrix4(),
  tc = new THREE.Color();

/** 비눗방울 */
export class Bubbles implements Thing {
  readonly list: Bubble[] = [];
  private readonly m: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private combo = 0;
  private comboT = 0;

  constructor(private readonly s: Services) {
    const { occ, terrain, scene } = s;
    const bubbleGeometry = new THREE.SphereGeometry(1, 16, 12),
      bubbleMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
        roughness: 0,
        metalness: 0,
        envMapIntensity: 2.4,
        depthWrite: false,
      });
    const plan = s.map.bubbles,
      BUB_N = plan.max;
    this.m = new THREE.InstancedMesh(bubbleGeometry, bubbleMaterial, BUB_N);
    this.m.frustumCulled = false;
    this.m.count = 0;
    scene.add(this.m);
    const BUBS = this.list,
      HV = occ.hubs;
    const hubs = scatterHubs(plan, HV.length);
    for (const hk of hubs)
      for (let c0 = 0, got = 0; c0 < plan.tries && got < plan.perHub && BUBS.length < BUB_N; c0++) {
        const c = hk * HUB_STRIDE + c0,
          distRoll = fr(c, 91),
          far = Math.sqrt(distRoll),
          dist = within(plan.dist, far),
          bearing = 360 * fr(c, 92),
          cv = occ.hubAt(hk, dist, bearing);
        if (!occ.isFree(cv, plan.clear)) continue;
        got++;
        for (let j = 0; j < plan.perCluster && BUBS.length < BUB_N; j++) {
          const seed = c * CLUSTER_STRIDE + j,
            spreadRoll = fr(seed, 93),
            spread = within(plan.spread, spreadRoll),
            spreadBearing = 360 * fr(seed, 94),
            v = offset(cv, spread, spreadBearing);
          const bubble: Bubble = {
            v,
            g: terrain.groundAt(v),
            h: 2.2 + 13 * fr(seed, 95) * fr(seed, 96),
            r: 0.9 + 1.7 * fr(seed, 97),
            ph: 6.28 * fr(seed, 98),
            t: 0,
            s: 1,
            c,
          };
          BUBS.push(bubble);
        }
      }
  }

  /**
   * 고른 방울을 띄운다(조형물까지 다 놓인 뒤). field 를 주면 다른 것과 엉키는 방울은 띄우지 않고,
   * 낮게 뜬 방울의 자리를 맡아 둔다(꽃 길이 방울 무리를 피한다) — 무리 가운데만 빈자리를 봐서, 퍼진 방울이 놀이기구·조형물에 걸리곤 했다
   */
  build(field: BodyField | null) {
    const BUBS = this.list;
    if (field) {
      const kept = BUBS.filter((b, i) => {
        const body = bubbleBody(i, b.c, b.v, b.r, b.h);
        if (field.tangles(body)) return false;
        field.add(body);
        return true;
      });
      BUBS.length = 0;
      BUBS.push(...kept);
      // 낮게 뜬 방울만 땅 자리를 맡는다 — 높이 뜬 방울 밑은 비어 있다
      for (const b of BUBS) if (b.h - b.r < LOW_BUBBLE) this.s.occ.fill(b.v, b.r);
    }
    this.m.count = BUBS.length;
    for (let i = 0; i < BUBS.length; i++) {
      const tint = BUBBLE_TINTS[i % 4];
      tc.set(tint);
      this.m.setColorAt(i, tc);
    }
    if (this.m.instanceColor) this.m.instanceColor.needsUpdate = true;
  }

  /** 닿으면 뽁 터지며 튀어 오르고, 터진 방울은 한참 뒤 다시 생긴다 */
  update(f: Frame) {
    const { player, fx, hud } = this.s,
      p = player.p,
      P = player.P,
      dt = f.dt,
      held = player.held,
      time = f.time,
      bubM = this.m;
    const altA = P.length() - S.R;
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }
    // 가까이 있고 터지지 않은 방울만 앞 칸부터 채워 그린다(시제품은 먼 것·터진 것을 0 크기로 다 그렸다).
    // 색은 방울마다 정해져 있어 칸을 옮길 때 같이 옮긴다
    let n = 0;
    this.list.forEach((b, i) => {
      if (b.v.dot(p) < 0.8) {
        b.far = true;
        return;
      }
      b.far = false;
      if (b.t > 0) {
        b.t -= dt;
        if (b.t <= 0) b.s = 0.01;
      } else if (b.s < 1) {
        const regrown = b.s + dt * 0.8;
        b.s = Math.min(1, regrown);
      }
      const floatPhase = time * 0.8 + b.ph,
        hh = b.g + b.h + Math.sin(floatPhase) * 0.7,
        radius = S.R + hh,
        heightGap = altA - hh;
      if (
        b.t <= 0 &&
        b.s > 0.6 &&
        p.angleTo(b.v) * S.R < b.r + 0.9 &&
        Math.abs(heightGap) < b.r + 1.1
      ) {
        // 뽁
        b.t = 9;
        const combo = this.combo + 1;
        this.combo = Math.min(8, combo);
        this.comboT = 2.2;
        this.s.events.emit("bubblePopped", { combo });
        if (!held) {
          const popLift = 2.6 + this.combo * 0.9;
          player.lift(popLift);
        }
        pI.copy(b.v).multiplyScalar(radius);
        fx.burst(pI, 5, 5);
        hud.sayOnce("bubble", "비눗방울 — 잇달아 터뜨릴수록 높이 튑니다");
      }
      // 터진 방울은 다시 생길 때까지 거의 0 크기로 숨기고, 있는 방울은 살짝 일렁인다
      const wobblePhase = time * 2.3 + b.ph,
        wobble = 1 + 0.05 * Math.sin(wobblePhase),
        k = b.t > 0 ? 0.0001 : b.s * wobble,
        size = b.r * k;
      if (b.t > 0) return;
      qI.identity();
      pI.copy(b.v).multiplyScalar(radius);
      sI.setScalar(size);
      mI.compose(pI, qI, sI);
      bubM.setMatrixAt(n, mI);
      const tint = BUBBLE_TINTS[i % 4];
      tc.set(tint);
      bubM.setColorAt(n, tc);
      n++;
    });
    bubM.count = n;
    bubM.instanceMatrix.needsUpdate = true;
    if (bubM.instanceColor) bubM.instanceColor.needsUpdate = true;
  }

  /** 치운다 */
  dispose() {
    this.m.removeFromParent();
    this.m.geometry.dispose();
    this.m.material.dispose();
    this.m.dispose();
  }
}
