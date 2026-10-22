"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import Link from "next/link";

import { ApiClientError } from "@/lib/api/errors";
import type { EventDetail } from "@/types";

import BottomSheet from "../parts/BottomSheet";
import PillButton from "../parts/PillButton";
import Pin from "../parts/Pin";
import Screen from "../parts/Screen";
import Strip from "../parts/Strip";
import TextLink from "../parts/TextLink";
import TopBar from "../parts/TopBar";
import Wordmark from "../parts/Wordmark";
import { wallApi } from "./api";
import type { StripView } from "./api";
import { forgetMine, isHidden, isMine, rememberHidden } from "./local";
import { wallNotice } from "./text";
import WallCard from "./WallCard";

interface WallScreenProps {
  event: EventDetail;
  /** 안내 띠 phase(발표 뒤인지)를 가리는 지금 시각(Unix ms) */
  now: number;
}

/** first: 첫 페이지 받는 중 / more: 다음 페이지 받는 중 / failed·moreFailed: 못 받음 */
type LoadState = "first" | "ready" | "more" | "failed" | "moreFailed";

/** 시안 Wall 카드 기울기 순서 */
const TILTS = [
  "rotate-[-3deg]",
  "rotate-[2deg]",
  "rotate-[1.5deg]",
  "rotate-[-2deg]",
  "rotate-[-1deg]",
  "rotate-[3deg]",
] as const;
const SKELETON_TILTS = ["rotate-[-2deg]", "rotate-[2deg]", "rotate-[1deg]", "rotate-[-1.5deg]"];

/**
 * 이미 받은 id는 건너뛴다 — 목록 캐시(15초) 사이에 새로 붙은 게 끼면 페이지 경계에서 겹친다.
 * 이 폰에서 신고·뗀 네컷도 뺀다 — 캐시된 목록엔 아직 남아 있을 수 있다.
 */
function appendUnique(prev: StripView[], next: StripView[]): StripView[] {
  const seen = new Set(prev.map((s) => s.id));
  return [...prev, ...next.filter((s) => !seen.has(s.id) && !isHidden(s.id) && seen.add(s.id))];
}

/**
 * `/events/{slug}/wall`. 시안 Wall — 다른 사람들이 붙인 네컷을 새로 붙인 순으로, 끝에 닿으면 다음 페이지.
 * `?posted={id}`(붙이고 넘어옴)면 그 네컷을 한 장 먼저 받아 맨 위에 둔다 — 목록은 15초 캐시라 아직 없을 수 있다.
 * 받은 게 없으면(가려짐·없음) 그냥 뺀다.
 */
export default function WallScreen({ event, now }: WallScreenProps) {
  const base = `/events/${event.slug}`;
  const notice = wallNotice(event, now);
  const [posted, setPosted] = useState<StripView | null>(null);
  const [items, setItems] = useState<StripView[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [load, setLoad] = useState<LoadState>("first");
  const [removing, setRemoving] = useState<StripView | null>(null);
  // 같은 렌더 안에서 끝 표시가 두 번 닿아도 한 페이지만 부른다
  const loadingRef = useRef(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadPage = useCallback(async (next?: string) => {
    loadingRef.current = true;
    setLoad(next ? "more" : "first");
    try {
      const page = await wallApi.list(next);
      setItems((prev) => appendUnique(next ? prev : [], page.items));
      setCursor(page.cursor);
      setLoad("ready");
    } catch {
      setLoad(next ? "moreFailed" : "failed");
    } finally {
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;
    wallApi
      .list()
      .then((page) => {
        if (isCancelled) return;
        setItems(appendUnique([], page.items));
        setCursor(page.cursor);
        setLoad("ready");
      })
      .catch(() => {
        if (!isCancelled) setLoad("failed");
      })
      .finally(() => {
        loadingRef.current = false;
      });
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    // 서버 라우터는 쿼리를 받지 않아(놀이 모듈 route) 열린 주소에서 읽는다
    const postedId = new URLSearchParams(window.location.search).get("posted");
    if (!postedId) return;
    let isCancelled = false;
    wallApi
      .get(postedId)
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

  function handleRemoved(id: string) {
    forgetMine(id);
    rememberHidden(id);
    setItems((prev) => prev.filter((s) => s.id !== id));
    setPosted((prev) => (prev?.id === id ? null : prev));
    setRemoving(null);
  }

  const strips = posted ? [posted, ...items.filter((s) => s.id !== posted.id)] : items;
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
            {SKELETON_TILTS.map((tilt) => (
              <div key={tilt} className={`flex flex-col items-center gap-[6px] ${tilt}`}>
                <Strip size="sm" alt="" number="" meta="" />
                <div className="h-[36px] w-[70px] rounded-full bg-[rgba(239,227,207,0.4)]" />
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
            {strips.map((strip, i) => (
              <WallCard
                key={strip.id}
                strip={strip}
                href={`${base}/wall/${encodeURIComponent(strip.id)}`}
                isMine={isMine(strip.id)}
                isPosted={strip.id === posted?.id}
                tilt={TILTS[i % TILTS.length]}
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
            <TextLink size={14} onClick={() => void loadPage(cursor)}>
              더 불러오기
            </TextLink>
          </div>
        ) : null}
      </div>

      <div className="fixed inset-x-[24px] bottom-[28px] z-[5]">
        <PillButton href={`${base}/booth`}>나도 찍기</PillButton>
      </div>

      <RemoveSheet strip={removing} onClose={() => setRemoving(null)} onRemoved={handleRemoved} />
    </Screen>
  );
}

const GRID = "grid grid-cols-2 gap-x-[14px] gap-y-[22px]";

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface RemoveSheetProps {
  /** 뗄 네컷. null이면 닫힘 */
  strip: StripView | null;
  onClose: () => void;
  onRemoved: (id: string) => void;
}

/** `뗄까요?` 시트. 이미 없는 네컷(404)이면 뗀 것으로 친다. */
function RemoveSheet({ strip, onClose, onRemoved }: RemoveSheetProps) {
  const [status, setStatus] = useState<"idle" | "removing" | "failed">("idle");
  const removingRef = useRef(false);

  async function handleRemove() {
    if (!strip || removingRef.current) return;
    removingRef.current = true;
    setStatus("removing");
    try {
      await wallApi.remove(strip.id);
      setStatus("idle");
      onRemoved(strip.id);
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) {
        setStatus("idle");
        onRemoved(strip.id);
      } else {
        setStatus("failed");
      }
    } finally {
      removingRef.current = false;
    }
  }

  function handleClose() {
    if (removingRef.current) return;
    setStatus("idle");
    onClose();
  }

  return (
    <BottomSheet isOpen={strip !== null} onClose={handleClose} label="내 네컷 떼기">
      <h2 className="m-0 text-[22px] font-bold">뗄까요?</h2>
      <p className="m-0 text-[15px] leading-[1.6]">
        벽에서만 내려요. 응모했다면 응모는 그대로 남고 우리만 봐요.
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
