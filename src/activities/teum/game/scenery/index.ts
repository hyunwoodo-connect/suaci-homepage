import * as THREE from "three";

import { BIG_FLOWERS, TREE_CROWN_BASE } from "../../assets/settings";
import { blockAt } from "../collide";
import { limeBallsFrame } from "../rides/balls";
import { bumperModelsFrame } from "../rides/bumpers";
import { burst } from "../fx/sparks";
import { say } from "../hud";
import type { Hold, Instancer } from "../models";
import { fit, hasModel, inst, swapWhenReady, topDir, whenModel } from "../models";
import type { Game } from "../state";
import { S } from "../state";
import { flCull, fr } from "../world/flowers";
import { from, offset } from "../world/sphere";
import { groundAt, setCloud, CLOUD_N } from "../world/terrain";
import type { Zone } from "./spots";
import { along, corAdd, corNear, freeAt, hubAt, occAdd, putI, restamp, stamp } from "./spots";

// 풍경: 장소·랜드마크에 모델을 끼우고, 키 큰 솜사탕 나무·큰 풍선 꽃·라임 공·비눗방울·꼬마 라임을 놓는다.
// 자리는 모델을 받기 전에 원본 상자로 모두 정한다(받는 순서가 배치를 흔들지 않게)

/** 키 큰 솜사탕 나무 하나: 갓 반지름(cr)·갓 높이(cb)·줄기 반지름(tr) */
export interface Tree {
  v: THREE.Vector3;
  g: number;
  H: number;
  T: { I: Instancer; cb: number };
  yaw: number;
  cr: number;
  cb: number;
  tr: number;
  sq: number;
  i: number;
}

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

/** 비눗방울 하나 */
interface Bubble {
  v: THREE.Vector3;
  g: number;
  h: number;
  r: number;
  ph: number;
  t: number;
  s: number;
  far?: boolean;
}

/** 꼬마 라임 하나: 숨어 있다가 닿으면 졸졸 따라온다 */
interface Baby {
  v: THREE.Vector3;
  g: number;
  ph: number;
  join: boolean;
  order: number;
  pos: THREE.Vector3;
  a: number;
  i: number;
}

/** 지나온 자리 하나(움직인 만큼만 남긴다): 자리와 높이 */
export interface Footstep {
  p: THREE.Vector3;
  a: number;
}

/** 풍경 전체와 놓을 때 쓰는 자리 */
export interface Scenery {
  occ: Zone[];
  COR: Zone[];
  HV: THREE.Vector3[];
  TREES: Tree[];
  TK: Record<string, { I: Instancer | null; cb: number }>;
  BIGF: BigFlower[];
  BUBS: Bubble[];
  /** 비눗방울(풍경을 놓을 때 생긴다) */
  bubM: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshStandardMaterial> | null;
  bubCombo: number;
  bubT: number;
  BABY: Baby[];
  BL: Instancer | null;
  babyN: number;
  hist: Footstep[];
  /** 가까운 것만 그릴 것들 */
  CULL: { o: THREE.Object3D; v: THREE.Vector3 }[];
  cullT: number;
  catModel: Hold | null;
}

const qI = new THREE.Quaternion(),
  pI = new THREE.Vector3(),
  sI = new THREE.Vector3(),
  mI = new THREE.Matrix4(),
  tc = new THREE.Color();

