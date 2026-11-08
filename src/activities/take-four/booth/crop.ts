import { CELL_ASPECT } from "../strip/layout";
import type { Rect } from "../strip/layout";

/** 가운데에서 가장 큰 aspect(폭/높이) 사각형. 기본은 카드 칸 비율 */
export function centerCrop(width: number, height: number, aspect: number = CELL_ASPECT): Rect {
  const widthAtFullHeight = height * aspect;
  const heightAtFullWidth = width / aspect;
  const isWide = width > widthAtFullHeight;
  const cropWidth = isWide ? Math.round(widthAtFullHeight) : width;
  const cropHeight = isWide ? height : Math.round(heightAtFullWidth);
  const marginX = (width - cropWidth) / 2;
  const marginY = (height - cropHeight) / 2;
  return {
    x: Math.round(marginX),
    y: Math.round(marginY),
    width: cropWidth,
    height: cropHeight,
  };
}

/**
 * 저장 영역(centerCrop)이 object-cover로 담긴 창 안에서 차지하는 자리.
 * 미리보기는 좌우 반전이지만 자르기가 가운데라 자리는 같다. 창 밖으로 넘칠 수 있다(가로 영상).
 */
export function coverGuideRect(
  videoWidth: number,
  videoHeight: number,
  boxWidth: number,
  boxHeight: number,
): Rect {
  const scaleToWidth = boxWidth / videoWidth;
  const scaleToHeight = boxHeight / videoHeight;
  const scale = Math.max(scaleToWidth, scaleToHeight);
  const offsetX = (boxWidth - videoWidth * scale) / 2;
  const offsetY = (boxHeight - videoHeight * scale) / 2;
  const crop = centerCrop(videoWidth, videoHeight);
  return {
    x: offsetX + crop.x * scale,
    y: offsetY + crop.y * scale,
    width: crop.width * scale,
    height: crop.height * scale,
  };
}
