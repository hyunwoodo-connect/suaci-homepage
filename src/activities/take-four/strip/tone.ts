/**
 * 시안 촬영 화면의 사진 톤. 미리보기는 CSS filter로, 저장 카드는 같은 계산을 픽셀에 직접 한다 —
 * 사파리 canvas엔 `ctx.filter`가 없어서다. 순서는 CSS와 같다(채도 → 대비 → 밝기, sRGB).
 */
export const FILM_TONE = { saturate: 0.9, contrast: 0.94, brightness: 1.04 } as const;

/** 미리보기 `<video>`에 거는 CSS filter */
export const FILM_TONE_CSS = `saturate(${FILM_TONE.saturate}) contrast(${FILM_TONE.contrast}) brightness(${FILM_TONE.brightness})`;

/** RGBA 픽셀(ImageData.data)에 톤을 그 자리에서 건다. 알파는 그대로. */
export function applyFilmTone(pixels: Uint8ClampedArray): void {
  const { saturate: s, contrast: c, brightness: b } = FILM_TONE;
  // CSS saturate() 행렬(Filter Effects 명세)
  const m = [
    [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
    [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
  ];
  const tone = (v: number) => ((v - 127.5) * c + 127.5) * b;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const bl = pixels[i + 2];
    // CSS는 단계마다 자르지만 여기선 끝에 한 번(Uint8ClampedArray) — saturate ≤ 1이면 중간값이 0~255라 같다
    pixels[i] = tone(m[0][0] * r + m[0][1] * g + m[0][2] * bl);
    pixels[i + 1] = tone(m[1][0] * r + m[1][1] * g + m[1][2] * bl);
    pixels[i + 2] = tone(m[2][0] * r + m[2][1] * g + m[2][2] * bl);
  }
}
