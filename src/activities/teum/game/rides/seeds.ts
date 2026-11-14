import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { Ring } from "../core/pool";
import type { Random } from "../core/random";
import type { Tap, Tappable } from "../core/tap";
import type { Instancer } from "../models/instancer";
import type { Services } from "../services";
import { S } from "../settings";
import { from, offsetInto, UP } from "../world/sphere";

// 봉오리 밭(칙 씨앗밭) — 땅 위에 봉오리를 하나씩 놓는다. 위를 지나가면 봉오리가 퐁 터지며 구름 싹이 솟아 몸을 튕겨 올린다.
// 밭 안에 칙 하면 그 자리에도 구름 싹이 솟아 발판이 된다(직접 징검다리를 놓는다).
// 봉오리는 밭마다 마흔넷, 모두 900 개가 넘어서 한 번에 그리는 묶음으로 찍는다. 모델이 오면 꽃봉오리로 바꾸고,
// 터질 때 줄어들고 다시 맺힐 때 커지는 것은 그 봉오리 하나만 다시 찍는다

/** 봉오리 하나: 자리(밭 가운데에서 방향 a·거리 r), 땅 높이, 다시 맺힐 때까지, 찍은 번호·배율·돌림 */
export interface Bud {
  a: number;
  r: number;
  v: THREE.Vector3;
  g: number;
  cool: number;
  /** 도형 묶음의 칸 */
  slot: number;
  /** 모델 묶음의 칸과 지금 찍어 둔 배율 */
  i: number;
  k: number;
  yaw: number;
}

/** 봉오리 밭 하나 */
export interface SeedField {
  dist: number;
  bear: number;
  r: number;
  v: THREE.Vector3;
  dots: Bud[];
}

/** 구름 싹 하나(덩이 여덟을 뭉친 구름) */
export interface Sprout {
  m: THREE.Group;
  v: THREE.Vector3;
  on: boolean;
  t: number;
  g: number;
  cool: number;
  sq: number;
}

/** 밭마다 봉오리 수 */
const BUDS_PER_FIELD = 44;
/** 구름 싹을 돌려 쓰는 수 */
const SPROUT_N = 12;

/** 구름 싹 한 개를 이루는 덩이 여덟: [x, y, z, 반지름] */
const SPROUT_LUMPS: readonly (readonly [number, number, number, number])[] = [
  [0, 0.25, 0, 0.78],
  [0.62, 0, 0.1, 0.52],
  [-0.58, 0.02, 0.22, 0.5],
  [0.12, 0, 0.66, 0.5],
  [-0.2, 0, -0.64, 0.52],
  [0.5, 0.05, -0.48, 0.44],
  [-0.55, 0.05, -0.38, 0.42],
  [0.1, 0.62, 0.05, 0.46],
];

const ps = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  q0 = new THREE.Quaternion(),
  sc = new THREE.Vector3();

