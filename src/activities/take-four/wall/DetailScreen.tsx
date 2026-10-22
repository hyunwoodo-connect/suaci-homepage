"use client";

import { useEffect, useState } from "react";

import { isNotFound, isRateLimited } from "@/lib/api";
import type { EventDetail } from "@/types";

import BottomSheet from "../parts/BottomSheet";
import PillButton from "../parts/PillButton";
import RibbonButton from "../parts/RibbonButton";
import Screen from "../parts/Screen";
import Strip from "../parts/Strip";
import TextLink from "../parts/TextLink";
import TopBar from "../parts/TopBar";
import { useGuardedAction } from "../useGuardedAction";
import { wallApi } from "./api";
import type { StripView } from "./api";
import { rememberHidden } from "./deviceMarks";
import { wallCaption } from "./caption";
import { useRibbon } from "./useRibbon";

interface DetailScreenProps {
  event: EventDetail;
  /** 경로 `/events/{slug}/wall/{stripId}`의 네컷 id */
  stripId: string;
}

/**
 * `/events/{slug}/wall/{stripId}`. 시안 Detail — 원본 사진으로 큰 띠, 리본, 신고.
 * 없거나 가려졌으면(신고·관리자) 벽에 없다고만 알린다.
 */
export default function DetailScreen({ event, stripId }: DetailScreenProps) {
  const wallHref = `/events/${event.slug}/wall`;
  /** 받는 중 undefined, 벽에 없으면 null */
  const [strip, setStrip] = useState<StripView | null | undefined>(undefined);

  useEffect(() => {
    let isCancelled = false;
    wallApi
      .get(stripId)
      .then((found) => {
        if (!isCancelled) setStrip(found);
      })
      .catch(() => {
        if (!isCancelled) setStrip(null);
      });
    return () => {
      isCancelled = true;
    };
  }, [stripId]);

  if (strip === null) {
    return (
      <Screen tone="lime">
        <TopBar nav={{ icon: "close", label: "닫기", href: wallHref }} />
        <div className="flex flex-1 flex-col items-center justify-center gap-[24px] text-center">
          <p className="m-0 text-[20px] font-bold">이 네컷은 벽에 없어요</p>
        </div>
        <PillButton href={wallHref}>벽으로</PillButton>
      </Screen>
    );
  }

  const caption = strip ? wallCaption(strip) : null;

  return (
    <Screen tone="lime">
      <TopBar nav={{ icon: "close", label: "닫기", href: wallHref }} label={caption?.number} />

      {/* 띠는 남은 높이만 차지하고 작은 폰에선 줄인다(완성 화면과 같은 방식, 시안은 390×844) */}
      <div className="relative min-h-[200px] flex-1">
        <div className="absolute inset-0 flex items-center justify-center [@media(max-height:660px)]:scale-[0.66] [@media(min-height:661px)_and_(max-height:700px)]:scale-[0.74] [@media(min-height:701px)_and_(max-height:780px)]:scale-[0.86]">
          <Strip
            size="lg"
            src={strip?.photoUrl}
            alt="다른 사람들의 네컷"
            number={caption?.number ?? ""}
            meta={caption?.meta ?? ""}
            stamp={caption?.stamp}
            hasPin
          />
        </div>
      </div>

      <div className="flex min-h-[122px] flex-col items-center gap-[6px] pt-[16px]">
        {strip ? <Actions strip={strip} wallHref={wallHref} /> : null}
      </div>
    </Screen>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface ActionsProps {
  strip: StripView;
  wallHref: string;
}

type ReportStatus = "closed" | "ask" | "sending" | "failed" | "limited" | "sent";

/** 리본 + `신고` → 확인 시트 → 감사 시트. 이미 내려간 네컷(404)도 감사로 끝낸다. */
function Actions({ strip, wallHref }: ActionsProps) {
  const ribbon = useRibbon(strip);
  const [report, setReport] = useState<ReportStatus>("closed");
  const { run, isRunning } = useGuardedAction();

  function handleReport() {
    return run(async () => {
      setReport("sending");
      try {
        await wallApi.report(strip.stripId);
        rememberHidden(strip.stripId);
        setReport("sent");
      } catch (err) {
        if (isNotFound(err)) {
          rememberHidden(strip.stripId);
          setReport("sent");
        } else {
          setReport(isRateLimited(err) ? "limited" : "failed");
        }
      }
    });
  }

  function handleClose() {
    // 보내는 중엔 닫지 않고, 보낸 뒤엔 이 네컷이 벽에서 내려가 `벽으로`로만 나간다
    if (isRunning() || report === "sent") return;
    setReport("closed");
  }

  return (
    <>
      <RibbonButton size="lg" count={ribbon.count} isOn={ribbon.isOn} onClick={ribbon.give} />
      <TextLink size={13} onClick={() => setReport("ask")}>
        신고
      </TextLink>

      <BottomSheet isOpen={report !== "closed"} onClose={handleClose} label="신고">
        {report === "sent" ? (
          <>
            <h2 className="m-0 text-[22px] font-bold">알려 줘서 고마워요</h2>
            <p className="m-0 text-[15px] leading-[1.6]">
              확인하는 동안 이 네컷은 벽에서 가려 둘게요.
            </p>
            <PillButton size="sheet" href={wallHref}>
              벽으로
            </PillButton>
          </>
        ) : (
          <>
            <h2 className="m-0 text-[22px] font-bold">이 네컷을 신고할까요?</h2>
            <p className="m-0 text-[15px] leading-[1.6]">
              본인이 아닌 사람, 불쾌한 사진이면 알려 주세요. 확인하고 내릴게요.
            </p>
            {report === "failed" || report === "limited" ? (
              <p role="alert" className="m-0 text-[14px] font-bold text-(color:--tf-error)">
                {report === "limited"
                  ? "오늘은 더 신고할 수 없어요. 내일 다시 알려 주세요."
                  : "연결이 끊겼어요. 다시 눌러 주세요."}
              </p>
            ) : null}
            <PillButton
              size="sheet"
              onClick={handleReport}
              disabled={report === "sending" || report === "limited"}
            >
              {report === "sending" ? "보내는 중…" : "신고하기"}
            </PillButton>
            <TextLink onClick={handleClose} isUnderlined={false} disabled={report === "sending"}>
              취소
            </TextLink>
          </>
        )}
      </BottomSheet>
    </>
  );
}
