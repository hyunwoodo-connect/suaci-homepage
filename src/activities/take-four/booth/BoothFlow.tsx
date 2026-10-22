"use client";

import { useState } from "react";

import Screen from "../parts/Screen";
import TextLink from "../parts/TextLink";
import TopBar from "../parts/TopBar";
import BoothScreen from "./BoothScreen";

interface BoothFlowProps {
  slug: string;
}

/** `/events/{slug}/booth`. 찍은 네 장을 들고 촬영 → 현상으로 넘긴다. */
export default function BoothFlow({ slug }: BoothFlowProps) {
  const [frames, setFrames] = useState<HTMLCanvasElement[] | null>(null);
  if (!frames) return <BoothScreen slug={slug} onDone={setFrames} />;
  return <PrintPending slug={slug} onRetake={() => setFrames(null)} />;
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface PrintPendingProps {
  slug: string;
  onRetake: () => void;
}

// TODO(Task 3): 현상(Print) → 완성(Result) 화면으로 바꾼다
function PrintPending({ slug, onRetake }: PrintPendingProps) {
  const entrance = `/events/${slug}`;
  return (
    <Screen tone="cream">
      <TopBar nav={{ icon: "back", label: "입구로", href: entrance }} label="4 / 4" />
      <div className="flex flex-1 flex-col items-center justify-center gap-[8px] text-center">
        <p className="m-0 text-[20px] leading-[1.6]">인화는 준비 중이에요.</p>
        <TextLink onClick={onRetake}>다시 찍기</TextLink>
        <TextLink href={entrance}>입구로 돌아가기</TextLink>
      </div>
    </Screen>
  );
}