/** 장소·랜드마크·놀이기구에 모델 틀을 끼운다(고양이부터 시제품 순서대로) */
export function fitModels(g: Game) {
  const { places } = g,
    items = places.items;
  g.scenery = {
    occ: [],
    COR: [],
    HV: [],
    TREES: [],
    TK: {},
    BIGF: [],
    BUBS: [],
    bubM: null,
    bubCombo: 0,
    bubT: 0,
    BABY: [],
    BL: null,
    babyN: 0,
    hist: [],
    CULL: [],
    cullT: 0,
    catModel: null,
  };
  // 나와 고양이(뼈대 있는 몸은 avatar/rig 가 따로 받는다)
  if (hasModel(g, "cat_lime")) {
    const C = fit(g, "cat_lime", 0.48, "h");
    C.rotation.y = -Math.PI / 2;
    g.me.me.add(C);
    swapWhenReady(g, "cat_lime", [g.me.cat]);
    C.userData.uLime.value = 0.55; // 고양이는 어느 색에서도 라임
    g.scenery.catModel = C;
  }
  // 장소
  const placeModel = (i: number, k: string, size: number, by: string) => {
    if (!hasModel(g, k)) return;
    const gr = items[i].obj,
      m = fit(g, k, size, by);
    m.position.y = m.userData.hh;
    const prim = gr.children.filter(
      (c) => c instanceof THREE.Mesh && c !== places.lamp && c !== places.beam,
    );
    gr.add(m);
    swapWhenReady(g, k, prim);
    items[i].model = m;
  };
  placeModel(0, "wishtree", 6.4, "h");
  placeModel(1, "fountain", 3.4, "w");
  placeModel(2, "gacha", 2.7, "h");
  placeModel(3, "lighthouse", 46, "h");
  // 랜드마크와 쉬는 곳
  for (const st of g.sites) {
    if (!hasModel(g, st.k)) continue;
    const isFerris =
      st.k === "ferris" && hasModel(g, "ferris_wheel") && hasModel(g, "ferris_stand");
    const m = isFerris ? buildFerris(g) : fit(g, st.k, st.size, st.by);
    m.position.y = m.userData.hh;
    st.g.add(m);
    st.model = m;
    st.top = m.userData.top || m.userData.hh * 2;
    const coreShare = st.k === "ferris" ? 0.6 : 0.8,
      coreRadius = m.userData.rw * coreShare;
    st.core = Math.max(2, coreRadius);
    if (st.kind === "rest") st.r = st.core + 5.5;
    st.tag.position.y = st.top + (st.kind === "land" ? 5 : 6.6);
    if (isFerris) whenModel(g, "ferris_stand", () => swapWhenReady(g, "ferris_wheel", [st.prim]));
    else swapWhenReady(g, st.k, [st.prim]);
  }
  // 미끄럼틀: 내려가는 방향 = 탑의 반대쪽(탑이 어느 쪽인지는 모델의 꼭짓점으로 안다)
  const sl = g.sites.find((x) => x.k === "slide");
  if (sl && sl.model) {
    const slModel = sl.model;
    whenModel(g, "slide", () => {
      // 시제품은 그린 뒤(세계 행렬이 찬 뒤)에 쟀다. 그리기 전에 와도 같게 자리의 세계 행렬을 먼저 채운다
      sl.g.updateWorldMatrix(true, false);
      const t = topDir(slModel),
        l = Math.max(1e-6, t.len);
      sl.fx = -t.x / l;
      sl.fz = -t.z / l;
      sl.sl = t.ext;
    });
  }
  // 큰 종
  if (hasModel(g, "bell"))
    for (const c of g.chimes) {
      const prim = c.w.children.slice(),
        m = fit(g, "bell", 13.5, "h");
      m.position.y = m.userData.hh;
      c.w.add(m);
      c.model = m;
      swapWhenReady(g, "bell", prim);
    }
  // 대포: 주둥이가 쏘는 방향(+z)을 보게 돌려 놓는다
  if (hasModel(g, "cannon"))
    for (const c of g.cannons) {
      const prim = c.g.children.slice();
      const m: Hold = fit(g, "cannon", 10.5, "h", () => {
        // 대포에 끼우기 전(제 좌표)에서 잰다
        const frame = new THREE.Matrix4().copy(c.g.matrixWorld).invert(),
          t = topDir(m, frame);
        m.rotation.y = -Math.atan2(t.x, t.z);
      });
      m.position.y = m.userData.hh;
      c.g.add(m);
      c.model = m;
      swapWhenReady(g, "cannon", prim);
    }
  // 범퍼: 버섯
  if (hasModel(g, "bumper"))
    for (const b of g.bumpers) {
      const m = fit(g, "bumper", 6.2, "h");
      g.scene.add(m);
      b.model = m;
      swapWhenReady(g, "bumper", [b.m]);
    }
}

