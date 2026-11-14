import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Services } from "../services";

// 지나온 자리 기록(별이 따라오는 데 쓴다)과 꼬리 리본.
// 리본: 몸 쪽은 넓고 라임, 뒤로 갈수록 가늘어지며 하얗게 사라진다. 그 둘레에 넓고 옅은 빛을 한 겹 더 두른다. 스카프처럼 살짝 나부낀다.
// 순간 이동(출발·구멍·시험용 옮기기)하면 기록을 한 점으로 모은다 — 몸이 옮긴 횟수(player.jumps)가 바뀌는 것으로 안다

/** 리본 한 겹 */
interface Ribbon {
  pos: Float32Array;
  g: THREE.BufferGeometry;
  m: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  wMul: number;
}

/** 기록하는 점 수 */
const TRAIL = 90,
  RN = TRAIL + 1,
  TRAIL_FLOATS = TRAIL * 3;
const zbA = new THREE.Vector3(),
  zbB = new THREE.Vector3(),
  zbT = new THREE.Vector3(),
  zbU = new THREE.Vector3(),
  zbX = new THREE.Vector3();

/** 지나온 자리와 꼬리 리본 */
export class Trail implements Thing {
  /** 기록하는 점 수 */
  readonly N = TRAIL;
  /** 지나온 자리(점마다 xyz, 0 이 가장 최근) */
  readonly pos = new Float32Array(TRAIL_FLOATS);
  private readonly ribs: Ribbon[];
  /** 리본의 옆 방향 — 프레임을 넘어 이어져야 꼬이지 않는다 */
  private readonly side = new THREE.Vector3(1, 0, 0);
  private trailT = 0;
  private jumps = -1;

  /** 리본 두 겹을 만든다(넓고 옅은 빛 + 좁은 띠) */
  constructor(private readonly s: Services) {
    this.ribs = [createRibbon(s, 2.4, 0.1, true), createRibbon(s, 1, 0.42, false)];
  }

  /** 기록을 밀고 리본을 다시 그린다 */
  update(f: Frame) {
    const pl = this.s.player,
      p = pl.p,
      P = pl.P;
    if (pl.jumps !== this.jumps) {
      this.jumps = pl.jumps;
      this.reset(P);
    }
    this.trailT += f.dt;
    if (this.trailT > 0.05) {
      this.trailT = 0;
      // 한 점씩 뒤로 밀고 맨 앞에 새 자리(몸보다 조금 땅 쪽)를 쓴다
      const keptEnd = (TRAIL - 1) * 3;
      this.pos.copyWithin(3, 0, keptEnd);
      this.pos[0] = P.x - p.x * 0.25;
      this.pos[1] = P.y - p.y * 0.25;
      this.pos[2] = P.z - p.z * 0.25;
    }
    this.ribbons(P, f.time);
  }

  /** 치운다 */
  dispose() {
    for (const r of this.ribs) {
      r.m.removeFromParent();
      r.g.dispose();
      r.m.material.dispose();
    }
  }

  // 기록을 한 점으로 모은다(출발·순간 이동 뒤)
  private reset(P: Readonly<THREE.Vector3>) {
    for (let i = 0; i < TRAIL; i++) {
      const at = i * 3;
      this.pos[at] = P.x;
      this.pos[at + 1] = P.y;
      this.pos[at + 2] = P.z;
    }
  }

  private ribbons(P: Readonly<THREE.Vector3>, time: number) {
    const trailPos = this.pos,
      zbS = this.side;
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
      const flapRamp = Math.min(1, flapIn);
      const flap = Math.sin(flapPhase) * 0.14 * flapRamp * rest;
      const thin = Math.pow(rest, 1.1);
      const headThird = i / 3;
      const headRamp = Math.min(1, headThird);
      const hw = 0.19 * thin * (0.5 + 0.5 * headRamp);
      for (const r of this.ribs) {
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
    for (const r of this.ribs) r.g.attributes.position.needsUpdate = true;
  }
}

/* ─── 내부 ─────────────────────────── */

// 리본 한 겹: 점마다 양옆 두 꼭짓점, 이웃한 두 점 사이를 삼각형 둘로 잇는다
function createRibbon(s: Services, wMul: number, aMul: number, add: boolean): Ribbon {
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
    for (let k = 0; k < 2; k++) {
      const at = (i * 2 + k) * 4;
      rcol.set(rgba, at);
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
    // 납작한 판이라 앞뒤를 두 번 나눠 그릴 까닭이 없다(나누면 three 가 프레임마다 셰이더를 다시 고른다)
    forceSinglePass: true,
    fog: false,
    blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const m = new THREE.Mesh(rg, ribbonMat);
  m.frustumCulled = false;
  m.renderOrder = 2;
  s.scene.add(m);
  return { pos: rpos, g: rg, m, wMul };
}
