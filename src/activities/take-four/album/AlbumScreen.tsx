"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";

import DashedPill from "../parts/DashedPill";
import PillButton from "../parts/PillButton";
import Screen from "../parts/Screen";
import TopBar from "../parts/TopBar";
import { SHOT_INDEXES, SHOT_NAMES } from "../shots";
import { loadAlbumFrame } from "./albumFrame";

interface AlbumScreenProps {
  slug: string;
  /** 네 장을 다 고르고 `인화하기` — 현상·완성으로 */
  onDone: (frames: HTMLCanvasElement[]) => void;
  /** 완성 화면에서 `다시 고르기`로 돌아왔을 때 고른 네 장(한 장만 바꿀 수 있게) */
  initialFrames?: HTMLCanvasElement[];
}

interface Slot {
  frame: HTMLCanvasElement;
  preview: string;
}

const DECODE_ERROR = "이 사진은 열 수 없어요. 다른 사진을 골라 주세요.";

/**
 * `/events/{slug}/album`. 시안 Album 그대로 — 칸 넷(무표정·살짝 미소·방긋·박장대소)을 눌러 사진을 고르고,
 * 찬 칸을 누르면 바꾼다. 네 장이 차면 `인화하기`.
 */
export default function AlbumScreen({ slug, onDone, initialFrames }: AlbumScreenProps) {
  const [slots, setSlots] = useState<(Slot | null)[]>(() =>
    SHOT_INDEXES.map((i) => {
      const frame = initialFrames?.[i];
      return frame ? { frame, preview: frameUrl(frame) } : null;
    }),
  );
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const targetRef = useRef(0);
  const shownRef = useRef(slots);

  // 바뀌어 빠진 사진의 캔버스(960×960) 메모리를 돌려준다
  useEffect(() => {
    for (const old of shownRef.current) {
      if (old && !slots.includes(old)) {
        old.frame.width = 0;
        old.frame.height = 0;
      }
    }
    shownRef.current = slots;
  }, [slots]);

  const filled = slots.filter(Boolean).length;
  const isReady = filled === 4 && busy === null;

  function handlePick(index: number) {
    // 여는 중엔 버튼을 disabled로 바꾸지 않는다 — 포커스가 버튼에 남게
    if (busy !== null) return;
    targetRef.current = index;
    inputRef.current?.click();
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    // 같은 사진을 다시 골라도 change가 오게 비운다
    event.currentTarget.value = "";
    if (!file) return;
    const index = targetRef.current;
    setBusy(index);
    setError(null);
    try {
      const frame = await loadAlbumFrame(file);
      const slot = { frame, preview: frameUrl(frame) };
      setSlots((prev) => prev.map((old, i) => (i === index ? slot : old)));
    } catch {
      // HEIC를 못 푸는 브라우저·깨진 파일(AlbumDecodeError) — 칸은 그대로 두고 다른 사진을 고르게 한다
      setError(DECODE_ERROR);
    } finally {
      setBusy(null);
    }
  }

  function handleDone() {
    const frames = slots.flatMap((slot) => (slot ? [slot.frame] : []));
    if (frames.length === 4) onDone(frames);
  }

  return (
    <Screen tone="cream">
      <TopBar
        nav={{ icon: "back", label: "뒤로", href: `/events/${slug}/no-camera` }}
        label={`${filled} / 4`}
      />

      <div className="pt-[16px] pb-[22px] text-center">
        <h1 className="m-0 text-[22px] font-bold">넉 장 골라 주세요</h1>
        <p className="m-0 mt-[6px] text-[15px]">칸을 누르면 앨범이 열려요.</p>
      </div>

      <div className="grid grid-cols-2 gap-x-[10px] gap-y-[12px] border-4 border-solid border-(color:--tf-red) bg-(--tf-paper) p-[12px]">
        {SHOT_NAMES.map((name, i) => {
          const slot = slots[i];
          return (
            <div key={name} className="flex flex-col gap-[6px]">
              <button
                type="button"
                onClick={() => handlePick(i)}
                aria-disabled={busy !== null}
                aria-busy={busy === i}
                aria-label={`${name} ${slot ? "사진 바꾸기" : "칸에 사진 넣기"}`}
                className={`relative flex h-[112px] w-full cursor-pointer items-center justify-center overflow-hidden bg-white p-0 outline-offset-2 focus-visible:outline-[3px] focus-visible:outline-(--tf-ink) aria-disabled:cursor-default ${
                  slot ? "border-0" : "border-2 border-dashed border-(color:--tf-ink)"
                }`}
              >
                {slot ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 폰에서 방금 자른 data: URL이라 next/image 최적화 대상이 아니다
                  <img
                    src={slot.preview}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
                {busy === i ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-(--tf-cream)/70 text-[13px]">
                    여는 중…
                  </span>
                ) : slot ? null : (
                  <PlusIcon />
                )}
              </button>
              <span className="text-center text-[13px]">{name}</span>
            </div>
          );
        })}
      </div>

      <p role="alert" className="m-0 min-h-[44px] pt-[12px] text-center text-[14px] leading-[1.5]">
        {error}
      </p>

      <div className="flex-1" />

      {isReady ? (
        <PillButton onClick={handleDone}>인화하기</PillButton>
      ) : (
        <DashedPill>{`${4 - filled}장 더`}</DashedPill>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
    </Screen>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function PlusIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className="text-(color:--tf-ink)"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/* ─── 내부 ─────────────────────────── */

function frameUrl(frame: HTMLCanvasElement): string {
  return frame.toDataURL("image/jpeg", 0.85);
}