/** 키 큰 나무·큰 풍선 꽃·라임 공·비눗방울·꼬마 라임을 놓는다. 자리는 이미 찬 곳과 비행 통로를 피한다 */
export function placeScenery(g: Game) {
  const sc = g.scenery;
  for (const it of g.places.items) occAdd(g, it.v, 6);
  for (const st of g.sites) {
    const clearance = st.core + 9;
    occAdd(g, st.v, clearance);
  }
  for (const f of g.terrain.features) occAdd(g, f.v, 8);
  const pointLists: { v: THREE.Vector3 }[][] = [
    g.rings,
    g.pads.list,
    g.pillars.list,
    g.whirls,
    g.chimes,
    g.cannons,
    g.bumpers,
    g.balloons,
    g.balls.list,
    g.stars.list,
    g.slings,
    g.swings,
    g.rockets,
    g.thermals.list,
    g.wings.items,
    g.holes,
  ];
  for (const a of pointLists) for (const o of a) occAdd(g, o.v, 5);
  const pathLists: { nodes: { v: THREE.Vector3 }[] }[][] = [
    g.streams.list,
    g.arches.list,
    g.rails.list,
  ];
  for (const a of pathLists) for (const o of a) for (const nd of o.nodes) occAdd(g, nd.v, 5);
  for (const l of g.lakes.list) {
    const shore = l.r + 3;
    occAdd(g, l.v, shore);
  }
  for (const o of g.pipes.list) occAdd(g, o.v, 40);
  for (const o of g.funnels) occAdd(g, o.v, 26);
  for (const o of g.seeds.fields) occAdd(g, o.v, 27);
  // 비행 통로: 놀이기구가 나를 실어 보내는 길. 키 작은 것은 여기 두지 않고, 키 큰 나무는 갓 밑으로 지나가게 한다
  for (const c of g.cannons)
    for (let k = 0; k <= 7; k++) {
      const ahead = k * 8,
        point = along(c.v, c.d, ahead);
      corAdd(g, point, 12);
    }
  for (const s of g.slings)
    for (let k = 0; k <= 5; k++) {
      const behind = -k * 7,
        point = along(s.v, s.d, behind);
      corAdd(g, point, 10);
    }
  for (const a of pathLists) for (const o of a) for (const nd of o.nodes) corAdd(g, nd.v, 10);
  for (const nd of g.jets.jnodes) corAdd(g, nd.v, 13);
  const corLists: { v: THREE.Vector3 }[][] = [
    g.rings,
    g.pads.list,
    g.thermals.list,
    g.whirls,
    g.rockets,
    g.balloons,
    g.swings,
  ];
  for (const a of corLists) for (const o of a) corAdd(g, o.v, 8);
  const TREES = sc.TREES,
    BIGF = sc.BIGF;
  for (const [k, cb] of Object.entries(TREE_CROWN_BASE)) sc.TK[k] = { I: inst(g, k, 300), cb };
  const TK = sc.TK;
  (g.L.tree || []).forEach((o, i) => {
    // 키 큰 솜사탕 나무: 자리는 놀이와 함께 겹치지 않게 미리 정해 둔 것
    const T = TK[o.t];
    if (!T || !T.I || T.I.n >= 300) return;
    const I = T.I;
    const v = from(o.dist, o.bear),
      grownH = o.H * 1.5,
      crownPad = I.rw * o.H * 1.5,
      // 비행 통로 가까이의 낮은 나무는 88 로 키워 갓 밑으로 지나가게 한다
      H = grownH < 86 && corNear(g, v, crownPad) ? 88 : grownH,
      gr = groundAt(g, v),
      yaw = 6.28 * fr(i, 37),
      t: Tree = {
        v,
        g: gr,
        H,
        T: { I, cb: T.cb },
        yaw,
        cr: I.rw * H,
        cb: T.cb * H,
        tr: 0.6 + H * 0.03,
        sq: 0,
        i: 0,
      };
    const base = gr - 0.4;
    t.i = stamp(I, v, base, H, yaw);
    TREES.push(t);
    const trunkPad = t.tr + 5,
      clearance = Math.max(7, trunkPad);
    occAdd(g, v, clearance);
  });
  const clouds = g.terrain.clouds;
  for (let i = 0; i < CLOUD_N; i++) {
    // 나무에 걸리는 뭉게구름은 나무 위로 올린다
    const t = TREES.find(
      (t) => t.v.angleTo(clouds.v[i]) * S.R < t.cr + clouds.s[i] * 4 && clouds.h[i] < t.H + 6,
    );
    if (!t) continue;
    clouds.h[i] = t.H + 10 + 18 * fr(i, 71);
    const cloudRadius = S.R + clouds.h[i] + clouds.s[i] * 0.6;
    clouds.c[i].copy(clouds.v[i]).multiplyScalar(cloudRadius);
    setCloud(g, i, 0);
  }
  const FK = BIG_FLOWERS.map((k) => inst(g, k, 220)).filter((I): I is Instancer => Boolean(I));
  sc.HV = g.L.hub.map((h) => from(h.dist, h.bear));
  const HV = sc.HV;
  if (FK.length)
    for (let hk = 0; hk < HV.length; hk++)
      for (let i0 = 0, got = 0; i0 < 150 && got < 60; i0++) {
        // 큰 풍선 꽃: 마을마다 예순 송이
        const i = hk * 200 + i0,
          distRoll = fr(i, 41),
          dist = 22 + 200 * Math.sqrt(distRoll),
          bearing = 360 * fr(i, 42),
          v = hubAt(g, hk, dist, bearing),
          I = FK[i % FK.length];
        if (I.n >= 220 || !freeAt(g, v, 5)) continue;
        got++;
        const giantRoll = fr(i, 47),
          H = 8 + 15 * fr(i, 43) * fr(i, 44) + 40 * Math.pow(giantRoll, 5),
          gr = groundAt(g, v),
          yaw = 6.28 * fr(i, 45),
          f: BigFlower = { v, g: gr, H, I, yaw, sq: 0, i: 0 };
        const base = gr - 0.2,
          tilt = (fr(i, 46) - 0.5) * 0.16;
        f.i = stamp(I, v, base, H, yaw, tilt);
        BIGF.push(f);
        occAdd(g, v, 5);
      }
  if (hasModel(g, "lime"))
    [0, 3, 6].forEach((bi) => {
      // 큰 공 여덟 중 셋은 라임: 혼자 천천히 굴러다니고, 밀면 굴러간다
      const b = g.balls.list[bi];
      if (!b) return;
      const m = fit(g, "lime", 4.6, "h");
      m.userData.lime = true;
      b.m.add(m);
      b.lime = m;
      b.m.material.visible = false;
    });
  // 비눗방울: 닿으면 뽁 터지며 살짝 튀어 오른다. 잇달아 터뜨릴수록 더 높이 튄다
  const BUB_N = 420,
    bubbleGeometry = new THREE.SphereGeometry(1, 16, 12),
    bubbleMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.3,
      roughness: 0,
      metalness: 0,
      envMapIntensity: 2.4,
      depthWrite: false,
    }),
    bubM = new THREE.InstancedMesh(bubbleGeometry, bubbleMaterial, BUB_N),
    BUBS = sc.BUBS;
  bubM.frustumCulled = false;
  bubM.count = 0;
  g.scene.add(bubM);
  sc.bubM = bubM;
  for (let hk = 0; hk < HV.length; hk++)
    for (let c0 = 0, got = 0; c0 < 30 && got < 10 && BUBS.length < BUB_N; c0++) {
      // 마을마다 방울 무리 열
      const c = hk * 40 + c0,
        distRoll = fr(c, 91),
        dist = 24 + 196 * Math.sqrt(distRoll),
        bearing = 360 * fr(c, 92),
        cv = hubAt(g, hk, dist, bearing);
      if (!freeAt(g, cv, 2)) continue;
      got++;
      for (let j = 0; j < 7 && BUBS.length < BUB_N; j++) {
        const seed = c * 9 + j,
          spread = 1 + 11 * fr(seed, 93),
          spreadBearing = 360 * fr(seed, 94),
          v = offset(cv, spread, spreadBearing);
        BUBS.push({
          v,
          g: groundAt(g, v),
          h: 2.2 + 13 * fr(seed, 95) * fr(seed, 96),
          r: 0.9 + 1.7 * fr(seed, 97),
          ph: 6.28 * fr(seed, 98),
          t: 0,
          s: 1,
        });
      }
    }
  bubM.count = BUBS.length;
  const bubbleTints = [0xffffff, 0xffc4e0, 0xcfe0ff, 0xfff3b0];
  for (let i = 0; i < BUBS.length; i++) {
    const tint = bubbleTints[i % 4];
    tc.set(tint);
    bubM.setColorAt(i, tc);
  }
  if (bubM.instanceColor) bubM.instanceColor.needsUpdate = true;
  // 꼬마 라임: 여기저기 숨어 있다가, 닿으면 졸졸 따라온다
  const BL = inst(g, "lime", 12);
  sc.BL = BL;
  if (BL) BL.noCull = true;
  if (BL)
    for (let hk = 0; hk < HV.length; hk++)
      for (let i0 = 0, got = 0; i0 < 40 && got < 2; i0++) {
        const i = hk * 50 + i0,
          distRoll = fr(i, 81),
          dist = 34 + 170 * Math.sqrt(distRoll),
          bearing = 360 * fr(i, 82),
          v = hubAt(g, hk, dist, bearing);
        if (!freeAt(g, v, 4)) continue;
        got++; // 마을마다 둘
        const ground = groundAt(g, v);
        sc.BABY.push({
          v,
          g: ground,
          ph: 6.28 * fr(i, 83),
          join: false,
          order: 0,
          pos: v.clone(),
          a: 0,
          i: stamp(BL, v, ground, 1.4, 0),
        });
        occAdd(g, v, 4);
      }
  for (const st of g.sites) sc.CULL.push({ o: st.g, v: st.v });
  for (const c of g.chimes) sc.CULL.push({ o: c.g, v: c.v });
  for (const c of g.cannons) sc.CULL.push({ o: c.g, v: c.v });
  for (const b of g.bumpers) if (b.model) sc.CULL.push({ o: b.model, v: b.v });
  for (const b of g.balloons) if (b.g) sc.CULL.push({ o: b.g, v: b.v });
}

