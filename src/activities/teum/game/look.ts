import * as THREE from "three";

import { GREY_TOY, LIME } from "./settings";

// 톤: 초현실 팝(팝아트) 하나로 확정. 색 배합 — 바탕 = 코발트 하늘 + 진초록·연초록 체커 땅(광장 둘레는 분홍 체커) /
// 큰 덩어리(나무·꽃·랜드마크·구름) = 핫핑크와 흰색 / 탈 것 = 주황과 노랑 / 반응한 것과 고양이 = 라임.
// 시제품은 다 만든 뒤 한꺼번에 칠했지만(setLook), 톤이 하나로 정해져 각자 만들 때 이 값으로 칠한다

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

/** 확정된 톤의 색 배합 */
export const LOOK = Object.freeze({
  sat: 1.35,
  wash: 0,
  light: 2.0,
  sunI: 1.3,
  gA: 0x14803b,
  gB: 0x62cf4c,
  rim: 0x9db4f2,
  top: 0x002afd,
  puff: 0x14803b,
  glow: 0xe6ffa6,
  lake: 0x2f6fe6,
  bg: 0x7896ec,
  cloud: 0xff9ccb,
  /** 놀이기구 바탕색(반응하면 라임으로 넘어간다) */
  toy: {
    ring: 0xff5a1f,
    pillar: 0xffd21f,
    chime: 0xff5a1f,
    bumper: 0xff5a1f,
    cannon: 0xff5a1f,
    hole: 0xffd21f,
    sling: 0xff5a1f,
    swing: 0xff5a1f,
    funnel: 0xff5a1f,
    plank: 0xffd21f,
    ramp: 0xffd21f,
    rail: 0xff5a1f,
    whirl: 0xffd21f,
    seed: 0xffd21f,
    rocket: 0xff5a1f,
    comet: 0xffd21f,
  } satisfies Record<ToyKind, number>,
  /** 바닥 꽃·기류·바람길의 꽃잎 색 */
  fl: [0xff5fa2, 0xffffff, 0xff8fbd, 0xffffff],
  hop: 0xffd21f,
  pad: 0xffd21f,
  core: 0xffd21f,
  stem: 0x2e8f45,
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
  /** 아바타 옷(몸 재질만 쓴다) */
  outfit: OutfitUniforms;
}

/**
 * 아바타 옷(몸 셰이더가 옷 자리를 덮는 값): 윗옷·치마 무늬 그림과 입었는지(on), 무늬 크기(uPrS),
 * 치마·신발 단색과 칠했는지(on). 옷을 갈아입으면 이 값만 바뀌고 셰이더는 그대로다
 */
export interface OutfitUniforms {
  uPrT: { value: THREE.Texture };
  uPrB: { value: THREE.Texture };
  uPrTon: { value: number };
  uPrBon: { value: number };
  uPrS: { value: number };
  uSkC: { value: THREE.Color };
  uSkOn: { value: number };
  uShC: { value: THREE.Color };
  uShOn: { value: number };
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
    outfit: blankOutfit(),
  };

  constructor() {
    const toy = {} as Record<ToyKind, THREE.Color>;
    for (const [k, hex] of Object.entries(LOOK.toy)) toy[k as ToyKind] = new THREE.Color(hex);
    this.toy = toy;
  }

  /** 도형 재질: 팝 톤의 매끈한 광택 */
  grey(c: number = GREY_TOY): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color: c, roughness: LOOK.toyRough, metalness: 0 });
  }

  /** 기둥·받침처럼 반응하지 않는 부분(흰색) */
  pole(): THREE.MeshStandardMaterial {
    return this.grey(0xffffff);
  }

  /** 땅처럼 보송한 재질(반사 없음) */
  matte(c: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: c,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0,
    });
  }
}

/* ─── 내부 ─────────────────────────── */

// 아무 옷도 덮지 않은 값. 무늬 자리는 흰 점 하나(그림이 오기 전에도 셰이더가 읽을 것이 있게)
function blankOutfit(): OutfitUniforms {
  const pixel = new Uint8Array([255, 255, 255, 255]),
    white = new THREE.DataTexture(pixel, 1, 1);
  white.needsUpdate = true;
  return {
    uPrT: { value: white },
    uPrB: { value: white },
    uPrTon: { value: 0 },
    uPrBon: { value: 0 },
    uPrS: { value: 1.5 },
    uSkC: { value: new THREE.Color(0xffffff) },
    uSkOn: { value: 0 },
    uShC: { value: new THREE.Color(0xffffff) },
    uShOn: { value: 0 },
  };
}
