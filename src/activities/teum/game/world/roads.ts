import * as THREE from "three";

import type { LayoutRoad } from "../maps/layout";
import type { Services } from "../services";
import { S } from "../settings";
import { from } from "./sphere";

// 큰 길(기획 MAP-02 5장): 이웃한 랜드마크끼리 곧게 잇는 넓은 길(폭 8m), 그 지역 땅색보다 밝게.
// 자리표의 점(20m 간격)을 5m 마다로 잘게 나눠 땅 높이를 따라 띠를 깐다. 바다 위 구간은 깔지 않는다(징검 튜브 다리가 있다).
// 길 양옆 22m 는 비워 둔다(자리 차지) — 문에 서면 랜드마크가 정면에 보이게

/** 길 폭(m)·땅에서 띄우는 높이(m)·나누는 간격(m) · 양옆 비우는 거리(m) · 땅색에 흰빛을 섞는 몫 */
const ROAD = { width: 8, lift: 0.18, step: 5, clear: 22, whiten: 0.45 } as const;

const WHITE = new THREE.Color(0xffffff);

const side = new THREE.Vector3(),
  ahead = new THREE.Vector3(),
  tmp = new THREE.Vector3();

/** 큰 길 전체 */
export class Roads {
  private readonly mesh: THREE.Mesh | null = null;

  constructor(private readonly s: Services) {
    const roads = s.layout.road ?? [];
    if (roads.length === 0) return;
    const pos: number[] = [],
      col: number[] = [],
      idx: number[] = [];
    for (const road of roads) addStrip(s, road, pos, col, idx);
    const geo = new THREE.BufferGeometry();
    const position = new THREE.Float32BufferAttribute(pos, 3),
      colors = new THREE.Float32BufferAttribute(col, 3);
    geo.setAttribute("position", position);
    geo.setAttribute("color", colors);
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    s.scene.add(this.mesh);
  }

  /** 길 양옆을 비워 둔다(나무·기구·조형물·쉼터가 길을 막지 않게) */
  claim() {
    const { occ } = this.s;
    for (const road of this.s.layout.road ?? [])
      for (const [dist, bear] of road.points) {
        const v = from(dist, bear);
        occ.fill(v, ROAD.clear);
      }
  }

  /** 치운다 */
  dispose() {
    if (!this.mesh) return;
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/* ─── 내부 ─────────────────────────── */

// 길 하나를 띠로: 점 사이를 큰 원으로 잘게 나누고, 점마다 좌우 두 꼭짓점(땅 높이 + 조금)
function addStrip(s: Services, road: LayoutRoad, pos: number[], col: number[], idx: number[]) {
  const pts = densify(road);
  const seaSpots = (s.layout.sea ?? []).map((sea) => ({ v: from(sea.dist, sea.bear), r: sea.r }));
  const color = new THREE.Color();
  let prev = -1;
  for (let i = 0; i < pts.length; i++) {
    const v = pts[i];
    const isSea = seaSpots.some((sea) => sea.v.angleTo(v) * S.R < sea.r - 2);
    if (isSea) {
      prev = -1;
      continue;
    }
    const lastIndex = pts.length - 1,
      after = i + 1,
      before = i - 1;
    const nextAt = Math.min(lastIndex, after),
      lastAt = Math.max(0, before);
    const next = pts[nextAt],
      last = pts[lastAt];
    ahead.subVectors(next, last);
    side.crossVectors(v, ahead).normalize();
    const halfWidth = ROAD.width / 2;
    const base = pos.length / 3;
    for (const sign of [-1, 1]) {
      // 길 가장자리마다 그 자리 땅 높이 — 옆으로 기운 비탈에서도 한쪽이 언덕에 묻히지 않게
      const reach = sign * halfWidth;
      tmp.copy(v).multiplyScalar(S.R).addScaledVector(side, reach).normalize();
      const ground = s.terrain.groundAt(tmp);
      const radius = S.R + ground + ROAD.lift;
      tmp.multiplyScalar(radius);
      pos.push(tmp.x, tmp.y, tmp.z);
      // 지역이 길 색을 정했으면 그 색(MAP-03 정원의 테이블 러너), 아니면 땅 첫째 색에 흰빛을 섞는다
      const at = s.regions.of(v);
      const own = at.region.road;
      if (own === undefined) color.setHex(at.region.ground[0]).lerp(WHITE, ROAD.whiten);
      else color.setHex(own);
      col.push(color.r, color.g, color.b);
    }
    if (prev >= 0) {
      const prevR = prev + 1,
        baseR = base + 1;
      idx.push(prev, prevR, base, prevR, baseR, base);
    }
    prev = base;
  }
}

// 자리표 점(20m 간격)을 ROAD.step 마다의 단위 벡터로
function densify(road: LayoutRoad): THREE.Vector3[] {
  const corners = road.points.map(([dist, bear]) => from(dist, bear));
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < corners.length - 1; i++) {
    const a = corners[i],
      b = corners[i + 1];
    const length = a.angleTo(b) * S.R;
    const count = length / ROAD.step;
    const countUp = Math.ceil(count);
    const n = Math.max(1, countUp);
    for (let k = 0; k < n; k++) {
      const share = k / n;
      const p = a.clone().lerp(b, share).normalize();
      out.push(p);
    }
  }
  const lastCorner = corners[corners.length - 1];
  if (lastCorner) {
    const end = lastCorner.clone();
    out.push(end);
  }
  return out;
}