/** 풍경 프레임: 모델이 도형을 따라가고, 가까운 것만 그리고, 발자취를 남기고, 방울·꼬마 라임·나무·꽃이 반응한다 */
export function sceneryFrame(g: Game) {
  const { pl, t, time } = g,
    { p, P } = pl,
    dt = t.dt,
    held = t.held,
    sc = g.scenery;
  bumperModelsFrame(g);
  for (const c of g.chimes) if (c.model) c.model.userData.uLime.value = c.lit * 0.5;
  limeBallsFrame(g);
  for (const c of g.cannons) if (c.model) c.model.userData.uLime.value = c.lit * 0.4;
  const altA = P.length() - S.R; // 내 높이(행성 중심에서)
  if (--sc.cullT <= 0) {
    // 가까운 것만 그린다. 공이 휘어 있어서 먼 것은 어차피 땅에 가린다
    sc.cullT = 20;
    // 높이 뜰수록 더 멀리까지 보인다
    const reach = 0.95 + altA / 260,
      reachAngle = Math.min(1.45, reach),
      cut = Math.cos(reachAngle);
    for (const I of g.models.insts) I.cull(cut);
    flCull(g);
    for (const c of sc.CULL) c.o.visible = c.v.dot(p) > cut;
  }
  const hist = sc.hist;
  if (!hist.length || p.angleTo(hist[0].p) * S.R > 0.3) {
    const footstep: Footstep = { p: p.clone(), a: altA };
    hist.unshift(footstep);
    if (hist.length > 120) hist.pop();
  } // 움직인 만큼만 발자취를 남겨서, 멈춰도 줄지어 서 있다
  if (sc.bubT > 0) {
    sc.bubT -= dt;
    if (sc.bubT <= 0) sc.bubCombo = 0;
  }
  const bubM = sc.bubM!;
  sc.BUBS.forEach((b, i) => {
    if (b.v.dot(p) < 0.8) {
      if (!b.far) {
        b.far = true;
        mI.makeScale(0, 0, 0);
        bubM.setMatrixAt(i, mI);
      }
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
      const combo = sc.bubCombo + 1;
      sc.bubCombo = Math.min(8, combo);
      sc.bubT = 2.2;
      if (!held) {
        const popLift = 2.6 + sc.bubCombo * 0.9;
        pl.vy = Math.max(pl.vy, popLift);
        if (pl.air <= 0) pl.air = 0.01;
      }
      pI.copy(b.v).multiplyScalar(radius);
      const popAt = pI.clone();
      burst(g, popAt, 5, 5);
      if (!g.said.bubble) {
        g.said.bubble = true;
        say(g, "비눗방울 — 잇달아 터뜨릴수록 높이 튑니다");
      }
    }
    // 터진 방울은 다시 생길 때까지 거의 0 크기로 숨기고, 있는 방울은 살짝 일렁인다
    const wobblePhase = time * 2.3 + b.ph,
      wobble = 1 + 0.05 * Math.sin(wobblePhase),
      k = b.t > 0 ? 0.0001 : b.s * wobble,
      size = b.r * k;
    qI.identity();
    pI.copy(b.v).multiplyScalar(radius);
    sI.setScalar(size);
    mI.compose(pI, qI, sI);
    bubM.setMatrixAt(i, mI);
  });
  bubM.instanceMatrix.needsUpdate = true;
  const BL = sc.BL;
  for (const b of sc.BABY) {
    if (!BL) break;
    if (!b.join) {
      const hopPhase = time * 2.4 + b.ph,
        hopWave = Math.sin(hopPhase),
        hop = Math.abs(hopWave) * 0.9,
        height = b.g + hop,
        yaw = time * 1.2 + b.ph;
      putI(BL, b.i, b.v, height, 1.4, yaw);
      if (!held && pl.air < 4 && p.angleTo(b.v) * S.R < 2.6) {
        b.join = true;
        b.order = sc.babyN++;
        b.pos.copy(b.v);
        b.a = b.g;
        const joinAt = P.clone();
        burst(g, joinAt, 8, 7);
        const joinLine =
          sc.babyN < sc.BABY.length
            ? "꼬마 라임 — 졸졸 따라옵니다 (" + sc.babyN + "/" + sc.BABY.length + ")"
            : "꼬마 라임을 모두 모았습니다";
        say(g, joinLine);
        if (sc.babyN === sc.BABY.length)
          for (let k = 0; k < 3; k++) {
            const cheerAt = P.clone(),
              power = 9 + k * 4;
            burst(g, cheerAt, 20, power);
          }
      }
    } else {
      // 줄 선 순서만큼 뒤의 발자취를 따라간다
      const lastStep = hist.length - 1,
        trailGap = 6 * (b.order + 1),
        hgt = hist[Math.min(lastStep, trailGap)],
        followRate = -9 * dt,
        follow = 1 - Math.exp(followRate);
      b.pos.lerp(hgt.p, follow).normalize();
      b.a += (hgt.a - 0.7 - b.a) * follow;
      const hopPhase = time * 7 + b.order * 1.3,
        hopWave = Math.sin(hopPhase),
        height = b.a + Math.abs(hopWave) * 0.45,
        yaw = time * 3 + b.order;
      putI(BL, b.i, b.pos, height, 1.2, yaw);
    }
  }
  for (const tr of sc.TREES) {
    const d = p.angleTo(tr.v) * S.R,
      a = altA - tr.g,
      crownReach = tr.cr * 0.85;
    if (!held && d < crownReach && a > tr.cb && a < tr.H + 2) {
      if (pl.vy <= 0.5 && a > tr.H * 0.86) {
        pl.vy = 10.5;
        if (pl.air <= 0) pl.air = 0.01;
        tr.sq = 1;
        const bounceAt = P.clone();
        burst(g, bounceAt, 8, 7);
        if (!g.said.tree) {
          g.said.tree = true;
          say(g, "솜사탕 나무 — 위에 내려앉으면 통 튑니다");
        }
      } else if (a < tr.H * 0.86) {
        const a0 = pl.air;
        pl.air = 0;
        blockAt(g, tr.v, crownReach, 1);
        pl.air = a0;
        tr.sq = Math.max(tr.sq, 0.5);
      }
    } else if (!held && a < tr.cb) {
      const trunkReach = tr.tr + 0.7;
      blockAt(g, tr.v, trunkReach, 1e9);
    }
    if (tr.sq > 0) {
      const settled = tr.sq - dt * 1.6;
      tr.sq = Math.max(0, settled);
      const base = tr.g - 0.4,
        squishPhase = tr.sq * Math.PI * 3,
        squish = 1 - 0.07 * Math.sin(squishPhase) * tr.sq;
      restamp(tr.T.I, tr.i, tr.v, base, tr.H, tr.yaw, squish);
    }
  }
  for (const f of sc.BIGF) {
    const d = p.angleTo(f.v) * S.R,
      a = altA - f.g;
    if (!held && d < f.H * 0.32 && a > f.H * 0.55 && a < f.H + 1.6 && pl.vy <= 0.5 && f.sq < 0.3) {
      pl.vy = 7.5;
      if (pl.air <= 0) pl.air = 0.01;
      f.sq = 1;
      const bounceAt = P.clone();
      burst(g, bounceAt, 5, 6);
      if (!g.said.flower) {
        g.said.flower = true;
        say(g, "큰 풍선 꽃 — 밟으면 통 튑니다");
      }
    } else if (!held && d < 2.6 && a < f.H * 0.55 && f.sq < 0.3) {
      // 줄기에 닿으면 꽃이 움츠렸다가 꽃송이 높이까지 쏘아 올린다
      f.sq = 1;
      const climb = f.H + 5 - Math.max(0, a),
        launchSquared = climb / 0.344,
        launch = Math.sqrt(launchSquared);
      pl.vy = Math.max(pl.vy, launch);
      if (pl.air <= 0) pl.air = 0.01;
      const launchAt = P.clone();
      burst(g, launchAt, 8, 8);
      if (!g.said.flower) {
        g.said.flower = true;
        say(g, "큰 풍선 꽃 — 줄기에 닿으면 꽃 위로 쏘아 올립니다");
      }
    }
    if (f.sq > 0) {
      const settled = f.sq - dt * 1.4;
      f.sq = Math.max(0, settled);
      const base = f.g - 0.2,
        wigglePhase = f.sq * 14,
        yaw = f.yaw + Math.sin(wigglePhase) * 0.25 * f.sq,
        squishPhase = f.sq * Math.PI * 3,
        squish = 1 - 0.1 * Math.sin(squishPhase) * f.sq;
      restamp(f.I, f.i, f.v, base, f.H, yaw, squish);
    }
  }
}

