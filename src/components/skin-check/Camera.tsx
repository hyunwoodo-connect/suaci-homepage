"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface CameraProps {
  onCapture: (imageDataUrl: string) => void;
}

export default function Camera({ onCapture }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  useEffect(() => {
    let cancelled = false;

    async function initCamera() {
      try {
        // 기존 스트림 정리
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            if (!cancelled) setIsReady(true);
          };
        }
      } catch {
        if (!cancelled) {
          setError("카메라에 접근할 수 없습니다. 카메라 권한을 허용해주세요.");
        }
      }
    }

    initCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [facingMode]);

  const handleCapture = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 전면 카메라일 때 좌우 반전 보정
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    onCapture(dataUrl);
  }, [facingMode, onCapture]);

  const handleFlip = useCallback(() => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
    setIsReady(false);
  }, []);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onCapture(reader.result);
        }
      };
      reader.readAsDataURL(file);
    },
    [onCapture],
  );

  if (error) {
    return (
      <div className="flex flex-col items-center gap-6 py-12">
        <p className="text-center text-muted">{error}</p>
        <label className="cursor-pointer rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-80">
          갤러리에서 선택
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* 카메라 뷰파인더 */}
      <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`h-full w-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
        />

        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        )}

        {/* 가이드 오버레이 */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-56 w-44 rounded-[50%] border-2 border-white/30" />
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {/* 버튼 영역 */}
      <div className="flex items-center gap-6">
        {/* 갤러리 */}
        <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-border transition-colors hover:bg-foreground/5">
          <GalleryIcon />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>

        {/* 촬영 버튼 */}
        <button
          onClick={handleCapture}
          disabled={!isReady}
          className="flex h-18 w-18 items-center justify-center rounded-full border-4 border-foreground transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
          aria-label="촬영"
        >
          <div className="h-14 w-14 rounded-full bg-foreground" />
        </button>

        {/* 카메라 전환 */}
        <button
          onClick={handleFlip}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-border transition-colors hover:bg-foreground/5"
          aria-label="카메라 전환"
        >
          <FlipIcon />
        </button>
      </div>
    </div>
  );
}

/* ─── 아이콘 컴포넌트 ─────────────────────────── */

function GalleryIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

function FlipIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
      <path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5" />
      <path d="m15 3-3 3 3 3" />
      <path d="m9 21 3-3-3-3" />
    </svg>
  );
}
