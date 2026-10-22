"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import type { SyntheticEvent } from "react";

import Countdown from "../parts/Countdown";
import Flash from "../parts/Flash";
import PillButton from "../parts/PillButton";
import ScallopFrame, { FRAME_WINDOW } from "../parts/ScallopFrame";
import Screen from "../parts/Screen";
import Shutter from "../parts/Shutter";
import StepBar from "../parts/StepBar";
import TopBar from "../parts/TopBar";
import { coverGuideRect } from "./crop";
import { PROMPTS, SHOT_NAMES } from "../shots";
import { BOOTH_INITIAL, boothReducer, tickDelay } from "./boothMachine";
import { useCamera } from "./useCamera";

interface BoothScreenProps {
  slug: string;
  /** 네 장을 다 찍고 `인화하기`를 누르면 찍은 순서대로 넘긴다 */
  onDone: (frames: HTMLCanvasElement[]) => void;
}

const BEATS = ["3", "2", "1", "찰칵"] as const;

/**
 * 부스 안. 들어오자마자 카메라를 켜고(권한도 이때 묻는다), 찰칵 한 번이면 네 장을 자동으로 찍는다.
 * 타이머는 리듀서 상태를 따라가는 effect 한 곳에만 있다.
 */
export default function BoothScreen({ slug, onDone }: BoothScreenProps) {
  const [state, dispatch] = useReducer(boothReducer, BOOTH_INITIAL);
  const [frames, setFrames] = useState<HTMLCanvasElement[]>([]);
  // 안내선이 따라갈 영상 크기(폰을 돌리면 resize로 바뀐다)
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null);
  const { status, videoRef, start, stop, capture } = useCamera();

  const { step, shot, count } = state;
  const isShooting = step === "count" || step === "flash";
  const isDone = step === "done";
  const idx = Math.min(shot, 3);

  // 찍는 중 카메라가 끊기면(트랙 끝남·탭 숨김 — useCamera가 끈다) 처음으로 — 셔터가 다시 찍기가 된다.
  // 4번째 찰칵 뒤 끄는 stop은 done과 같은 렌더에 반영돼 여기 걸리지 않는다
  if (isShooting && status !== "on") {
    dispatch({ type: "reset" });
    setFrames([]);
  }

  // 들어오면 바로 켠다. 탭을 숨겼다 오거나 다 찍어서 꺼진 뒤엔 찰칵이 다시 켠다
  useEffect(() => {
    void start();
  }, [start]);

  useEffect(() => {
    const delay = tickDelay(state);
    if (delay === null) return;
    const timer = setTimeout(() => {
      // 3·2·1이 끝나는 순간(흰 빛과 같이) 찍는다
      if (state.step === "count" && state.count === 1) {
        const frame = capture();
        setFrames((prev) => [...prev.slice(0, state.shot), frame]);
      }
      // 다 찍었으면 카메라 불을 끈다
      if (state.step === "flash" && state.shot === 3) stop();
      dispatch({ type: "tick" });
    }, delay);
    return () => clearTimeout(timer);
  }, [state, capture, stop]);

  async function handlePress() {
    const isOn = await start();
    if (!isOn) return;
    setFrames([]);
    dispatch({ type: "start" });
  }

  function handleVideoSize(event: SyntheticEvent<HTMLVideoElement>) {
    const { videoWidth, videoHeight } = event.currentTarget;
    setVideoSize(videoWidth && videoHeight ? { width: videoWidth, height: videoHeight } : null);
  }

  function handleStop() {
    dispatch({ type: "reset" });
    setFrames([]);
  }

  const isBlocked = (status === "denied" || status === "unavailable") && !isDone;
  const shotLabel = isDone ? 4 : shot + (step === "ready" ? 0 : 1);

  return (
    <Screen tone="cream" isCentered>
      <TopBar
        nav={
          isShooting
            ? { icon: "close", label: "멈추기", onClick: handleStop }
            : { icon: "back", label: "밖으로", href: `/events/${slug}` }
        }
        label={`${shotLabel} / 4`}
      />

      <div className="min-h-[64px] pt-[10px] pb-[6px] text-center">
        <div className="text-[14px]">{isDone ? "" : `${idx + 1} / 4`}</div>
        <div aria-live="polite" className="text-[25px] leading-[1.3] font-bold">
          {isDone ? "take suaci." : PROMPTS[idx]}
        </div>
        <div className="pt-[8px]">
          <StepBar filled={isDone ? 4 : idx + 1} active={isShooting ? idx : undefined} size="sm" />
        </div>
      </div>

      {/* 작은 폰(높이 740 이하)에선 액자를 줄여 셔터가 화면 안에 들어오게 한다 */}
      <div className="h-[400px] w-[300px] shrink-0 [@media(max-height:740px)]:h-[340px] [@media(max-height:740px)]:w-[255px]">
        <div className="origin-top-left [@media(max-height:740px)]:scale-[0.85]">
          <ScallopFrame label={isShooting ? `카메라 화면: ${SHOT_NAMES[idx]}` : "카메라 화면"}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              aria-hidden="true"
              onLoadedMetadata={handleVideoSize}
              onResize={handleVideoSize}
              className={`absolute inset-0 h-full w-full -scale-x-100 object-cover ${
                status === "on" && !isDone ? "" : "invisible"
              }`}
            />
            {status === "on" && !isDone && step !== "flash" && videoSize ? (
              <SaveGuide videoWidth={videoSize.width} videoHeight={videoSize.height} />
            ) : null}
            {isDone && frames[3] ? <FramePreview frame={frames[3]} /> : null}
            {status === "starting" ? <Starting /> : null}
            <Countdown value={step === "count" ? count : null} />
            {step === "flash" ? <Flash /> : null}
          </ScallopFrame>
        </div>
      </div>

      {isShooting ? <Beats at={step === "flash" ? 3 : 3 - count} /> : null}

      <div className="flex-1" />

      {isBlocked ? (
        <div className="flex w-full flex-col gap-[8px]">
          <p className="m-0 text-center text-[15px]">카메라가 막혀 있어요.</p>
          <PillButton href={`/events/${slug}/no-camera`}>다른 방법 보기</PillButton>
        </div>
      ) : isDone ? (
        <PillButton onClick={() => onDone(frames)}>다 찍었어요. 인화하기</PillButton>
      ) : (
        <Shutter
          state={status === "starting" ? "starting" : isShooting ? "running" : "ready"}
          onPress={handlePress}
        />
      )}
    </Screen>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

/** 권한 창을 기다리는 동안 창을 덮는다 */
function Starting() {
  return (
    <div
      role="status"
      className="absolute inset-0 flex flex-col items-center justify-center gap-[10px] bg-(--tf-cream) text-center"
    >
      <div aria-hidden="true" className="flex gap-[8px]">
        <span className="size-[10px] rounded-full bg-(--tf-ink)" />
        <span className="size-[10px] rounded-full bg-(--tf-ink) opacity-60" />
        <span className="size-[10px] rounded-full bg-(--tf-ink) opacity-30" />
      </div>
      <span className="text-[17px] font-bold">카메라 켜는 중</span>
      <span className="text-[14px] leading-[1.5]">&apos;허용&apos;을 눌러 주세요</span>
    </div>
  );
}

interface SaveGuideProps {
  videoWidth: number;
  videoHeight: number;
}

/**
 * 저장되는 가로 4:3 자리를 창 위에 점선으로, 밖은 살짝 어둡게. capture()와 같은 자르기 계산.
 * 가로 영상이면 자리가 창보다 넓어 선이 창 밖에 있다(보이는 곳이 다 저장된다).
 */
function SaveGuide({ videoWidth, videoHeight }: SaveGuideProps) {
  const rect = coverGuideRect(videoWidth, videoHeight, FRAME_WINDOW.width, FRAME_WINDOW.height);
  return (
    <div
      aria-hidden="true"
      data-testid="save-guide"
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
      className="pointer-events-none absolute box-border rounded-[10px] border-[1.5px] border-dashed border-(color:--tf-cream)/70 shadow-[0_0_0_400px_var(--tf-shade)]"
    />
  );
}

interface BeatsProps {
  /** 지금 박자(0: 3 … 3: 찰칵) */
  at: number;
}

/** 시안 Shot의 `3 2 1 찰칵` 줄. 지난 박자는 흐리게, 지금 박자는 굵게. */
function Beats({ at }: BeatsProps) {
  return (
    <div
      aria-hidden="true"
      className="flex gap-[14px] pt-[14px] font-(family-name:--tf-latin) text-[18px]"
    >
      {BEATS.map((beat, k) => (
        <span
          key={beat}
          className={
            k === at ? "font-bold" : k < at ? "font-normal opacity-35" : "font-normal opacity-60"
          }
        >
          {beat}
        </span>
      ))}
    </div>
  );
}

interface FramePreviewProps {
  frame: HTMLCanvasElement;
}

/** 다 찍은 뒤 창에 마지막 장을 남긴다(카메라는 꺼진다). 찍힌 그대로라 다시 뒤집지 않는다 */
function FramePreview({ frame }: FramePreviewProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = frame.width;
    canvas.height = frame.height;
    canvas.getContext("2d")?.drawImage(frame, 0, 0);
  }, [frame]);
  return (
    <canvas ref={ref} aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
  );
}