/** 고래·풍선·별에 모델 틀을 끼운다(생물은 놀이기구가 아니다. 풍선과 별만 에셋으로 바꾼다) */
export function fitSkyModels(g: Game) {
  if (hasModel(g, "whale")) {
    const W = fit(g, "whale", 64, "z");
    W.rotation.y = Math.PI / 2; // 고래 모델은 머리가 +z라서 나아가는 방향(+x)으로 돌려 놓는다
    g.whale.g.add(W);
  }
  if (hasModel(g, "balloon"))
    for (const b of g.balloons) {
      const m = fit(g, "balloon", 6, "h");
      m.position.y = -0.4;
      const prim = b.g.children.slice();
      b.g.add(m);
      swapWhenReady(g, "balloon", prim);
    }
  if (hasModel(g, "star"))
    for (const st of g.stars.list) {
      st.model = fit(g, "star", 1.7, "h");
      g.scene.add(st.model);
      swapWhenReady(g, "star", [st.m]);
    }
}

/** 고양이 모델이 라임 공 고양이를 따라 둥실 */
export function catFrame(g: Game) {
  const C = g.scenery.catModel;
  if (C) C.position.copy(g.me.cat.position);
}

/* ─── 내부 ─────────────────────────── */

// 관람차: 받침과 바퀴를 따로 세워서 바퀴가 실제로 돈다
function buildFerris(g: Game): Hold {
  const G = new THREE.Group() as Hold,
    fsK = g.sites.find((x) => x.k === "ferris")?.sc || 1,
    standH = 23 * fsK,
    wheelH = 34 * fsK,
    stand = fit(g, "ferris_stand", standH, "h"),
    wheel = fit(g, "ferris_wheel", wheelH, "h");
  stand.position.y = stand.userData.hh;
  G.add(stand);
  stand.updateMatrixWorld(true);
  // 받침 꼭대기(축)가 뻗은 방향을 찾는다: 위쪽 꼭짓점들이 더 길게 퍼진 쪽
  const sb = new THREE.Box3().setFromObject(stand),
    cut = sb.min.y + (sb.max.y - sb.min.y) * 0.84;
  const axleY = sb.min.y + (sb.max.y - sb.min.y) * 0.9;
  // 바퀴의 얇은 쪽(바퀴 면에 수직인 쪽)을 축 방향에 맞춘다
  wheel.updateMatrixWorld(true);
  const wheelBox = new THREE.Box3().setFromObject(wheel),
    wb = new THREE.Vector3();
  wheelBox.getSize(wb);
  const thinX = wb.x < wb.z;
  const pivot = new THREE.Group(),
    spin = new THREE.Group();
  pivot.position.y = axleY;
  wheel.rotation.y = thinX ? Math.PI / 2 : 0;
  spin.add(wheel);
  pivot.add(spin);
  G.add(pivot);
  whenModel(g, "ferris_stand", () => {
    // 꼭짓점은 관람차 그룹(G) 기준으로 잰다(끼우기 전과 같은 좌표)
    G.updateMatrixWorld(true);
    const toG = new THREE.Matrix4().copy(G.matrixWorld).invert(),
      m = new THREE.Matrix4(),
      V = new THREE.Vector3();
    let x0 = 1e9,
      x1 = -1e9,
      z0 = 1e9,
      z1 = -1e9;
    stand.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      m.multiplyMatrices(toG, o.matrixWorld);
      const a = o.geometry.attributes.position;
      for (let i = 0; i < a.count; i += 2) {
        V.fromBufferAttribute(a, i).applyMatrix4(m);
        if (V.y > cut) {
          x0 = Math.min(x0, V.x);
          x1 = Math.max(x1, V.x);
          z0 = Math.min(z0, V.z);
          z1 = Math.max(z1, V.z);
        }
      }
    });
    const axleX = x1 - x0 > z1 - z0;
    pivot.rotation.y = axleX ? Math.PI / 2 : 0; // pivot 의 z 축 = 축 방향
  });
  G.userData = {
    k: 1,
    hh: 0,
    top: axleY + 17 * fsK,
    rw: 17 * fsK,
    uLime: { value: 0 },
    yq: new THREE.Quaternion(),
    spin,
    parts: [stand, wheel],
  };
  return G;
}
