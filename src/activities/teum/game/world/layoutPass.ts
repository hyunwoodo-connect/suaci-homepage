import * as THREE from "three";

import { layoutArches } from "../rides/arches";
import { layoutBalloons } from "../rides/balloons";
import { layoutBalls } from "../rides/balls";
import { layoutBumpers } from "../rides/bumpers";
import { layoutCannons } from "../rides/cannons";
import { layoutChimes } from "../rides/chimes";
import { layoutFunnels } from "../rides/funnels";
import { layoutHoles } from "../rides/holes";
import { layoutJets } from "../rides/jets";
import { layoutHops, layoutPads } from "../rides/pads";
import { layoutPillars } from "../rides/pillars";
import { layoutPipes } from "../rides/pipes";
import { layoutRails } from "../rides/rails";
import { layoutRings } from "../rides/rings";
import { layoutRockets } from "../rides/rockets";
import { layoutBuds, layoutSeedFields } from "../rides/seeds";
import { layoutSlings } from "../rides/slings";
import { layoutStars } from "../rides/stars";
import { layoutStreams } from "../rides/streams";
import { layoutSwings } from "../rides/swings";
import { layoutThermals } from "../rides/thermals";
import { layoutWhirls } from "../rides/whirls";
import { layoutWings } from "../rides/wings";
import type { Game } from "../state";
import { S } from "../state";
import { flCull } from "./flowers";
import { layoutLakes } from "./lakes";
import { offset, UP } from "./sphere";
import type { Field } from "./terrain";
import { CL_H, CLOUD_N, featGround, groundAt, putClump, setCloud } from "./terrain";

// 배치: 자리표를 행성 위 자리로 옮긴다. 놀이·장소 자리를 모아(keep) 그 자리를 덮는 둔덕은 치운다.
// 순서가 곧 결과다(앞 것의 끝에 뒤 것이 이어 붙고, 땅 높이는 그때까지 켜진 언덕으로 잰다) — 순서를 바꾸지 않는다

const q = new THREE.Quaternion(),
  m4 = new THREE.Matrix4(),
  sc = new THREE.Vector3(),
  ps = new THREE.Vector3();

