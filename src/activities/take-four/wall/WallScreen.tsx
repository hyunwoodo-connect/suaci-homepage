"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";

import type { EventDetail } from "@/types";

import PillButton from "../parts/PillButton";
import Card from "../parts/Card";
import Pin from "../parts/Pin";
import Screen from "../parts/Screen";
import TextLink from "../parts/TextLink";
import TopBar from "../parts/TopBar";
import Wordmark from "../parts/Wordmark";
import { getTakeFourContent } from "../eventContent";
import { wallApi } from "./api";
import type { StripView } from "./api";
import { forgetMine, isHidden, isMine, rememberHidden } from "./deviceMarks";
import RemoveSheet from "./RemoveSheet";
import { wallNotice } from "./notice";
import WallCard from "./WallCard";

interface WallScreenProps {
  event: EventDetail;
  /** 안내 띠 phase(발표 뒤인지)를 가리는 지금 시각(Unix ms) */
  now: number;
}

/** first: 첫 페이지 받는 중 / more: 다음 페이지 받는 중 / failed·moreFailed: 못 받음 */
type LoadState = "first" | "ready" | "more" | "failed" | "moreFailed";

const GRID = "grid grid-cols-2 gap-x-[14px] gap-y-[20px]";
const SKELETON_COUNT = 4;

/**
 * 이미 받은 네컷은 건너뛴다 — 목록 캐시(15초) 사이에 새로 붙은 게 끼면 페이지 경계에서 겹친다.
 * 이 폰에서 신고·뗀 네컷도 뺀다 — 캐시된 목록엔 아직 남아 있을 수 있다.
 */
function appendUnique(prev: StripView[], next: StripView[]): StripView[] {
  const seen = new Set(prev.map((s) => s.stripId));
  return [
    ...prev,
    ...next.filter((s) => !seen.has(s.stripId) && !isHidden(s.stripId) && seen.add(s.stripId)),
  ];
}

/**
 * `/events/{slug}/wall`. 시안 Wall — 다른 사람들이 붙인 네컷을 새로 붙인 순으로, 끝에 닿으면 다음 페이지.
 * `?posted={stripId}`(붙이고 넘어옴)면 그 네컷을 한 장 먼저 받아 맨 위에 둔다 — 목록은 15초 캐시라 아직 없을 수 있다.
 * 받은 게 없으면(가려짐·없음) 그냥 뺀다.
 */
