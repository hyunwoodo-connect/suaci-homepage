"use client";

import { useState, useEffect, useCallback } from "react";

interface UseCarouselOptions {
  /** 전체 슬라이드 수 */
  totalSlides: number;
  /** 자동 전환 간격 (ms) — 0이면 자동 전환 비활성화 */
  interval?: number;
}

/**
 * 캐러셀(슬라이더) 상태 관리 훅
 *
 * @example
 * const { current, goTo, next, prev } = useCarousel({
 *   totalSlides: slides.length,
 *   interval: 5000,
 * });
 */
export function useCarousel({ totalSlides, interval = 0 }: UseCarouselOptions) {
  const [current, setCurrent] = useState(0);

  /** 특정 슬라이드로 이동 */
  const goTo = useCallback(
    (index: number) => setCurrent(index % totalSlides),
    [totalSlides],
  );

  /** 다음 슬라이드 */
  const next = useCallback(
    () => setCurrent((prev) => (prev + 1) % totalSlides),
    [totalSlides],
  );

  /** 이전 슬라이드 */
  const prev = useCallback(
    () => setCurrent((prev) => (prev - 1 + totalSlides) % totalSlides),
    [totalSlides],
  );

  // 자동 전환
  useEffect(() => {
    if (interval <= 0) return;

    const timer = setInterval(next, interval);
    return () => clearInterval(timer);
  }, [interval, next]);

  return { current, goTo, next, prev } as const;
}