/** 모든 것을 자리에 놓는다 */
export function layoutWorld(g: Game) {
  const { terrain: T, places } = g;
  g.ground.planet.scale.setScalar(S.R);
  places.list.forEach((pl, i) => places.PV[i].copy(pl.at()));
  for (const f of T.features) {
    const center = f.at();
    f.v.copy(center);
    f.mesh.position.copy(f.v).multiplyScalar(S.R);
    f.mesh.quaternion.setFromUnitVectors(UP, f.v);
    const pts: THREE.Vector2[] = []; // 자락이 행성 곡면에 붙도록 실제 크기로 만든다
    for (let i = 0; i <= 48; i++) {
      const r = (f.s * i) / 48;
      const phase = (Math.PI * r) / f.s;
      // 종 모양 높이에서 곡면이 내려가는 만큼(r²/2R)을 빼 자락이 땅에 붙게 한다
      const y = f.H * 0.5 * (Math.cos(phase) + 1) - (r * r) / (2 * S.R) - 0.05;
      const pt = new THREE.Vector2(r, y);
      pts.push(pt);
    }
    f.mesh.geometry.dispose();
    f.mesh.geometry = new THREE.LatheGeometry(pts, 72);
  }
  const keep: THREE.Vector3[] = [];
  for (const it of places.items) {
    const at = it.at();
    it.v.copy(at);
    keep.push(it.v);
    const radius = S.R + it.lift + featGround(g, it.v);
    it.obj.position.copy(it.v).multiplyScalar(radius);
    it.obj.quaternion.setFromUnitVectors(UP, it.v);
  }
  layoutStreams(g, keep);
  layoutWhirls(g, keep);
  layoutChimes(g, keep);
  layoutRings(g, keep);
  layoutHops(g);
  layoutCannons(g, keep);
  layoutBumpers(g, keep);
  layoutBalloons(g, keep);
  layoutArches(g, keep);
  layoutBalls(g, keep);
  g.zones.length = 0;
  layoutRockets(g, keep);
  layoutThermals(g, keep);
  layoutWings(g, keep);
  layoutJets(g);
  layoutSwings(g, keep);
  layoutPipes(g);
  layoutRails(g, keep);
  layoutFunnels(g);
  layoutSeedFields(g);
  layoutBuds(g);
  g.stars.followers.length = 0;
  layoutStars(g, keep);
  layoutLakes(g);
  layoutSlings(g, keep);
  layoutHoles(g, keep);
  layoutPads(g, keep);
  layoutPillars(g, keep);
  const { bumps, hills, clouds, clump, features: FEATURES } = T,
    LAKES = g.lakes.list,
    ZONES = g.zones;
  for (let i = 0; i < bumps.v.length; i++) {
    const wide = bumps.s[i] * 1.5,
      tall = bumps.s[i] * 0.5;
    put(bumps, i, -0.05, wide, tall, wide);
  }
  for (let i = 0; i < hills.v.length; i++) {
    // 놀이·장소를 덮는 언덕은 치운다
    hills.on[i] =
      !keep.some((k) => k.angleTo(hills.v[i]) * S.R < hills.s[i] + 10) &&
      !FEATURES.some((f) => f.v.angleTo(hills.v[i]) * S.R < hills.s[i] + f.s) &&
      !LAKES.some((l) => l.v.angleTo(hills.v[i]) * S.R < hills.s[i] + l.r) &&
      !ZONES.some((z) => z.v.angleTo(hills.v[i]) * S.R < hills.s[i] + z.r);
    // 치운 둔덕도 칸은 그대로 두고 아주 작게 줄인다(둘레 솜 덩어리도 같이 줄어든다)
    const k = hills.on[i] ? hills.s[i] : 0.0001;
    const flat = k * 0.3;
    put(hills, i, 0, k, flat, k);
    // 뭉게구름 덩어리: 가운데 큰 덩이 하나와 둘레 다섯
    const middleSlot = i * 6;
    const middleSink = -0.04 * k,
      middleWide = 0.52 * k,
      middleTall = 0.34 * k;
    putClump(g, middleSlot, hills.v[i], middleSink, middleWide, middleTall);
    for (let j = 0; j < 5; j++) {
      const c = hills.c[i][j];
      const slot = i * 6 + 1 + j;
      const reach = c[1] * k;
      const at = hills.on[i] ? offset(hills.v[i], reach, c[0]) : hills.v[i];
      const sink = -0.03 * k,
        wide = c[2] * k,
        tall = c[2] * k * 0.62;
      putClump(g, slot, at, sink, wide, tall);
    }
  }
  FEATURES.forEach((f, fi) =>
    f.c.forEach((c, j) => {
      // 큰 언덕 비탈에도 솜 뭉치를 얹는다
      const reach = c[1] * f.s;
      const v = offset(f.v, reach, c[0]),
        sz = c[2] * f.s;
      const slot = CL_H + fi * 16 + j;
      const lift = featGround(g, v) - sz * 0.22;
      const tall = sz * 0.6;
      putClump(g, slot, v, lift, sz, tall);
    }),
  );
  clump.instanceMatrix.needsUpdate = true;
  g.ground.GND.uInvR.value = 1 / S.R;
  for (let k = 0; k < bumps.v.length; k++) bumps.g[k] = groundAt(g, bumps.v[k]); // 꽃은 언덕 위에도 땅 높이에 맞춰 핀다
  flCull(g);
  for (let i = 0; i < CLOUD_N; i++) {
    const radius = S.R + clouds.h[i] + clouds.s[i] * 0.6;
    clouds.c[i].copy(clouds.v[i]).multiplyScalar(radius);
    clouds.burst[i] = 0;
    setCloud(g, i, 0);
  }
  clouds.m.instanceColor!.needsUpdate = true;
  for (const f of [bumps, hills, clouds]) f.m.instanceMatrix.needsUpdate = true;
  g.fog.near = 28;
  g.fog.far = 340;
}

/* ─── 내부 ─────────────────────────── */

function put(f: Field, i: number, lift: number, sx: number, sy: number, sz: number) {
  q.setFromUnitVectors(UP, f.v[i]);
  const radius = S.R + lift;
  ps.copy(f.v[i]).multiplyScalar(radius);
  sc.set(sx, sy, sz);
  m4.compose(ps, q, sc);
  f.m.setMatrixAt(i, m4);
}