/** 봉오리 밭과 구름 싹 */
export class Seeds implements Thing, Tappable {
  readonly fields: SeedField[];
  /** 구름 싹(감독·칙·봉오리가 같이 쓴다) */
  readonly sprouts: Ring<Sprout>;
  /** 봉오리 도형(노란 공)을 한 번에 그리는 묶음 */
  private readonly prim: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  /** 꽃봉오리 모델 묶음(모델이 manifest 에 있을 때) */
  private budI: Instancer | null = null;
  private primDirty = false;
  private readonly rng: Random;
  private readonly sproutGeo = new THREE.SphereGeometry(1, 16, 12);
  private readonly sproutMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0,
    emissive: 0xffc9e0,
    emissiveIntensity: 0.38,
  });

  constructor(private readonly s: Services) {
    this.rng = s.rng.fork("seeds");
    let slot = 0;
    this.fields = s.layout.seed.map(({ dist, bear }) => {
      const dots: Bud[] = [];
      for (let k = 0; k < BUDS_PER_FIELD; k++) {
        // 해바라기 씨 배치: 황금각 2.399 라디안(offset 은 도를 받는다)씩 돌고, 반지름은 √ 로 벌려 넓이에 고르게
        const budAngle = k * 2.399 * 57.2958;
        const areaFrac = (k + 0.5) / BUDS_PER_FIELD;
        const budR = 23 * Math.sqrt(areaFrac);
        const bud: Bud = {
          a: budAngle,
          r: budR,
          v: new THREE.Vector3(),
          g: 0,
          cool: 0,
          slot: slot++,
          i: -1,
          k: 1,
          yaw: 0,
        };
        dots.push(bud);
      }
      return { dist, bear, r: 24, v: new THREE.Vector3(), dots };
    });
    const budGeo = new THREE.SphereGeometry(0.7, 12, 9);
    const seedHex = s.mats.toy.seed.getHex();
    const budMat = s.mats.grey(seedHex);
    this.prim = new THREE.InstancedMesh(budGeo, budMat, slot);
    this.prim.frustumCulled = false;
    s.scene.add(this.prim);
    // 구름 싹: 납작한 흰 공 하나였을 때는 위에서 보면 그냥 흰 원반이라 뭔지 알 수 없었다.
    // 몽글몽글한 덩이 여러 개를 뭉쳐 구름으로 보이게 하고, 빛을 받아 볼륨이 살게 한다
    const sprouts: Sprout[] = [];
    for (let i = 0; i < SPROUT_N; i++) {
      const m = new THREE.Group();
      for (const [x, y, z, r] of SPROUT_LUMPS) {
        const lump = new THREE.Mesh(this.sproutGeo, this.sproutMat);
        lump.position.set(x, y, z);
        lump.scale.setScalar(r);
        lump.frustumCulled = false;
        m.add(lump);
      }
      m.visible = false;
      s.scene.add(m);
      const sprout: Sprout = { m, v: new THREE.Vector3(), on: false, t: 0, g: 0, cool: 0, sq: 0 };
      sprouts.push(sprout);
    }
    this.sprouts = new Ring(sprouts);
  }

  /** 자리: 밭(언덕이 덮지 않게 넓은 자리로)과 해바라기 씨처럼 고른 봉오리. 싹은 모두 거둔다 */
  layout() {
    const { terrain, occ } = this.s;
    for (const f of this.fields) {
      const spot = from(f.dist, f.bear);
      f.v.copy(spot);
      occ.addZone(f.v, 25);
    }
    for (const f of this.fields)
      for (const d of f.dots) {
        offsetInto(d.v, f.v, d.r, d.a);
        d.g = terrain.groundAt(d.v);
        d.cool = 0;
        this.putPrim(d, 1);
      }
    this.prim.instanceMatrix.needsUpdate = true;
    for (const sp of this.sprouts.items) sp.on = false;
  }

  /** 자리 차지: 밭 전체 */
  claim() {
    for (const f of this.fields) this.s.occ.fill(f.v, 27);
  }

  /** 꽃봉오리 모델: 봉오리마다 한 번 찍고, 모델이 오면 노란 공을 숨긴다 */
  fitModels() {
    const models = this.s.models;
    const I = models.inst("r_bud", 1000);
    if (!I) return;
    this.budI = I;
    for (const f of this.fields)
      for (const d of f.dots) {
        d.yaw = 6.28 * this.rng.next();
        d.k = 1;
        const base = d.g - 0.05;
        d.i = I.stamp(d.v, base, 2, d.yaw, 0);
      }
    models.swapWhenReady("r_bud", [this.prim]);
  }

  /** 다음 구름 싹을 그 자리(v, 땅 높이 g)에 솟게 한다 */
  sprout(v: THREE.Vector3, g: number, cool: number, sq: number) {
    const sp = this.sprouts.next();
    sp.on = true;
    sp.v.copy(v);
    sp.t = 0;
    sp.g = g;
    sp.cool = cool;
    sp.sq = sq;
  }

  /** 씨앗밭 안에 칙 하면 그 자리에 구름 싹이 솟는다 */
  onTap(tap: Tap) {
    const n = tap.ground;
    if (!n) return;
    for (const f of this.fields)
      if (n.angleTo(f.v) * S.R < f.r) {
        const ground = this.s.terrain.groundAt(n);
        this.sprout(n, ground, 0, 0);
        this.s.hud.sayOnce("seed", "칙 씨앗밭 — 칙 한 자리에 구름 싹이 솟습니다");
        break;
      }
  }

  /** 봉오리: 가까이 지나가면 터지고 잠시 뒤 다시 맺힌다. 구름 싹: 솟았다가 밟으면 튕기고 시간이 지나면 진다 */
  update(f: Frame) {
    const { player, fx, hud } = this.s,
      dt = f.dt,
      p = player.p;
    for (const fl of this.fields) {
      if (p.angleTo(fl.v) * S.R > fl.r + 30) continue;
      for (const d of fl.dots) {
        if (d.cool > 0) {
          d.cool -= dt;
          const k = d.cool > 5 ? 0.001 : 1 - d.cool / 5;
          this.scaleBud(d, k);
          continue;
        }
        const pulsePhase = f.time * 3 + d.a;
        const pulse = 1 + 0.12 * Math.sin(pulsePhase);
        this.scaleBud(d, pulse);
        if (!player.held && player.air < 3.5 && p.angleTo(d.v) * S.R < 2.6) {
          d.cool = 9;
          this.sprout(d.v, d.g, 0.5, 1);
          player.lift(5.5);
          const budR = S.R + d.g + 0.55;
          ps.copy(d.v).multiplyScalar(budR);
          fx.burst(ps, 5, 7);
          hud.sayOnce("seed", "봉오리 밭 — 스치면 퐁 터지며 구름 싹이 솟습니다");
        }
      }
    }
    if (this.primDirty) {
      this.prim.instanceMatrix.needsUpdate = true;
      this.primDirty = false;
    }
    for (const sp of this.sprouts.items) {
      if (!sp.on) {
        sp.m.visible = false;
        continue;
      }
      sp.t += dt;
      if (sp.t > 16) {
        sp.on = false;
        continue;
      }
      if (sp.cool > 0) sp.cool -= dt;
      else if (!player.held && player.air < 1.4 && sp.t > 0.3 && p.angleTo(sp.v) * S.R < 2.9) {
        player.hop(8.2);
        sp.cool = 0.8;
        sp.sq = 1;
      }
      const easedSq = sp.sq - dt * 2.4;
      sp.sq = Math.max(0, easedSq);
      // 솟을 때 부풀고(gk), 지기 1초 전부터 줄고, 밟히면 잠깐 눌린다(sq)
      const growTime = sp.t / 0.35;
      const gk = Math.min(1, growTime);
      const lifeLeft = 16 - sp.t;
      const fade = Math.min(1, lifeLeft);
      const squashAngle = sp.sq * Math.PI;
      const k = gk * (2 - gk) * fade * (1 - Math.sin(squashAngle) * 0.5);
      sp.m.visible = true;
      const width = 2.5 * gk;
      const height = 1.4 * k;
      sp.m.scale.set(width, height, width);
      const sproutR = S.R + sp.g + 0.9 * k;
      sp.m.position.copy(sp.v).multiplyScalar(sproutR);
      sp.m.quaternion.setFromUnitVectors(UP, sp.v);
    }
    for (const sp of this.sprouts.items)
      if (sp.on) {
        const alpha = 0.45 + sp.sq;
        fx.glow(sp.m.position, 5.5, alpha);
      }
  }

  /** 치운다 */
  dispose() {
    this.prim.removeFromParent();
    this.prim.geometry.dispose();
    this.prim.material.dispose();
    this.prim.dispose();
    for (const sp of this.sprouts.items) sp.m.removeFromParent();
    this.sproutGeo.dispose();
    this.sproutMat.dispose();
  }

  // 봉오리 크기: 모델이 있으면 크기가 눈에 띄게 바뀐 봉오리만 다시 찍고, 노란 공은 보이는 동안만 고친다
  private scaleBud(d: Bud, k: number) {
    const I = this.budI;
    const change = k - d.k;
    if (I && Math.abs(change) > 0.015) {
      d.k = k;
      const base = d.g - 0.05,
        size = 2 * Math.max(k, 0.001);
      I.restamp(d.i, d.v, base, size, d.yaw, 1);
    }
    if (this.prim.visible) {
      this.putPrim(d, k);
      this.primDirty = true;
    }
  }

  // 노란 공 하나를 그 자리·크기로
  private putPrim(d: Bud, k: number) {
    const budR = S.R + d.g + 0.55;
    ps.copy(d.v).multiplyScalar(budR);
    sc.setScalar(k);
    m4.compose(ps, q0, sc);
    this.prim.setMatrixAt(d.slot, m4);
  }
}
