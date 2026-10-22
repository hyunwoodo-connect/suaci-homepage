import type { CSSProperties } from "react";

/** take four. 색. 홈페이지 전역 테마(globals.css)와 섞지 않는다. */
export const TAKE_FOUR_COLORS = {
  lime: "#A8B45B", // 입구·이벤트·PC·벽 바탕
  cream: "#EFE3CF", // 촬영·앨범 바탕
  pale: "#D5E2A5", // 네컷 카드 바탕 = 현상·완성·크게 보기·스토리 바탕
  paper: "#FFFDF8", // 벽에 붙이기 시트
  red: "#E2453C", // 포인트 — 액자·핀
  ink: "#2B2420",
  dot: "#738136", // 워드마크 점
  camera: "#C9D6C0", // 카메라 화면이 비었을 때
  idle: "#B9ADA3", // 셔터 — 카메라 켜는 중
  busy: "#6B625B", // 비활성 잉크 버튼(보내는 중)
  error: "#B0332B", // 시트 안 실패 알림
  skeleton: "#D9CDB8", // 벽·크게 보기 불러오는 중 사진 칸
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
  "--tf-pale": TAKE_FOUR_COLORS.pale,
  "--tf-paper": TAKE_FOUR_COLORS.paper,
  "--tf-red": TAKE_FOUR_COLORS.red,
  "--tf-ink": TAKE_FOUR_COLORS.ink,
  "--tf-dot": TAKE_FOUR_COLORS.dot,
  "--tf-camera": TAKE_FOUR_COLORS.camera,
  "--tf-idle": TAKE_FOUR_COLORS.idle,
  "--tf-busy": TAKE_FOUR_COLORS.busy,
  "--tf-error": TAKE_FOUR_COLORS.error,
  "--tf-skeleton": TAKE_FOUR_COLORS.skeleton,
  "--tf-dim": "rgba(43, 36, 32, 0.45)", // 시트 뒤 어둡게
  "--tf-shade": "rgba(43, 36, 32, 0.25)", // 촬영 창에서 저장 안 되는 곳
  "--tf-empty": "rgba(43, 36, 32, 0.15)", // 입구 단계 바 빈 칸
  "--tf-track": "rgba(43, 36, 32, 0.12)", // 촬영 단계 바 빈 칸
  "--tf-latin": "var(--font-fraunces), serif",
  "--tf-korean": "var(--font-gowun-batang), serif",
} as CSSProperties;
