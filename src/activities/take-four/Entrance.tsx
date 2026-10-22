import type { EntranceProps } from "..";

import Desktop from "./Desktop";
import InAppNotice from "./InAppNotice";
import GirlsIllustration from "./parts/GirlsIllustration";
import NoteSticker from "./parts/NoteSticker";
import PillButton from "./parts/PillButton";
import Screen from "./parts/Screen";
import StepBar from "./parts/StepBar";
import TextLink from "./parts/TextLink";
import TitleMark from "./parts/TitleMark";
import TopBar from "./parts/TopBar";
import Wordmark from "./parts/Wordmark";
import { detectEnv, isDesktopUa } from "./env";

/**
 * 입구. 설명 없이 제목·두 소녀·`커튼 열기` 하나.
 * 놀이는 상설이라 이벤트가 끝나도 그대로 열고, No.01 쪽지만 마감 뒤엔 뗀다(인화해 보내 주는 건 이벤트 기간 약속).
 */
export default function Entrance({ event, userAgent, url }: EntranceProps) {
  const base = `/events/${event.slug}`;
  if (isDesktopUa(userAgent)) return <Desktop slug={event.slug} url={url} />;

  const { inApp, os } = detectEnv(userAgent);

  return (
    <Screen tone="lime">
      <TopBar start={<Wordmark />} label="no.01" />

      <div className="pt-[18px] text-center">
        <TitleMark />
        <div className="pt-[10px]">
          <StepBar filled={4} />
        </div>
      </div>

      {/* 그림은 남은 높이에 맞춰 줄어든다(작은 폰에서도 버튼이 화면 안에) */}
      <div className="relative min-h-[160px] flex-1">
        {event.phase !== "ended" ? (
          <NoteSticker
            href={`${base}/info`}
            title="No.01"
            className="absolute top-[26px] -right-[6px]"
          >
            인화해서 보내 드려요
          </NoteSticker>
        ) : null}
        <div className="absolute inset-x-0 top-[8px] bottom-[18px] flex items-end justify-center">
          <GirlsIllustration className="h-full max-h-[410px]" />
        </div>
      </div>

      <div className="flex flex-col gap-[12px]">
        {/* TODO(Task 3): `아까 찍은 네컷` 이어 보기 카드가 이 자리 맨 위에 온다 */}
        {inApp ? (
          <InAppNotice inApp={inApp} os={os} url={url} />
        ) : (
          <PillButton href={`${base}/booth`}>커튼 열기</PillButton>
        )}
        {event.switches.wall === true ? (
          <TextLink href={`${base}/wall`}>다른 사람들 네컷 보기</TextLink>
        ) : null}
      </div>
    </Screen>
  );
}
