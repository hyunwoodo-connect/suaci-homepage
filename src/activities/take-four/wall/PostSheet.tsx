"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { isRateLimited } from "@/lib/api";

import BottomSheet from "../parts/BottomSheet";
import PillButton from "../parts/PillButton";
import TextLink from "../parts/TextLink";
import { useGuardedAction } from "../useGuardedAction";
import { postStrip } from "./postStrip";

interface PostSheetProps {
  /** 완성 화면의 사진 기둥 */
  photos: Blob;
  /** 벽 주소(`/events/{slug}/wall`)에 쓴다 */
  slug: string;
}

/** `벽에 붙이기` → 시트에서 확인 → 올리고 벽으로. 실패하면 시트에 남아 `다시 보내기`. */
export default function PostSheet({ photos, slug }: PostSheetProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "posting" | "failed" | "limited">("idle");
  const { run, isRunning } = useGuardedAction();

  function handlePost() {
    return run(async () => {
      setStatus("posting");
      try {
        const { id } = await postStrip(photos);
        // 넘어가는 동안에도 `보내는 중…`으로 잠가 둔다
        router.push(`/events/${slug}/wall?posted=${encodeURIComponent(id)}`);
      } catch (err) {
        // 하루 한도(기기당 10장)는 다시 보내도 안 되니 버튼 없이 알리기만
        setStatus(isRateLimited(err) ? "limited" : "failed");
      }
    });
  }

  function handleClose() {
    // 보내는 중엔 닫지 않는다 — 닫아도 업로드는 이어져 벽으로 넘어가 버린다
    if (isRunning() || status === "posting") return;
    setIsOpen(false);
  }

  return (
    <>
      <PillButton onClick={() => setIsOpen(true)}>벽에 붙이기</PillButton>
      <BottomSheet isOpen={isOpen} onClose={handleClose} label="벽에 붙이기" tone="paper">
        <h2 className="m-0 text-[22px] font-bold">벽에 붙일까요?</h2>
        <p className="m-0 text-[15px] leading-[1.5]">누구나 볼 수 있어요. 언제든 뗄 수 있어요.</p>
        {status === "failed" ? (
          <p role="alert" className="m-0 text-[14px] font-bold text-(color:--tf-error)">
            연결이 끊겼어요. 네컷은 폰에 그대로 있어요.
          </p>
        ) : null}
        {status === "limited" ? (
          <p role="alert" className="m-0 text-[14px] font-bold text-(color:--tf-error)">
            오늘은 여기까지 붙일 수 있어요. 내일 또 붙여 주세요.
          </p>
        ) : (
          <PillButton size="sheet" onClick={handlePost} disabled={status === "posting"}>
            {status === "posting" ? "보내는 중…" : status === "failed" ? "다시 보내기" : "붙이기"}
          </PillButton>
        )}
        <TextLink onClick={handleClose} isUnderlined={false} disabled={status === "posting"}>
          아니요
        </TextLink>
      </BottomSheet>
    </>
  );
}
