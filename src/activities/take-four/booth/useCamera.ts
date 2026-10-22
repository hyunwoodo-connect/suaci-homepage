"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import { centerCrop } from "./crop";

/** idle: 꺼짐 / starting: 권한 묻는 중 / on: 켜짐 / denied: 거절 / unavailable: 장치·API 없음 */
export type CameraStatus = "idle" | "starting" | "on" | "denied" | "unavailable";

interface Camera {
  status: CameraStatus;
  /** 미리보기 `<video>`. 화면 쪽이 `playsInline`·`muted`로 그리고 좌우 반전한다 */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** 켜지면 true. 이미 켜져 있으면 바로 true */
  start(): Promise<boolean>;
  stop(): void;
  /** 지금 화면을 가운데 칸 비율로 잘라, 미리보기처럼 좌우 반전한 그대로 그린다 */
  capture(): HTMLCanvasElement;
}

const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
};

/** 재생 뒤 영상 크기를 기다리는 한도 */
const SIZE_TIMEOUT_MS = 3000;

/** 비디오가 크기를 모를 때 찍히는 빈 장(start가 막으니 안전망일 뿐) */
const FALLBACK_SIZE = { width: 640, height: 640 } as const;

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
    // 다른 앱이 카메라를 가져가거나 iOS가 끊으면 트랙이 스스로 끝난다
    stream.getTracks().forEach((track) =>
      track.addEventListener("ended", () => {
        if (streamRef.current === stream) stop();
      }),
    );

    const video = videoRef.current;
    let hasSize = false;
    if (video) {
      video.muted = true;
      video.srcObject = stream;
      try {
        await video.play();
        hasSize = await waitForSize(video, SIZE_TIMEOUT_MS);
      } catch {
        // 재생이 막히면 찍을 수 없다 — 아래에서 못 씀으로 끝낸다
      }
    }
    if (attempt !== attemptRef.current) return false;
    // 크기를 모르는 영상으로는 찍을 수 없다(빈 장이 된다)
    if (!hasSize) {
      release();
      setStatus("unavailable");
      return false;
    }
    setStatus("on");
    return true;
  }, [release, stop]);

  const capture = useCallback(() => {
    const canvas = document.createElement("canvas");
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      canvas.width = FALLBACK_SIZE.width;
      canvas.height = FALLBACK_SIZE.height;
      return canvas;
    }
    const crop = centerCrop(video.videoWidth, video.videoHeight);
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

/** 영상 크기가 정해질 때까지(loadedmetadata) 기다린다. 한도를 넘기면 false */
function waitForSize(video: HTMLVideoElement, timeoutMs: number): Promise<boolean> {
  if (video.videoWidth > 0) return Promise.resolve(true);
  return new Promise((resolve) => {
    function finish() {
      clearTimeout(timer);
      video.removeEventListener("loadedmetadata", finish);
      resolve(video.videoWidth > 0);
    }
    const timer = setTimeout(finish, timeoutMs);
    video.addEventListener("loadedmetadata", finish);
  });
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
