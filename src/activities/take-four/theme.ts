import type { CSSProperties } from "react";

/** take four. 색. 홈페이지 전역 테마(globals.css)와 섞지 않는다. */
export const TAKE_FOUR_COLORS = {
  lime: "#A8B45B", // 입구·이벤트·PC·벽 바탕
  cream: "#EFE3CF", // 촬영·앨범·현상·완성 바탕
  paper: "#FFFDF8", // 응모 시트
  red: "#E2453C", // 포인트 — 액자·띠 테두리·핀·도장
  ink: "#2B2420",
  dot: "#738136", // 워드마크 점
  camera: "#C9D6C0", // 카메라 화면이 비었을 때
  warming: "#C9A24A", // 셔터 — 카메라 켜는 중 테두리
  muted: "#8A7F76", // 셔터 — 카메라 켜는 중 바탕
  busy: "#6B625B", // 비활성 잉크 버튼(보내는 중)
  error: "#B0332B", // 시트 안 실패 알림
} as const;

/** 단계 바 네 칸(연한 → 진한). */
export const STEP_COLORS = ["#F4C9BC", "#EE9C88", "#E87158", "#E2453C"] as const;

/**
 * 부품이 읽는 CSS 변수. `Screen`이 화면 뿌리에 깐다.
 * 글꼴 변수(--font-fraunces, --font-gowun-batang)는 이벤트 레이아웃이 next/font로 단다.
 */
export const TAKE_FOUR_VARS = {
  "--tf-lime": TAKE_FOUR_COLORS.lime,
  "--tf-cream": TAKE_FOUR_COLORS.cream,
  "--tf-paper": TAKE_FOUR_COLORS.paper,
  "--tf-red": TAKE_FOUR_COLORS.red,
  "--tf-ink": TAKE_FOUR_COLORS.ink,
  "--tf-dot": TAKE_FOUR_COLORS.dot,
  "--tf-camera": TAKE_FOUR_COLORS.camera,
  "--tf-warming": TAKE_FOUR_COLORS.warming,
  "--tf-muted": TAKE_FOUR_COLORS.muted,
  "--tf-busy": TAKE_FOUR_COLORS.busy,
  "--tf-error": TAKE_FOUR_COLORS.error,
  "--tf-dim": "rgba(43, 36, 32, 0.45)", // 시트 뒤 어둡게
  "--tf-shade": "rgba(43, 36, 32, 0.25)", // 촬영 창에서 저장 안 되는 곳
  "--tf-empty": "rgba(43, 36, 32, 0.15)", // 단계 바 빈 칸
  "--tf-latin": "var(--font-fraunces), serif",
  "--tf-korean": "var(--font-gowun-batang), serif",
} as CSSProperties;
