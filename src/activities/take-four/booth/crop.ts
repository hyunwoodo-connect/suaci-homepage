import type { Rect } from "../strip/layout";

/** 영상 가운데에서 가장 큰 정사각형(카드 칸과 같은 비율) */
export function centerSquare(width: number, height: number): Rect {
  const side = Math.min(width, height);
  return {
    x: Math.round((width - side) / 2),
    y: Math.round((height - side) / 2),
    width: side,
    height: side,
  };
}

/**
 * 저장 영역(centerSquare)이 object-cover로 담긴 창 안에서 차지하는 자리.
 * 미리보기는 좌우 반전이지만 자르기가 가운데라 자리는 같다. 창 밖으로 넘칠 수 있다(가로 영상).
 */
export function coverGuideRect(
  videoWidth: number,
  videoHeight: number,
  boxWidth: number,
  boxHeight: number,
): Rect {
  const scale = Math.max(boxWidth / videoWidth, boxHeight / videoHeight);
  const offsetX = (boxWidth - videoWidth * scale) / 2;
  const offsetY = (boxHeight - videoHeight * scale) / 2;
  const crop = centerSquare(videoWidth, videoHeight);
  return {
    x: offsetX + crop.x * scale,
    y: offsetY + crop.y * scale,
    width: crop.width * scale,
    height: crop.height * scale,
  };
}
