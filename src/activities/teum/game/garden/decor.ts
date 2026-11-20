import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Girth } from "../models/extent";
import type { Instancer } from "../models/instancer";
import type { Services } from "../services";
import { S } from "../settings";
import { from } from "../world/sphere";
import { chordOf, SphereGrid } from "../world/sphereGrid";
import { whitenGreenYellow } from "./recolor";

// 정원 꾸밈(기획 MAP-03 3·4장 — 자리표 decor 837 + 숨는 자리 hideSpot 12): 모델마다 한 묶음(InstancedMesh)으로 찍는다.
// h 는 높이(m) — 모델을 그 높이로 키운다, rot 은 도는 각(도), lift 는 땅에서 띄우는 높이(m).
// plate 는 코드로 그리는 흰 접시(코발트 테두리) — 케이크가 그 위에 선다. 케이크 위(lift)에 놓인 것은 접시 두께만큼 더 띄운다.
// 꽃은 초록 줄기·잎과 노랑 가운데를 흰색으로 칠한다(맵에 초록·노랑 없음). 꽃은 지나갈 수 있고, 나머지는 몸의 높이마다 굵기대로 막는다.
// 숨는 자리는 자리만 잡아 그린다(리본·숨바꼭질 판은 아직 — MAP-02 8장)

/** 케이크 접시 두께(m) — 케이크와 케이크 위에 놓인 것은 이만큼 위에 선다 */
export const PLATE_H = 1.2;
/** 접시: 두께(m) · 코발트 테두리 폭(m) · 색 */
const PLATE = { h: PLATE_H, rim: 3, white: 0xffffff, cobalt: 0x2a4fd0 } as const;
/** 지나갈 수 있는 꾸밈(꽃은 막지 않는다) */
const SOFT = new Set(["flower_pink", "flower_blue"]);
/** 줄기·잎·가운데를 흰색으로 칠하는 꾸밈 */
const RECOLOR = ["flower_pink", "flower_blue"];
/** 막는 것을 찾아보는 둘레(m) · 칸(현 길이) · 굵기 띠 수 */
const NEAR = 40;
const GRID_CELL = 0.06;
const BANDS = 16;

/** 찍을 것 하나 */
interface Piece {
  model: string;
  v: THREE.Vector3;
  h: number;
  yaw: number;
  /** 땅에서 띄운 높이(m — 케이크 위는 접시 두께 포함) */
  lift: number;
  /** 바닥 높이(땅 + lift) — layout 이 채운다 */
  base: number;
}

/** 정원 꾸밈 전체 */
export class GardenDecor implements Thing {
  private readonly pieces: Piece[] = [];
  private readonly grid = new SphereGrid(GRID_CELL);
  private readonly near: number[] = [];
  private readonly insts = new Map<string, Instancer>();
  /** 모델 키 → 키 1 일 때 띠마다 반지름(모델이 오면 잰다) */
  private readonly unitGirth = new Map<string, number[]>();
  private readonly plate: THREE.Group | null = null;
  private readonly owned: { dispose(): void }[] = [];

  constructor(private readonly s: Services) {
    const L = s.layout;
    let plateSpot: { v: THREE.Vector3; r: number } | null = null;
    for (const d of L.decor ?? []) {
      const v = from(d.dist, d.bear);
      if (d.model === "plate") {
        plateSpot = { v, r: d.r ?? 0 };
        continue;
      }
      const onCake = d.lift !== undefined && d.zone === "landmark";
      const extra = onCake ? PLATE.h : 0;
      const lift = (d.lift ?? 0) + extra;
      const yaw = THREE.MathUtils.degToRad(d.rot);
      this.pieces.push({ model: d.model, v, h: d.h, yaw, lift, base: 0 });
    }
    for (const hs of L.hideSpot ?? []) {
      const v = from(hs.dist, hs.bear);
      const onCake = hs.tier > 0;
      const extra = onCake ? PLATE.h : 0;
      const lift = (hs.lift ?? 0) + extra;
      this.pieces.push({ model: hs.model, v, h: hs.h, yaw: 0, lift, base: 0 });
    }
    // 모델마다 한 묶음
    const counts = new Map<string, number>();
    for (const p of this.pieces) {
      const n = counts.get(p.model) ?? 0;
      const more = n + 1;
      counts.set(p.model, more);
    }
    for (const [k, n] of counts) {
      const inst = s.models.inst(k, n);
      if (!inst) continue;
      this.insts.set(k, inst);
      s.models.when(k, () => this.measure(k, inst));
    }
    for (const p of this.pieces) this.grid.add(p.v);
    if (plateSpot) this.plate = this.buildPlate(plateSpot.v, plateSpot.r);
  }

