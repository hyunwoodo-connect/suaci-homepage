interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 영상 가운데에서 가장 큰 가로 4:3 사각형(띠 칸(4:3)과 같은 비율) */
export function centerCrop43(videoWidth: number, videoHeight: number): CropRect {
  const isWide = videoWidth * 3 > videoHeight * 4;
  const width = isWide ? Math.round((videoHeight * 4) / 3) : videoWidth;
  const height = isWide ? videoHeight : Math.round((videoWidth * 3) / 4);
  return {
    x: Math.round((videoWidth - width) / 2),
    y: Math.round((videoHeight - height) / 2),
    width,
    height,
  };
}

/**
 * 저장 영역(centerCrop43)이 object-cover로 담긴 창 안에서 차지하는 자리.
 * 미리보기는 좌우 반전이지만 자르기가 가운데라 자리는 같다. 창 밖으로 넘칠 수 있다(가로 영상).
 */
export function coverGuideRect(
  videoWidth: number,
  videoHeight: number,
  boxWidth: number,
  boxHeight: number,
): CropRect {
  const scale = Math.max(boxWidth / videoWidth, boxHeight / videoHeight);
  const offsetX = (boxWidth - videoWidth * scale) / 2;
  const offsetY = (boxHeight - videoHeight * scale) / 2;
  const crop = centerCrop43(videoWidth, videoHeight);
  return {
    x: offsetX + crop.x * scale,
    y: offsetY + crop.y * scale,
    width: crop.width * scale,
    height: crop.height * scale,
  };
}
