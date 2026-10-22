"use client";

import { useRef, useState } from "react";

import type { EventDetail } from "@/types";

import { composePhotos, composeStrip, stripCaption } from "../strip/compose";
import type { StripCaption, StripFrame } from "../strip/compose";
import { saveLast } from "../strip/storage";
import { storyLink } from "../story/composeStory";
import AlbumScreen from "../album/AlbumScreen";
import BoothScreen from "./BoothScreen";
import PrintScreen from "./PrintScreen";
import ResultScreen from "./ResultScreen";

interface BoothFlowProps {
  event: EventDetail;
  /** 네 장을 어디서 받나 — 카메라 촬영(부스) 또는 앨범에서 고르기 */
  source?: "camera" | "album";
}

interface Print {
  frames: StripFrame[];
  caption: StripCaption;
  /** 합성 띠와 사진 기둥(완성 화면용). 둘 다 끝나야 받을 수 있다 */
  done: { strip: Blob; photos: Blob } | null;
  isFailed: boolean;
  isReceived: boolean;
}

/**
 * `/events/{slug}/booth`·`/album`. 촬영(또는 앨범 넉 장) → 현상(합성) → 완성.
 * 다시 찍기는 촬영 준비 상태로, 앨범이면 고른 네 장을 든 채 앨범으로(한 장만 바꿀 수 있게).
 */
export default function BoothFlow({ event, source = "camera" }: BoothFlowProps) {
  const [print, setPrint] = useState<Print | null>(null);
  const [albumFrames, setAlbumFrames] = useState<HTMLCanvasElement[] | undefined>(undefined);
  // 다시 찍은 뒤 늦게 끝난 이전 합성이 덮어쓰지 않게 차례를 센다
  const runRef = useRef(0);

  function develop(frames: StripFrame[], caption: StripCaption) {
    const run = ++runRef.current;
    setPrint({ frames, caption, done: null, isFailed: false, isReceived: false });
    Promise.all([composeStrip(frames, caption), composePhotos(frames)])
      .then(([strip, photos]) => {
        if (run !== runRef.current) return;
        setPrint((prev) => (prev ? { ...prev, done: { strip, photos } } : prev));
        void saveLast(strip, photos, caption);
      })
      .catch(() => {
        if (run !== runRef.current) return;
        setPrint((prev) => (prev ? { ...prev, isFailed: true } : prev));
      });
  }

  function retake() {
    runRef.current += 1;
    setPrint(null);
  }

  const startCaption = () => stripCaption(event.phase, new Date());
  const retakeLabel = source === "album" ? "다시 고르기" : undefined;

  if (!print && source === "album") {
    return (
      <AlbumScreen
        slug={event.slug}
        initialFrames={albumFrames}
        onDone={(frames) => {
          setAlbumFrames(frames);
          develop(frames, startCaption());
        }}
      />
    );
  }

  if (!print) {
    return <BoothScreen slug={event.slug} onDone={(frames) => develop(frames, startCaption())} />;
  }

  if (print.isReceived && print.done) {
    return (
      <ResultScreen
        strip={print.done.strip}
        photos={print.done.photos}
        caption={print.caption}
        canEnter={event.switches.entry === true}
        storyLink={storyLink(event.slug)}
        onRetake={retake}
        retakeLabel={retakeLabel}
      />
    );
  }

  return (
    <PrintScreen
      frames={print.frames}
      caption={print.caption}
      status={print.isFailed ? "failed" : print.done ? "ready" : "composing"}
      onReceive={() => setPrint((prev) => (prev ? { ...prev, isReceived: true } : prev))}
      onRetry={() => develop(print.frames, print.caption)}
      onRetake={retake}
      retakeLabel={retakeLabel}
    />
  );
}
