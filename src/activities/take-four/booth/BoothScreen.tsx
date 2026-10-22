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
import { FILM_TONE_CSS } from "../strip/tone";
import { coverGuideRect } from "./crop";
import { PROMPTS, READY_PROMPT } from "../shots";
import { BOOTH_INITIAL, boothReducer, tickDelay } from "./boothMachine";
import { useCamera } from "./useCamera";

interface BoothScreenProps {
  slug: string;
  /** 넷째 찰칵이 끝나면 찍은 순서대로 넘긴다(바로 현상으로) */
  onDone: (frames: HTMLCanvasElement[]) => void;
}

/**
 * 부스 안. 들어오자마자 카메라를 켜고(권한도 이때 묻는다), 셔터 한 번이면 네 장을 자동으로 찍고 현상으로 넘어간다.
 * 타이머는 리듀서 상태를 따라가는 effect 한 곳에만 있다.
 */
export default function BoothScreen({ slug, onDone }: BoothScreenProps) {
  const [state, dispatch] = useReducer(boothReducer, BOOTH_INITIAL);
  // 찍은 장. 타이머 안에서 바로 읽고 넘겨서 화면에 안 그리니 state가 아니다
  const framesRef = useRef<HTMLCanvasElement[]>([]);
  // 안내선이 따라갈 영상 크기(폰을 돌리면 resize로 바뀐다)
  const [videoSize, setVideoSize] = useState<{ width: number; height: number } | null>(null);
  const { status, videoRef, start, stop, capture } = useCamera();
  // 타이머 effect가 부모 렌더마다 다시 걸리지 않게 마지막 onDone을 ref로 든다
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  const { step, shot, count } = state;
  const isShooting = step === "count" || step === "flash";
  const idx = Math.min(shot, 3);

  // 찍는 중 카메라가 끊기면(트랙 끝남·탭 숨김 — useCamera가 끈다) 처음으로 — 셔터가 다시 찍기가 된다.
  // 4번째 찰칵 뒤 끄는 stop은 done과 같은 렌더에 반영돼 여기 걸리지 않는다
  if (isShooting && status !== "on") {
    dispatch({ type: "reset" });
  }

  // 들어오면 바로 켠다. 탭을 숨겼다 오면 셔터가 다시 켠다
  useEffect(() => {
    void start();
  }, [start]);

  useEffect(() => {
    const delay = tickDelay(state);
    if (delay === null) return;
    const timer = setTimeout(() => {
      // 3·2·1이 끝나는 순간(흰 빛과 같이) 찍는다
      if (state.step === "count" && state.count === 1) {
        framesRef.current = [...framesRef.current.slice(0, state.shot), capture()];
      }
      dispatch({ type: "tick" });
      if (state.step === "flash" && state.shot === 3) {
        stop();
        onDoneRef.current(framesRef.current);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [state, capture, stop]);

  async function handlePress() {
    const isOn = await start();
    if (!isOn) return;
    framesRef.current = [];
    dispatch({ type: "start" });
  }

  function handleVideoSize(event: SyntheticEvent<HTMLVideoElement>) {
    const { videoWidth, videoHeight } = event.currentTarget;
    setVideoSize(videoWidth && videoHeight ? { width: videoWidth, height: videoHeight } : null);
  }

  function handleStop() {
    dispatch({ type: "reset" });
  }

  const isBlocked = status === "denied" || status === "unavailable";
  const isOn = status === "on";

  return (
    <Screen tone="cream" isCentered>
      <TopBar
        nav={
          isShooting
            ? { icon: "close", label: "멈추기", onClick: handleStop }
            : { icon: "back", label: "밖으로", href: `/events/${slug}` }
        }
        label={`${isShooting ? shot + 1 : 0} / 4`}
      />

      <div className="flex flex-col items-center gap-[16px] pt-[28px] text-center">
        <div aria-live="polite" className="text-[27px] leading-[1.3] font-bold tracking-[-0.01em]">
          {isShooting ? PROMPTS[idx] : READY_PROMPT}
        </div>
        <StepBar filled={isShooting ? idx + 1 : 0} size="sm" />
      </div>

      <div className="flex min-h-0 w-full flex-1 items-center justify-center">
        {/* 작은 폰(높이 700 이하)에선 액자를 줄여 셔터가 화면 안에 들어오게 한다 */}
        <div className="h-[400px] w-[300px] shrink-0 [@media(max-height:700px)]:h-[340px] [@media(max-height:700px)]:w-[255px]">
          <div className="origin-top-left [@media(max-height:700px)]:scale-[0.85]">
            <ScallopFrame>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                aria-hidden="true"
                onLoadedMetadata={handleVideoSize}
                onResize={handleVideoSize}
                style={{ filter: FILM_TONE_CSS }}
                className={`absolute inset-0 h-full w-full -scale-x-100 object-cover ${
                  isOn ? "" : "invisible"
                }`}
              />
              {isOn && step !== "flash" && videoSize ? (
                <SaveGuide videoWidth={videoSize.width} videoHeight={videoSize.height} />
              ) : null}
              {status === "starting" ? <Starting /> : null}
              {isBlocked ? <Blocked /> : null}
              {step === "flash" ? <Flash /> : null}
            </ScallopFrame>
          </div>
        </div>
      </div>

      {/* 시안은 아래 여백 32 — Screen(28)에 4를 더한다 */}
      <div className="mb-[4px] flex h-[112px] shrink-0 items-center justify-center">
        {isBlocked ? (
          <PillButton href={`/events/${slug}/no-camera`} size="sheet" width="fit">
            다른 방법 보기
          </PillButton>
        ) : isShooting ? (
          <Countdown count={step === "count" ? count : null} />
        ) : (
          <Shutter state={status === "starting" ? "starting" : "ready"} onPress={handlePress} />
        )}
      </div>
    </Screen>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

/** 권한 창을 기다리는 동안 창을 덮는다 */
function Starting() {
  return (
    <div
      role="status"
      className="absolute inset-0 flex flex-col items-center justify-center gap-[8px] bg-(--tf-cream) text-center"
    >
      <span className="text-[17px] font-bold">카메라 켜는 중</span>
      <span className="text-[14px]">&apos;허용&apos;을 눌러 주세요</span>
    </div>
  );
}

/** 카메라가 막혔을 때 창을 덮는다. 아래 `다른 방법 보기`가 길을 연다 */
function Blocked() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-(--tf-cream) text-center">
      <span className="text-[16px] font-bold">카메라가 막혀 있어요</span>
    </div>
  );
}

interface SaveGuideProps {
  videoWidth: number;
  videoHeight: number;
}

/**
 * 저장되는 정사각 자리를 창 위에 점선으로, 밖은 살짝 어둡게. capture()와 같은 자르기 계산.
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