export default function WallScreen({ event, now }: WallScreenProps) {
  const base = `/events/${event.slug}`;
  const notice = wallNotice(event, now);
  const removeNote = getTakeFourContent(event.eventId)?.removeNote;
  const [posted, setPosted] = useState<StripView | null>(null);
  const [items, setItems] = useState<StripView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [load, setLoad] = useState<LoadState>("first");
  const [removing, setRemoving] = useState<StripView | null>(null);
  // 같은 렌더 안에서 끝 표시가 두 번 닿아도 한 페이지만 부른다
  const loadingRef = useRef(true);
  // 마지막으로 부른 요청 번호. 화면을 떠났거나 새로 부른 뒤 늦게 온 응답은 버린다
  const requestRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (next?: string) => {
    const request = ++requestRef.current;
    loadingRef.current = true;
    setLoad(next ? "more" : "first");
    try {
      const page = await wallApi.list(next);
      if (request !== requestRef.current) return;
      setItems((prev) => appendUnique(next ? prev : [], page.items));
      setCursor(page.cursor);
      setLoad("ready");
    } catch {
      if (request === requestRef.current) setLoad(next ? "moreFailed" : "failed");
    } finally {
      if (request === requestRef.current) loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    void loadPage();
    return () => {
      requestRef.current += 1;
    };
  }, [loadPage]);

  useEffect(() => {
    // 서버 라우터는 쿼리를 받지 않아(놀이 모듈 route) 열린 주소에서 읽는다
    const postedStripId = new URLSearchParams(window.location.search).get("posted");
    if (!postedStripId) return;
    let isCancelled = false;
    wallApi
      .get(postedStripId)
      .then((strip) => {
        if (!isCancelled) setPosted(strip);
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !cursor || load !== "ready") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting) || loadingRef.current) return;
        void loadPage(cursor);
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, load, loadPage]);

  function handleRemoved(stripId: string) {
    forgetMine(stripId);
    rememberHidden(stripId);
    setItems((prev) => prev.filter((s) => s.stripId !== stripId));
    setPosted((prev) => (prev?.stripId === stripId ? null : prev));
    setRemoving(null);
  }

  const strips = posted ? [posted, ...items.filter((s) => s.stripId !== posted.stripId)] : items;
  // 카드마다 렌더마다 저장소를 읽지 않게 목록이 바뀔 때만 한 번
  const mineIds = useMemo(
    () =>
      new Set(
        [...items, ...(posted ? [posted] : [])]
          .filter((s) => isMine(s.stripId))
          .map((s) => s.stripId),
      ),
    [items, posted],
  );
  const isFirstLoad = load === "first";
  const isEmpty = !isFirstLoad && load !== "failed" && strips.length === 0;

  return (
    <Screen tone="lime">
      <TopBar nav={{ icon: "back", label: "입구로", href: base }} label={<Wordmark />} />

      <h1 className="m-0 pt-[8px] pb-[12px] font-(family-name:--tf-latin) text-[44px] leading-none font-semibold tracking-[-0.02em] italic">
        the wall
      </h1>

      {notice ? (
        <Link
          href={`${base}/info`}
          className="relative mb-[14px] block rotate-[-1deg] bg-(--tf-cream) px-[14px] py-[12px] text-(color:--tf-ink) no-underline shadow-[0_6px_12px_rgba(43,36,32,0.2)]"
        >
          <Pin />
          <span className="block font-(family-name:--tf-latin) text-[15px] font-semibold italic">
            {notice.head}
          </span>
          <span className="block pt-[2px] text-[14px] leading-[1.5]">{notice.body} →</span>
        </Link>
      ) : null}

      <div className="pt-[6px] pb-[120px]">
        {isFirstLoad ? (
          <div role="status" aria-label="불러오는 중" className={GRID}>
            {Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-[8px]">
                <Card alt="" size="fill" hasShadow />
                <div className="h-[36px] w-[70px] rounded-full bg-(--tf-cream)/40" />
              </div>
            ))}
          </div>
        ) : null}

        {load === "failed" ? (
          <div className="px-[10px] pt-[60px] text-center">
            <p role="alert" className="m-0 text-[20px] font-bold">
              벽을 불러오지 못했어요
            </p>
            <TextLink onClick={() => void loadPage()}>다시 불러오기</TextLink>
          </div>
        ) : null}

        {isEmpty ? (
          <div className="px-[10px] pt-[60px] text-center">
            <p className="m-0 text-[20px] font-bold">아직 벽이 비어 있어요</p>
            <p className="m-0 mt-[8px] text-[15px]">첫 번째로 붙여 주세요.</p>
          </div>
        ) : null}

        {strips.length > 0 ? (
          <div className={GRID}>
            {strips.map((strip) => (
              <WallCard
                key={strip.stripId}
                strip={strip}
                href={`${base}/wall/${encodeURIComponent(strip.stripId)}`}
                isMine={mineIds.has(strip.stripId)}
                isPosted={strip.stripId === posted?.stripId}
                onAskRemove={() => setRemoving(strip)}
              />
            ))}
          </div>
        ) : null}

        <div ref={sentinelRef} />
        {load === "more" ? (
          <p role="status" className="m-0 mt-[26px] text-center text-[14px]">
            더 불러오는 중…
          </p>
        ) : null}
        {load === "moreFailed" && cursor ? (
          <div className="mt-[18px]">
            <TextLink size="md" onClick={() => void loadPage(cursor)}>
              더 불러오기
            </TextLink>
          </div>
        ) : null}
      </div>

      <div className="fixed inset-x-[24px] bottom-[28px] z-[5]">
        <PillButton href={`${base}/booth`}>나도 찍기</PillButton>
      </div>

      <RemoveSheet
        strip={removing}
        note={removeNote}
        onClose={() => setRemoving(null)}
        onRemoved={handleRemoved}
      />
    </Screen>
  );
}
