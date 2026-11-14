import * as THREE from "three";

import { fit, hasModel } from "../models";
import type { Hold } from "../models";
import type { Game } from "../state";
import { place } from "../world/places";
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

/** 브랜드 오브젝트를 배치 목록에 넣는다(모델이 오면 그 자리에 선다). manifest 에 없는 것은 건너뛴다 */
export function placeBrand(
  g: Game,
  placements: readonly BrandPlacement[] = BRAND_PLACEMENTS,
): Hold[] {
  const holds: Hold[] = [];
  for (const b of placements) {
    if (!hasModel(g, b.key)) continue;
    // 자리(그룹)는 layout 이 행성 위에 놓고, 모델 틀은 그 안에서 바닥을 땅에 붙인다
    const gr = new THREE.Group(),
      m = fit(g, b.key, b.size, b.by);
    m.position.y = m.userData.hh;
    gr.add(m);
    place(g, gr, () => from(b.dist, b.bear), b.lift ?? 0);
    holds.push(m);
  }
  return holds;
}
