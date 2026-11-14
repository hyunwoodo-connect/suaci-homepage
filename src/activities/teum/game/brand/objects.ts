import * as THREE from "three";

import type { Thing } from "../core/frame";
import type { Hold } from "../models/library";
import type { Services } from "../services";
import { from } from "../world/sphere";

// suaci 프로모션 오브젝트(로고·제품) 자리. 풍경·조형물과 섞지 않고 여기만 본다.
// 브랜드 표현이라 모양은 실제 파일 기준으로 만든 에셋(분류표 'brand')만 쓰고, 무엇을 어디에 둘지는 오너가 정한다.
// 늘릴 때: 에셋을 brand 분류로 빌드 → 아래 목록에 한 줄. 배치 목록에 들어가 언덕·풍경·생물이 그 자리를 피한다

/** 브랜드 오브젝트 하나의 자리 */
export interface BrandPlacement {
  /** manifest 에셋 키(분류 brand) */
  key: string;
  /** 출발점에서 거리(넓이 S.wide 배)와 방향(도) — 자리표(layout.json)와 같은 기준 */
  dist: number;
  bear: number;
  /** 크기와 그 크기를 재는 쪽(h 키, w 너비) */
  size: number;
  by: "h" | "w";
  /** 땅에서 띄우는 높이 */
  lift?: number;
}

/** 놓을 브랜드 오브젝트 — 오너가 정하면 채운다 */
export const BRAND_PLACEMENTS: readonly BrandPlacement[] = [];

/** 배치 목록(장소)에 자리를 맡기는 창구 — 자리(그룹)는 장소 배치가 행성 위에 놓는다 */
interface ItemRegistry {
  addItem(obj: THREE.Object3D, at: () => THREE.Vector3, lift: number): unknown;
}

/** 브랜드 오브젝트들. 놓기만 하고 움직이지 않는다 */
export class BrandObjects implements Thing {
  readonly holds: Hold[] = [];
  private readonly groups: THREE.Group[] = [];

  /** placements 에서 manifest 에 없는 것은 건너뛴다(모델이 오면 그 자리에 선다) */
  constructor(
    s: Services,
    places: ItemRegistry,
    placements: readonly BrandPlacement[] = BRAND_PLACEMENTS,
  ) {
    for (const b of placements) {
      if (!s.models.has(b.key)) continue;
      // 자리(그룹)는 장소 배치가 행성 위에 놓고, 모델 틀은 그 안에서 바닥을 땅에 붙인다
      const gr = new THREE.Group();
      const m = s.models.fit(b.key, b.size, b.by);
      m.position.y = m.userData.hh;
      gr.add(m);
      const lift = b.lift ?? 0;
      places.addItem(gr, () => from(b.dist, b.bear), lift);
      this.holds.push(m);
      this.groups.push(gr);
    }
  }

  /** 움직이지 않는다 */
  update() {}

  /** 치운다(모델 재질은 키마다 같이 쓰는 것이라 두고 간다) */
  dispose() {
    for (const gr of this.groups) gr.removeFromParent();
  }
}
