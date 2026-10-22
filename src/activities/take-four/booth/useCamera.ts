"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/** idle: 꺼짐 / starting: 권한 묻는 중 / on: 켜짐 / denied: 거절 / unavailable: 장치·API 없음 */
export type CameraStatus = "idle" | "starting" | "on" | "denied" | "unavailable";

interface Camera {
  status: CameraStatus;
  /** 미리보기 `<video>`. 화면 쪽이 `playsInline`·`muted`로 그리고 좌우 반전한다 */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** 사용자 탭 안에서만 부른다(iOS Safari). 켜지면 true */
  start(): Promise<boolean>;
  stop(): void;
  /** 지금 화면을 가운데 4:3로 잘라, 미리보기처럼 좌우 반전한 그대로 그린다 */
  capture(): HTMLCanvasElement;
}

const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
};

/** 비디오가 아직 크기를 모를 때 찍히는 빈 장의 크기 */
const FALLBACK_SIZE = { width: 640, height: 480 } as const;

/** 전면 카메라. 언마운트·탭 숨김에서 트랙을 끈다. */
export function useCamera(): Camera {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // start가 기다리는 동안 stop·언마운트되면 그 결과를 버리려고 시도 번호를 센다
  const attemptRef = useRef(0);
  const [status, setStatus] = useState<CameraStatus>("idle");

  const release = useCallback(() => {
    attemptRef.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stop = useCallback(() => {
    release();
    setStatus((s) => (s === "denied" || s === "unavailable" ? s : "idle"));
  }, [release]);

  const start = useCallback(async () => {
    if (streamRef.current) return true;
    // 인앱 브라우저·http에는 mediaDevices가 없다
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("unavailable");
      return false;
    }
    attemptRef.current += 1;
    const attempt = attemptRef.current;
    setStatus("starting");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
    } catch (err) {
      if (attempt === attemptRef.current) setStatus(errorStatus(err));
      return false;
    }
    if (attempt !== attemptRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return false;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        // muted·playsInline이라 막히지 않는다. 막혀도 autoPlay가 다시 튼다
      }
    }
    if (attempt !== attemptRef.current) return false;
    setStatus("on");
    return true;
  }, []);

  const capture = useCallback(() => {
    const canvas = document.createElement("canvas");
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      canvas.width = FALLBACK_SIZE.width;
      canvas.height = FALLBACK_SIZE.height;
      return canvas;
    }
    const crop = centerCrop43(video.videoWidth, video.videoHeight);
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return canvas;
    // 전면 카메라는 미리보기(거울)와 같은 모양으로 남긴다
    ctx.translate(crop.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    return canvas;
  }, []);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "hidden") stop();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      release();
    };
  }, [stop, release]);

  return { status, videoRef, start, stop, capture };
}

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 영상 가운데에서 가장 큰 가로 4:3 사각형(띠 칸 480×360과 같은 비율) */
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

function errorStatus(err: unknown): CameraStatus {
  const name =
    typeof err === "object" && err !== null && "name" in err && typeof err.name === "string"
      ? err.name
      : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  // NotFoundError·OverconstrainedError·NotReadableError(다른 앱이 쓰는 중) 등은 모두 못 씀
  return "unavailable";
}
