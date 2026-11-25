import * as THREE from "three";

import type { OutfitUniforms } from "@/lib/avatar/outfit-shader";
import { blankOutfit } from "@/lib/avatar/outfit-shader";

import type { FloodUniform } from "./keyColor";
import { FLOOD_OFF, keyify } from "./keyColor";
import { GREY_TOY, LIME } from "./settings";

// 톤: 키컬러(라임 #A9FF39)가 주인공인 초현실 팝. 판이 끝난 뒤 머리에 남는 색이 라임이게 한다 — 규칙 넷:
// ① 혼자 둔다: 라임 둘레 색(노랑·초록·청록)은 세상에 쓰지 않는다. 비슷한 것들 사이에서 혼자 다른 하나가 기억에 남는다
// ② 아껴 쓴다: 라임은 수아시의 것에만 — 물풍선 · 내가 건드려 반응한 것 · 로고 · 고양이
// ③ 맞은편에 바탕을 깐다: 세상은 라임의 맞은편 색(분홍·보라·파랑)과 흰색. 탈 것만 주황·귤색이다
// ④ 제 색 그대로 보인다: 라임인 면은 조명에 밀려 누렇게 뜨지 않게 칠하고, 판의 끝에는 온 섬이 라임으로 물든다
//    (마지막 장면이 기억에 남는다) — 이 둘의 셰이더 조각은 keyColor.ts 에 있다.
// 색 배합 — 바탕 = 코발트 하늘 + 마을마다 분홍·보라·파랑 체커 땅(마을 사이는 옅은 보랏빛) / 큰 덩어리(나무·꽃·랜드마크·구름) = 그 마을의 색과 흰색 /
// 탈 것 = 주황과 귤색 / 수아시의 것 = 라임.
// 톤이 하나로 정해져 있어 다 만든 뒤 한꺼번에 칠하지 않고, 각자 만들 때 이 값으로 칠한다

/** 놀이기구 종류(색을 따로 두는 갈래) */
type ToyKind =
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

/** 확정된 톤의 색 배합 */
export const LOOK = Object.freeze({
  sat: 1.35,
  wash: 0,
  light: 2.0,
  sunI: 1.3,
  gA: 0x6a5cf0,
  gB: 0xc4c2ff,
  rim: 0x9db4f2,
  top: 0x002afd,
  glow: 0xe6ffa6,
  lake: 0x2f6fe6,
  bg: 0x7896ec,
  cloud: 0xff9ccb,
  /** 놀이기구 바탕색(반응하면 라임으로 넘어간다) */
  toy: {
    ring: 0xff5a1f,
    pillar: 0xff8a2b,
    chime: 0xff5a1f,
    bumper: 0xff5a1f,
    cannon: 0xff5a1f,
    hole: 0xff8a2b,
    sling: 0xff5a1f,
    swing: 0xff5a1f,
    funnel: 0xff5a1f,
    plank: 0xff8a2b,
    ramp: 0xff8a2b,
    rail: 0xff5a1f,
    whirl: 0xff8a2b,
    seed: 0xff8a2b,
    rocket: 0xff5a1f,
    comet: 0xff8a2b,
  } satisfies Record<ToyKind, number>,
  /** 바닥 꽃·기류·바람길의 꽃잎 색 */
  fl: [0xff5fa2, 0xffffff, 0xff8fbd, 0xffffff],
  pad: 0xff8a2b,
  core: 0xff8a2b,
  stem: 0xf4f0ff,
  /** 팝 톤의 광택: 놀이기구·모델은 풍선처럼 매끈, 땅은 보송 */
  toyRough: 0.2,
  modelRough: 0.32,
});

/** 모델 재질이 같이 쓰는 톤 값(채도·바램) */
export interface LookUniforms {
  sat: { value: number };
  wash: { value: number };
  /** 지역: 마을 중심들(지역 차례) · 물건 색상을 돌리는 각(라디안) · 테두리(코사인 from, width) */
  regionHub: { value: THREE.Vector3[] };
  regionHue: { value: number[] };
  regionEdge: { value: THREE.Vector2 };
  /** 끝 장면의 라임 물결(keyColor.ts) */
  flood: FloodUniform;
  /** 아바타 옷(몸 재질만 쓴다) */
  outfit: OutfitUniforms;
}

/** 코드로 만든 도형의 재질 메시 */
export type GreyMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;

/** 재질 만드는 곳: 놀이기구 바탕색, 반응한 라임, 톤 값 */
export class Mats {
  readonly toy: Record<ToyKind, THREE.Color>;
  readonly lime = new THREE.Color(LIME);
  readonly lookU: LookUniforms = {
    sat: { value: LOOK.sat },
    wash: { value: LOOK.wash },
    regionHub: { value: [] },
    regionHue: { value: [] },
    regionEdge: { value: new THREE.Vector2(0.78, 0.12) },
    flood: { value: new THREE.Vector4(0, 1, 0, FLOOD_OFF) },
    outfit: blankOutfit(),
  };

  constructor() {
    const toy = {} as Record<ToyKind, THREE.Color>;
    for (const [k, hex] of Object.entries(LOOK.toy)) toy[k as ToyKind] = new THREE.Color(hex);
    this.toy = toy;
  }

  /** 도형 재질: 팝 톤의 매끈한 광택 */
  grey(c: number = GREY_TOY): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color: c,
      roughness: LOOK.toyRough,
      metalness: 0,
    });
    keyify(mat, this.lookU.flood);
    return mat;
  }

  /** 기둥·받침처럼 반응하지 않는 부분(흰색) */
  pole(): THREE.MeshStandardMaterial {
    return this.grey(0xffffff);
  }

  /** 땅처럼 보송한 재질(반사 없음) */
  matte(c: number): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({
      color: c,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0,
    });
    keyify(mat, this.lookU.flood);
    return mat;
  }
}