  /** 땅 높이가 정해진 뒤 찍는다(놓기 다음) */
  layout() {
    const { terrain } = this.s;
    for (const p of this.pieces) {
      p.base = terrain.featGround(p.v) + p.lift;
      const inst = this.insts.get(p.model);
      inst?.stamp(p.v, p.base, p.h, p.yaw);
    }
    if (this.plate) {
      const v = this.plate.userData.v as THREE.Vector3;
      const ground = terrain.featGround(v);
      const radius = S.R + ground;
      this.plate.position.copy(v).multiplyScalar(radius);
      this.plate.quaternion.setFromUnitVectors(UP, v);
    }
  }

  /** 꾸밈은 속으로 못 들어간다(꽃은 지나간다) — 가까운 것만 본다 */
  update(f: Frame) {
    void f;
    const { player } = this.s;
    if (player.held) return;
    const p = player.p as THREE.Vector3;
    const reach = NEAR / S.R;
    const chord = chordOf(reach);
    this.grid.query(p, chord, this.near);
    for (const i of this.near) {
      const piece = this.pieces[i];
      if (piece.lift !== 0 || SOFT.has(piece.model)) continue;
      const girth = this.girthOf(piece);
      if (girth) player.blockShape(piece.v, piece.base, girth);
    }
  }

  /** 치운다(묶음은 모델 자리가 치운다) */
  dispose() {
    this.plate?.removeFromParent();
    for (const o of this.owned) o.dispose();
  }

  // 모델이 오면: 띠마다 굵기를 재고, 꽃은 줄기·잎·가운데를 흰색으로
  private measure(k: string, inst: Instancer) {
    const radii = new Array<number>(BANDS).fill(0);
    const pos = new THREE.Vector3();
    for (const im of inst.ims) {
      const at = im.geometry.getAttribute("position");
      for (let i = 0; i < at.count; i++) {
        pos.fromBufferAttribute(at, i);
        const level = pos.y * BANDS;
        const band = Math.floor(level);
        const top = BANDS - 1,
          low = Math.max(0, band);
        const slot = Math.min(top, low);
        const r = Math.hypot(pos.x, pos.z);
        if (r > radii[slot]) radii[slot] = r;
      }
    }
    this.unitGirth.set(k, radii);
    if (!RECOLOR.includes(k)) return;
    const white = this.s.map.garden?.flowerParts ?? 0xffffff;
    for (const im of inst.ims) whitenGreenYellow(im.material as THREE.MeshStandardMaterial, white);
  }

  // 한 꾸밈의 몸 굵기(높이 h 로 키운 것) — 모델이 오기 전에는 없다
  private girthOf(p: Piece): Girth | null {
    const unit = this.unitGirth.get(p.model);
    if (!unit) return null;
    const step = p.h / BANDS;
    const radii = unit.map((r) => r * p.h * GIRTH_SHARE);
    return { step, radii };
  }

  // 흰 접시: 납작한 원기둥 + 윗면 둘레 코발트 띠 + 옆면 코발트
  private buildPlate(v: THREE.Vector3, r: number): THREE.Group {
    const root = new THREE.Group();
    root.userData.v = v;
    const under = r * 0.97,
      half = PLATE.h / 2;
    const bodyGeo = new THREE.CylinderGeometry(r, under, PLATE.h, 96);
    bodyGeo.translate(0, half, 0);
    const white = new THREE.MeshStandardMaterial({ color: PLATE.white, roughness: 0.35 });
    const cobalt = new THREE.MeshStandardMaterial({ color: PLATE.cobalt, roughness: 0.4 });
    const body = new THREE.Mesh(bodyGeo, [cobalt, white, white]);
    const inner = r - PLATE.rim;
    const rimGeo = new THREE.RingGeometry(inner, r, 96);
    const flat = -Math.PI / 2,
      onTop = PLATE.h + 0.02;
    rimGeo.rotateX(flat);
    rimGeo.translate(0, onTop, 0);
    const rim = new THREE.Mesh(rimGeo, cobalt);
    root.add(body, rim);
    this.owned.push(bodyGeo, rimGeo, white, cobalt);
    this.s.scene.add(root);
    return root;
  }
}

/* ─── 내부 ─────────────────────────── */

const UP = new THREE.Vector3(0, 1, 0);
/** 모델 굵기에서 막는 몫(삐죽 나온 끝은 비켜 가게) */
const GIRTH_SHARE = 0.85;
