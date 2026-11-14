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
  const trailFloats = TRAIL * 3;
  const pos = new Float32Array(trailFloats),
    col = new Float32Array(trailFloats);
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(pos, 3);
  geo.setAttribute("position", posAttr);
  const colAttr = new THREE.BufferAttribute(col, 3);
  geo.setAttribute("color", colAttr);
  const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, fog: false });
  const line = new THREE.Line(geo, lineMat);
  line.frustumCulled = false;
  g.scene.add(line);
  line.visible = false; // 얇은 선은 감추고 아래 리본으로 그린다(지나온 자리 기록은 별이 따라오는 데 계속 쓴다)
  const ribs = [createRibbon(g, 2.4, 0.1, true), createRibbon(g, 1, 0.42, false)];
  const bgc = new THREE.Color(BG),
    tc = new THREE.Color();
  const lastIndex = TRAIL - 1;
  for (let i = 0; i < TRAIL; i++) {
    const fade = i / lastIndex;
    tc.copy(g.mats.lime).lerp(bgc, fade);
    const offset = i * 3;
    col.set([tc.r, tc.g, tc.b], offset);
  }
  return { N: TRAIL, pos, col, geo, ribs, bgc, side: new THREE.Vector3(1, 0, 0) };
}

/** 기록을 한 점으로 모은다(출발·순간 이동 뒤) */
export function resetTrail(g: Game, P: THREE.Vector3) {
  const tr = g.trail;
  for (let i = 0; i < TRAIL; i++) {
    const offset = i * 3;
    tr.pos.set([P.x, P.y, P.z], offset);
  }
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
    // 한 점씩 뒤로 밀고 맨 앞에 새 자리(몸보다 조금 땅 쪽)를 쓴다
    const keptEnd = (TRAIL - 1) * 3;
    tr.pos.copyWithin(3, 0, keptEnd);
    tr.pos[0] = P.x - p.x * 0.25;
    tr.pos[1] = P.y - p.y * 0.25;
    tr.pos[2] = P.z - p.z * 0.25;
    tr.geo.attributes.position.needsUpdate = true;
  }
  ribbonUpdate(g, P, time);
}

/* ─── 내부 ─────────────────────────── */

// 리본 한 겹: 점마다 양옆 두 꼭짓점, 이웃한 두 점 사이를 삼각형 둘로 잇는다
function createRibbon(g: Game, wMul: number, aMul: number, add: boolean): Ribbon {
  // 점마다 꼭짓점 둘: 위치 xyz 둘, 색 rgba 둘
  const posFloats = RN * 6,
    colFloats = RN * 8;
  const rpos = new Float32Array(posFloats),
    rcol = new Float32Array(colFloats),
    idx: number[] = [],
    c0 = new THREE.Color(0xa9ff39),
    c1 = new THREE.Color(0xffffff),
    c = new THREE.Color();
  const lastIndex = RN - 1;
  for (let i = 0; i < RN; i++) {
    const t = i / lastIndex;
    // 카메라가 바로 뒤에 있어서 긴 꼬리는 화면을 덮는다. 앞쪽 3분의 1(1.5초쯤)만 보이게 한다
    const tVisible = t / 0.19;
    const u = Math.min(1, tVisible);
    const rest = 1 - u;
    const tailFade = Math.pow(rest, 1.7);
    const headHalf = i / 2;
    const headRamp = Math.min(1, headHalf);
    const a = tailFade * aMul * headRamp;
    const whiten = 0.25 + u * 0.6;
    c.copy(c0).lerp(c1, whiten);
    const rgba = [c.r, c.g, c.b, a];
    for (let s = 0; s < 2; s++) {
      const offset = (i * 2 + s) * 4;
      rcol.set(rgba, offset);
    }
    if (i < lastIndex) {
      const leftHere = i * 2,
        rightHere = i * 2 + 1,
        leftNext = i * 2 + 2,
        rightNext = i * 2 + 3;
      idx.push(leftHere, rightHere, leftNext, rightHere, rightNext, leftNext);
    }
  }
  const rg = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(rpos, 3);
  rg.setAttribute("position", posAttr);
  const colAttr = new THREE.BufferAttribute(rcol, 4);
  rg.setAttribute("color", colAttr);
  rg.setIndex(idx);
  const ribbonMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
    blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const m = new THREE.Mesh(rg, ribbonMat);
  m.frustumCulled = false;
  m.renderOrder = 2;
  g.scene.add(m);
  return { pos: rpos, g: rg, wMul };
}

function ribbonUpdate(g: Game, P: THREE.Vector3, time: number) {
  const tr = g.trail,
    trailPos = tr.pos,
    zbS = tr.side;
  const lastIndex = RN - 1;
  for (let i = 0; i < RN; i++) {
    const t = i / lastIndex;
    if (i === 0) zbA.copy(P);
    else {
      const prevAt = (i - 1) * 3;
      zbA.fromArray(trailPos, prevAt);
    }
    if (i < lastIndex) {
      const at = i * 3;
      zbB.fromArray(trailPos, at);
      zbT.copy(zbA).sub(zbB);
    } // 마지막 점은 앞 점의 방향을 그대로 쓴다
    zbU.copy(zbA).normalize();
    zbX.crossVectors(zbT, zbU);
    if (zbX.lengthSq() > 1e-4) {
      zbX.normalize();
      if (zbX.dot(zbS) < 0 && i > 0) zbX.negate();
      const follow = i === 0 ? 1 : 0.5;
      zbS.lerp(zbX, follow).normalize();
    }
    const tVisible = t / 0.19;
    const u = Math.min(1, tVisible);
    const rest = 1 - u;
    const flapPhase = u * 9 - time * 7;
    const flapIn = u * 3;
    const flap = Math.sin(flapPhase) * 0.14 * Math.min(1, flapIn) * rest;
    const thin = Math.pow(rest, 1.1);
    const headThird = i / 3;
    const headRamp = Math.min(1, headThird);
    const hw = 0.19 * thin * (0.5 + 0.5 * headRamp);
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
