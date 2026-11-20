// 존별 색 바꾸기 규칙(오너 2026-11-20 4번): 모델은 전부 메시 하나·텍스처 한 장이라, 일부 색만 바꾸려면 텍스처를 고친다.
// (원본 모델, 색 범위 → 바꿀 색) 규칙으로 변형 모델 <원본>@<존 id> 를 뽑는다 — 존 설정(game/zones/<id>.ts 의 objects.models)이 고른다.
// 통째 색조는 런타임 색 곱하기(존 설정 tint)로 한다. 이 파일은 의존 없는 순수 규칙(시험이 읽는다), 모델 읽고 쓰기는 recolor.mjs
// 새 규칙: 아래 RECOLOR 의 그 존 줄에 { model, swaps } 하나 → build.mjs(새 버전) 또는 variants.mjs(이미 만든 버전에 더하기)

/** 존 id → 그 존의 변형 규칙. swap: 색상 범위(도, sRGB)·채도 하한 → 바꿀 색(그림자를 남기려 원래 밝기를 조금 섞는다) */
export const RECOLOR = {
  // 간식 존: 꽃 줄기·잎(초록)과 꽃술(노랑) → 흰색 — 맵에 초록·노랑 없음(MAP-03 6장)
  candy: [
    { model: "flower_pink", swaps: [{ hue: [45, 170], minSat: 0.22, to: "#ffffff" }] },
    { model: "flower_blue", swaps: [{ hue: [45, 170], minSat: 0.22, to: "#ffffff" }] },
  ],
};

/** 변형 모델 키: 원본@존 */
export const variantKey = (model, zone) => `${model}@${zone}`;

/** 규칙 전체를 [변형 키, 원본 키, 바꾸기] 목록으로 */
export function variantList(rules = RECOLOR) {
  const out = [];
  for (const [zone, list] of Object.entries(rules))
    for (const { model, swaps } of list) out.push([variantKey(model, zone), model, swaps]);
  return out;
}

/** sRGB 0..255 → [색상 도, 채도 0..1, 밝기 0..1] */
export function hslOf(r, g, b) {
  const R = r / 255,
    G = g / 255,
    B = b / 255;
  const max = Math.max(R, G, B),
    min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return [h * 60, s, l];
}

/** "#rrggbb" → [r, g, b] */
export function rgbOf(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** RGBA 픽셀(Uint8 배열, channels 개씩)에 바꾸기를 적용한다. 바꾼 픽셀 수를 돌려준다 */
export function recolorPixels(data, channels, swaps) {
  const targets = swaps.map((sw) => ({ ...sw, rgb: rgbOf(sw.to) }));
  let changed = 0;
  for (let i = 0; i < data.length; i += channels) {
    const [h, s, l] = hslOf(data[i], data[i + 1], data[i + 2]);
    const hit = targets.find((t) => s >= t.minSat && h >= t.hue[0] && h <= t.hue[1]);
    if (!hit) continue;
    const shade = 0.82 + 0.18 * l;
    data[i] = Math.round(hit.rgb[0] * shade);
    data[i + 1] = Math.round(hit.rgb[1] * shade);
    data[i + 2] = Math.round(hit.rgb[2] * shade);
    changed++;
  }
  return changed;
}
