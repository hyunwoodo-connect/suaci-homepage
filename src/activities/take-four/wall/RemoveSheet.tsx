"use client";

import { useState } from "react";

import { isNotFound } from "@/lib/api";

import BottomSheet from "../parts/BottomSheet";
import PillButton from "../parts/PillButton";
import TextLink from "../parts/TextLink";
import { useGuardedAction } from "../useGuardedAction";
import { wallApi } from "./api";
import type { StripView } from "./api";

interface RemoveSheetProps {
  /** 뗄 네컷. null이면 닫힘 */
  strip: StripView | null;
  /** 이벤트 내용의 보조 문구(`벽에서만 내려요.` 뒤) */
  note: string | undefined;
  onClose: () => void;
  onRemoved: (id: string) => void;
}

/** 벽의 `뗄까요?` 시트. 이미 없는 네컷(404)이면 뗀 것으로 친다. */
export default function RemoveSheet({ strip, note, onClose, onRemoved }: RemoveSheetProps) {
  const [status, setStatus] = useState<"idle" | "removing" | "failed">("idle");
  const { run, isRunning } = useGuardedAction();

  function handleRemove() {
    if (!strip) return Promise.resolve();
    return run(async () => {
      setStatus("removing");
      try {
        await wallApi.remove(strip.id);
        setStatus("idle");
        onRemoved(strip.id);
      } catch (err) {
        if (isNotFound(err)) {
          setStatus("idle");
          onRemoved(strip.id);
        } else {
          setStatus("failed");
        }
      }
    });
  }

  function handleClose() {
    if (isRunning()) return;
    setStatus("idle");
    onClose();
  }

  return (
    <BottomSheet isOpen={strip !== null} onClose={handleClose} label="내 네컷 떼기">
      <h2 className="m-0 text-[22px] font-bold">뗄까요?</h2>
      <p className="m-0 text-[15px] leading-[1.6]">
        {note ? `벽에서만 내려요. ${note}` : "벽에서만 내려요."}
      </p>
      {status === "failed" ? (
        <p role="alert" className="m-0 text-[14px] font-bold text-(color:--tf-error)">
          연결이 끊겼어요. 다시 눌러 주세요.
        </p>
      ) : null}
      <PillButton size="sheet" onClick={handleRemove} disabled={status === "removing"}>
        {status === "removing" ? "떼는 중…" : "떼기"}
      </PillButton>
      <TextLink onClick={handleClose} isUnderlined={false} disabled={status === "removing"}>
        그냥 둘게요
      </TextLink>
    </BottomSheet>
  );
}
