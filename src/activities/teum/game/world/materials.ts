import * as THREE from "three";

import { GREY_TOY, LIME } from "../state";

/** 놀이기구 종류(색을 따로 두는 갈래) */
export type ToyKind =
  | "ring"
  | "pillar"
  | "chime"
  | "bumper"
  | "cannon"
  | "hole"
  | "sling"
  | "swing"
  | "funnel"
  | "plank"
  | "ramp"
  | "rail"
  | "whirl"
  | "seed"
  | "rocket"
  | "comet";

const TOY_KINDS: readonly ToyKind[] = [
  "ring",
  "pillar",
  "chime",
  "bumper",
  "cannon",
  "hole",
  "sling",
  "swing",
  "funnel",
  "plank",
  "ramp",
  "rail",
  "whirl",
  "seed",
  "rocket",
  "comet",
];

/** 코드로 만든 도형의 재질 메시 */
export type GreyMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

/** 한 판이 같이 바꾸는 재질 모음(톤을 바꿀 때 한꺼번에 손본다) */
export interface Mats {
  /** 코드로 만든 도형의 재질(톤에 따라 광택을 바꾼다) */
  greys: THREE.MeshStandardMaterial[];
  /** 기둥·받침처럼 반응하지 않는 부분 */
  poles: THREE.MeshStandardMaterial[];
  /** 에셋 모델의 재질 */
  models: THREE.MeshStandardMaterial[];
  /** 놀이기구 종류마다의 바탕색(컬러 블로킹). 반응하면 여기서 라임으로 넘어간다 */
  toy: Record<ToyKind, THREE.Color>;
  /** 반응한 것의 라임 */
  lime: THREE.Color;
}

/** 재질 모음을 새로 만든다 */
export function createMats(): Mats {
  const toy = {} as Record<ToyKind, THREE.Color>;
  for (const k of TOY_KINDS) toy[k] = new THREE.Color(GREY_TOY);
  return { greys: [], poles: [], models: [], toy, lime: new THREE.Color(LIME) };
}

/** 도형 재질 하나(모음에 넣어 둔다) */
export function grey(mats: Mats, c: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: c, roughness: 1, metalness: 0 });
  mats.greys.push(m);
  return m;
}
