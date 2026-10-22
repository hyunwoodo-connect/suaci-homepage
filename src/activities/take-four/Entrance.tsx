import type { EntranceProps } from "..";

import Desktop from "./Desktop";
import InAppNotice from "./InAppNotice";
import GirlsIllustration from "./parts/GirlsIllustration";
import NoteSticker from "./parts/NoteSticker";
import PillButton from "./parts/PillButton";
import ResumeCard from "./ResumeCard";
import Screen from "./parts/Screen";
import StepBar from "./parts/StepBar";
import TextLink from "./parts/TextLink";
import TitleMark from "./parts/TitleMark";
import TopBar from "./parts/TopBar";
import Wordmark from "./parts/Wordmark";
import { detectEnv, isDesktopUa } from "./env";
import { getTakeFourContent } from "./eventContent";
import { isStageOn } from "./stage";

/**
 * 입구. 설명 없이 제목·두 소녀·`커튼 열기` 하나.
 * 놀이는 상설이라 이벤트가 끝나도 그대로 열고, 회차 쪽지만 마감 뒤엔 뗀다(인화해 보내 주는 건 이벤트 기간 약속).
 * 회차 이름·쪽지 문구는 이벤트 내용(`getTakeFourContent`)에서 — 없으면 회차 표시·쪽지 없이 연다.
 */
export default function Entrance({ event, userAgent, url }: EntranceProps) {
  const base = `/events/${event.slug}`;
  const content = getTakeFourContent(event.eventId);
  // 시안 머리 라벨은 소문자(`no.01`)
  const barLabel = content?.label.toLowerCase();
  if (isDesktopUa(userAgent)) return <Desktop slug={event.slug} url={url} label={barLabel} />;

  const env = detectEnv(userAgent);

  return (
    <Screen tone="lime">
      <TopBar start={<Wordmark />} label={barLabel} />

      <div className="pt-[18px] text-center">
        <TitleMark />
        <div className="pt-[10px]">
          <StepBar filled={4} />
        </div>
      </div>

      {/* 그림은 남은 높이에 맞춰 줄어든다(작은 폰에서도 버튼이 화면 안에) */}
      <div className="relative min-h-[160px] flex-1">
        {content && event.phase !== "ended" ? (
          <NoteSticker
            href={`${base}/info`}
            title={content.label}
            className="absolute top-[26px] -right-[6px]"
          >
            {content.note}
          </NoteSticker>
        ) : null}
        <div className="absolute inset-x-0 top-[8px] bottom-[18px] flex items-end justify-center">
          <GirlsIllustration className="h-full max-h-[410px]" />
        </div>
      </div>

      <div className="flex flex-col gap-[12px]">
        <ResumeCard href={`${base}/result`} />
        {env.inApp ? (
          <InAppNotice env={env} url={url} albumHref={`${base}/album`} />
        ) : (
          <PillButton href={`${base}/booth`}>커튼 열기</PillButton>
        )}
        {isStageOn(event, "wall") ? (
          <TextLink href={`${base}/wall`}>다른 사람들 네컷 보기</TextLink>
        ) : null}
      </div>
    </Screen>
  );
}
