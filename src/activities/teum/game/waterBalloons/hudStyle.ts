// 물풍선 놀이 화면이 같이 쓰는 색과 움직임 설정(개수 알약·화살표·핀·성공 판)

/** 먹색(글자·테두리) · 키컬러 · 흰 바탕 */
export const INK = "#2b2e2d",
  LIME = "#a9ff39",
  PAPER = "rgba(255,255,255,.95)";

/** 움직임 줄이기를 켠 기기인가 — 알약·성공 판이 튀지 않고 바로 바뀌고, 끝 장면의 라임 물결도 퍼지지 않고 바로 다 물든다 */
export const REDUCED_MOTION =
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
