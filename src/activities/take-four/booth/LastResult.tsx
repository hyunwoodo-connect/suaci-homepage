"use client";

import { useEffect, useState } from "react";

import type { EventDetail } from "@/types";

import PillButton from "../parts/PillButton";
import Screen from "../parts/Screen";
import TopBar from "../parts/TopBar";
import { loadLast } from "../strip/storage";
import type { LastStrip } from "../strip/storage";
import ResultScreen from "./ResultScreen";

interface LastResultProps {
  event: EventDetail;
}

/** `/events/{slug}/result`. 입구 `아까 찍은 네컷` 카드가 여는 마지막 띠의 완성 화면. */
export default function LastResult({ event }: LastResultProps) {
  const [last, setLast] = useState<LastStrip | null | undefined>(undefined);
  const base = `/events/${event.slug}`;

  useEffect(() => {
    let isCancelled = false;
    loadLast().then((value) => {
      if (!isCancelled) setLast(value);
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  if (last) {
    return (
      <ResultScreen
        strip={last.blob}
        photos={last.photos}
        caption={last.caption}
        canEnter={event.switches.entry === true}
        retakeHref={`${base}/booth`}
      />
    );
  }

  return (
    <Screen tone="cream">
      <TopBar nav={{ icon: "back", label: "입구로", href: base }} />
      <div className="flex flex-1 items-center justify-center text-center">
        {last === null ? (
          <p className="m-0 text-[18px] leading-[1.6]">이 폰엔 아까 찍은 네컷이 없어요.</p>
        ) : (
          <span role="status" className="sr-only">
            네컷 여는 중
          </span>
        )}
      </div>
      {last === null ? <PillButton href={`${base}/booth`}>커튼 열기</PillButton> : null}
    </Screen>
  );
}
