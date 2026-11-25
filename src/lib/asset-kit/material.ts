import type * as THREE from "three";

// 받은 모델의 재질을 팝 톤으로 칠할 때 놀이와 아바타가 같이 쓰는 것: 안 쓰는 그림 비우기, 키컬러(라임 #A9FF39) 지키기

/** 톤이 쓰지 않는 그림 */
const UNUSED_MAPS = ["metalnessMap", "roughnessMap", "normalMap"] as const;

/**
 * 키컬러 지키기: 라임인 면은 장면의 조명을 받지 않는다 — 조명이 더해지면 초록 채널이 먼저 차서 라임이 누렇게 뜬다.
 * 제 색에 완만한 음영(아래쪽·가장자리만 조금 어둡게, 제 색보다 밝아지지 않는다)만 얹는다. opaque_fragment 앞에 넣는다
 */
export const KEY_HOLD_GLSL = `
  { float khOn = smoothstep(0.12, 0.35, diffuseColor.g - max(diffuseColor.r * 0.75, diffuseColor.b)) * smoothstep(0.45, 0.8, diffuseColor.g);
    float khRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.4);
    float khShade = (0.84 + 0.16 * smoothstep(-0.7, 0.5, normal.y)) * (1.0 - 0.14 * khRim);
    outgoingLight = mix(outgoingLight, diffuseColor.rgb * khShade, khOn); }`;

/**
 * 금속·거칠기·요철 그림을 떼고 비운다: 톤이 광택을 정하고, 요철 그림은 넣어도 화면에서 구별되지 않는데 모델마다 한 장씩 GPU 에 올라가고
 * 조각마다 셈이 든다. 풀어 낸 그림은 모델마다 두 장(1~4MB 씩)이라 놓기만 하지 않고 바로 비운다 — 폰은 메모리가 차면 끊긴다
 */
export function dropUnusedMaps(mat: THREE.MeshStandardMaterial) {
  for (const unused of UNUSED_MAPS) dropMap(mat, unused);
}

/* ─── 내부 ─────────────────────────── */

// 재질에서 그림 하나를 떼고 비운다(풀어 낸 비트맵도 닫는다 — 같은 그림을 금속·거칠기가 같이 써도 두 번 비워서 탈 날 것은 없다)
function dropMap(mat: THREE.MeshStandardMaterial, key: (typeof UNUSED_MAPS)[number]) {
  const tex = mat[key];
  if (!tex) return;
  mat[key] = null;
  // 남겨 쓰는 칸(색·그늘·빛·투명)이 같은 그림을 가리키면 떼기만 한다(그늘을 금속·거칠기 그림에 같이 담는 에셋이 올 수 있다)
  const kept = [mat.map, mat.aoMap, mat.emissiveMap, mat.alphaMap];
  if (kept.includes(tex)) return;
  tex.dispose();
  const image: unknown = tex.image;
  if (typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap) image.close();
}
