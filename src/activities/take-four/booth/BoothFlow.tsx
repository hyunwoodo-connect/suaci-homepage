"use client";

import { useRef, useState } from "react";

import type { EventDetail } from "@/types";

import { composePhotos, composeStrip, stripCaption } from "../strip/compose";
import type { StripCaption, StripFrame } from "../strip/compose";
import { saveLast } from "../strip/storage";
import BoothScreen from "./BoothScreen";
import PrintScreen from "./PrintScreen";
import ResultScreen from "./ResultScreen";

interface BoothFlowProps {
  event: EventDetail;
}

interface Print {
  frames: StripFrame[];
  caption: StripCaption;
  /** 합성 띠와 사진 기둥(완성 화면용). 둘 다 끝나야 받을 수 있다 */
  done: { strip: Blob; photos: Blob } | null;
  isFailed: boolean;
  isReceived: boolean;
}

/** `/events/{slug}/booth`. 촬영 → 현상(합성) → 완성. 다시 찍기는 촬영 준비 상태로. */
export default function BoothFlow({ event }: BoothFlowProps) {
  const [print, setPrint] = useState<Print | null>(null);
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

  if (!print) {
    return (
      <BoothScreen
        slug={event.slug}
        onDone={(frames) => develop(frames, stripCaption(event.phase, new Date()))}
      />
    );
  }

  if (print.isReceived && print.done) {
    return (
      <ResultScreen
        strip={print.done.strip}
        photos={print.done.photos}
        caption={print.caption}
        canEnter={event.switches.entry === true}
        onRetake={retake}
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
    />
  );
}
