"use client";

import { useEffect, useRef, useState } from "react";

interface LoopVideoProps {
  webm: string;
  mp4: string;
  /** 화면 읽기용 설명 */
  label: string;
  /** 영상 대신 먼저 보일 그림(없으면 뒤에 깔린 그림이 보인다) */
  poster?: string;
  className: string;
  /** 멈춤·재생 버튼 이름(언어별). 끝없이 도는 영상은 멈출 수 있어야 한다(웹 접근성 2.2.2) */
  toggleLabels: { pause: string; play: string };
  /** 멈춤·재생 버튼 자리(부모가 relative). 누르는 칸은 44px */
  toggleClassName: string;
}

/**
 * 무음 반복 영상 — 첫 화면의 글·그림을 다 받은 뒤(load)에야 받기 시작하고, 화면에 들어왔을 때만 돈다.
 * autoplay 로 두면 HTML 을 읽자마자 수백 KB 를 받아 느린 폰에서 첫 그림(포스터)이 1초 넘게 늦었다.
 * 움직임 줄이기를 켠 사람에게는 돌리지 않는다(포스터 = 첫 프레임). 구석 버튼으로 누구나 멈추고 다시 틀 수 있다.
 */
export default function LoopVideo({
  webm,
  mp4,
  label,
  poster,
  className,
  toggleLabels,
  toggleClassName,
}: LoopVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  // poster 도 화면 근처에 와서야 단다 — video poster 는 lazy 가 없어 첫 화면 아래여도 바로 받는다
  const [isNear, setIsNear] = useState(false);
  // 버튼 모양은 실제로 돌고 있는지를 따른다(저전력 모드 등에서 재생이 막히면 '재생'으로 남는다)
  const [isPlaying, setIsPlaying] = useState(false);
  // 손님이 멈췄으면 화면에 다시 들어와도 저절로 돌리지 않는다
  const heldRef = useRef(false);

  useEffect(() => {
    const video = ref.current;
    if (!video || !poster) return;
    const near = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsNear(true);
          near.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    near.observe(video);
    return () => {
      near.disconnect();
    };
  }, [poster]);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      heldRef.current = true;
      return;
    }

    let observer: IntersectionObserver | null = null;
    const start = () => {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            if (!heldRef.current) video.play().catch(() => {});
          } else {
            video.pause();
          }
        },
        { rootMargin: "200px 0px" },
      );
      observer.observe(video);
    };

    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      observer?.disconnect();
    };
  }, []);

  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (isPlaying) {
      heldRef.current = true;
      video.pause();
    } else {
      heldRef.current = false;
      video.play().catch(() => {});
    }
  };

  return (
    <>
      <video
        ref={ref}
        muted
        loop
        playsInline
        preload="none"
        poster={isNear ? poster : undefined}
        aria-label={label}
        className={className}
        onPlay={() => {
          setIsPlaying(true);
        }}
        onPause={() => {
          setIsPlaying(false);
        }}
      >
        <source src={webm} type="video/webm" />
        <source src={mp4} type="video/mp4" />
      </video>
      {/* 작고 조용하게 — 보이는 동그라미는 30px, 누르는 칸은 44px */}
      <button
        type="button"
        onClick={toggle}
        aria-label={isPlaying ? toggleLabels.pause : toggleLabels.play}
        className={`group absolute flex size-[44px] cursor-pointer items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-ink ${toggleClassName}`}
      >
        <span className="flex size-[30px] items-center justify-center rounded-full bg-paper/80 text-ink shadow-[0_1px_6px_rgba(20,20,20,0.12)] backdrop-blur-sm transition-colors group-hover:bg-paper">
          {isPlaying ? (
            <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
              <rect x="0" y="0" width="3.2" height="12" rx="0.6" fill="currentColor" />
              <rect x="6.8" y="0" width="3.2" height="12" rx="0.6" fill="currentColor" />
            </svg>
          ) : (
            <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
              <path
                d="M1 0.8v10.4a.6.6 0 0 0 .9.5l7.8-5.2a.6.6 0 0 0 0-1L1.9.3A.6.6 0 0 0 1 .8Z"
                fill="currentColor"
              />
            </svg>
          )}
        </span>
      </button>
    </>
  );
}
