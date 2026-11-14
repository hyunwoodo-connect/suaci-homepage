import * as THREE from "three";

import type { Game } from "../state";
import { BG } from "../state";

// 지나온 자리 기록(별이 따라오는 데 쓴다)과 꼬리 리본.
// 리본: 몸 쪽은 넓고 라임, 뒤로 갈수록 가늘어지며 하얗게 사라진다. 그 둘레에 넓고 옅은 빛을 한 겹 더 두른다. 스카프처럼 살짝 나부낀다

/** 리본 한 겹 */
interface Ribbon {
  pos: Float32Array;
  g: THREE.BufferGeometry;
  wMul: number;
}

/** 지나온 자리와 꼬리 리본 */
export interface Trail {
  /** 기록하는 점 수 */
  N: number;
  pos: Float32Array;
  col: Float32Array;
  geo: THREE.BufferGeometry;
  ribs: Ribbon[];
  /** 기록 색의 바탕(톤의 하늘색) */
  bgc: THREE.Color;
  /** 리본의 옆 방향 — 프레임을 넘어 이어져야 꼬이지 않는다 */
  side: THREE.Vector3;
}

const TRAIL = 90,
  RN = TRAIL + 1;
const zbA = new THREE.Vector3(),
  zbB = new THREE.Vector3(),
  zbT = new THREE.Vector3(),
  zbU = new THREE.Vector3(),
  zbX = new THREE.Vector3();

/** 기록 선(숨김)과 리본 두 겹을 만든다 */
export function createTrail(g: Game): Trail {
  const pos = new Float32Array(TRAIL * 3),
    col = new Float32Array(TRAIL * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, fog: false }));
  line.frustumCulled = false;
  g.scene.add(line);
  line.visible = false; // 얇은 선은 감추고 아래 리본으로 그린다(지나온 자리 기록은 별이 따라오는 데 계속 쓴다)
  const mkRibbon = (wMul: number, aMul: number, add: boolean): Ribbon => {
    const rpos = new Float32Array(RN * 6),
      rcol = new Float32Array(RN * 8),
      idx: number[] = [],
      c0 = new THREE.Color(0xa9ff39),
      c1 = new THREE.Color(0xffffff),
      c = new THREE.Color();
    for (let i = 0; i < RN; i++) {
      const t = i / (RN - 1),
        u = Math.min(1, t / 0.19),
        a = Math.pow(1 - u, 1.7) * aMul * Math.min(1, i / 2);
      // 카메라가 바로 뒤에 있어서 긴 꼬리는 화면을 덮는다. 앞쪽 3분의 1(1.5초쯤)만 보이게 한다
      c.copy(c0).lerp(c1, 0.25 + u * 0.6);
      for (let s = 0; s < 2; s++) rcol.set([c.r, c.g, c.b, a], (i * 2 + s) * 4);
      if (i < RN - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute("position", new THREE.BufferAttribute(rpos, 3));
    rg.setAttribute("color", new THREE.BufferAttribute(rcol, 4));
    rg.setIndex(idx);
    const m = new THREE.Mesh(
      rg,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
        blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
      }),
    );
    m.frustumCulled = false;
    m.renderOrder = 2;
    g.scene.add(m);
    return { pos: rpos, g: rg, wMul };
  };
  const ribs = [mkRibbon(2.4, 0.1, true), mkRibbon(1, 0.42, false)];
  const bgc = new THREE.Color(BG),
    tc = new THREE.Color();
  for (let i = 0; i < TRAIL; i++) {
    tc.copy(g.mats.lime).lerp(bgc, i / (TRAIL - 1));
    col.set([tc.r, tc.g, tc.b], i * 3);
  }
  return { N: TRAIL, pos, col, geo, ribs, bgc, side: new THREE.Vector3(1, 0, 0) };
}

/** 기록을 한 점으로 모은다(출발·순간 이동 뒤) */
export function resetTrail(g: Game, P: THREE.Vector3) {
  const tr = g.trail;
  for (let i = 0; i < TRAIL; i++) tr.pos.set([P.x, P.y, P.z], i * 3);
}

/** 기록을 밀고 리본을 다시 그린다 */
export function trailFrame(g: Game) {
  const { pl, t, time } = g,
    { p, P } = pl,
    tr = g.trail;
  if (pl.trailReset) {
    pl.trailReset = false;
    resetTrail(g, P);
    tr.geo.attributes.position.needsUpdate = true;
  }
  pl.trailT += t.dt;
  if (pl.trailT > 0.05) {
    pl.trailT = 0;
    tr.pos.copyWithin(3, 0, (TRAIL - 1) * 3);
    tr.pos[0] = P.x - p.x * 0.25;
    tr.pos[1] = P.y - p.y * 0.25;
    tr.pos[2] = P.z - p.z * 0.25;
    tr.geo.attributes.position.needsUpdate = true;
  }
  ribbonUpdate(g, P, time);
}

/* ─── 내부 ─────────────────────────── */

function ribbonUpdate(g: Game, P: THREE.Vector3, time: number) {
  const tr = g.trail,
    trailPos = tr.pos,
    zbS = tr.side;
  for (let i = 0; i < RN; i++) {
    const t = i / (RN - 1);
    if (i === 0) zbA.copy(P);
    else zbA.fromArray(trailPos, (i - 1) * 3);
    if (i < RN - 1) {
      zbB.fromArray(trailPos, i * 3);
      zbT.copy(zbA).sub(zbB);
    } // 마지막 점은 앞 점의 방향을 그대로 쓴다
    zbU.copy(zbA).normalize();
    zbX.crossVectors(zbT, zbU);
    if (zbX.lengthSq() > 1e-4) {
      zbX.normalize();
      if (zbX.dot(zbS) < 0 && i > 0) zbX.negate();
      zbS.lerp(zbX, i === 0 ? 1 : 0.5).normalize();
    }
    const u = Math.min(1, t / 0.19),
      flap = Math.sin(u * 9 - time * 7) * 0.14 * Math.min(1, u * 3) * (1 - u),
      hw = 0.19 * Math.pow(1 - u, 1.1) * (0.5 + 0.5 * Math.min(1, i / 3));
    for (const r of tr.ribs) {
      const w = hw * r.wMul,
        o = i * 6;
      r.pos[o] = zbA.x + zbS.x * w + zbU.x * flap;
      r.pos[o + 1] = zbA.y + zbS.y * w + zbU.y * flap;
      r.pos[o + 2] = zbA.z + zbS.z * w + zbU.z * flap;
      r.pos[o + 3] = zbA.x - zbS.x * w + zbU.x * flap;
      r.pos[o + 4] = zbA.y - zbS.y * w + zbU.y * flap;
      r.pos[o + 5] = zbA.z - zbS.z * w + zbU.z * flap;
    }
  }
  for (const r of tr.ribs) r.g.attributes.position.needsUpdate = true;
}
