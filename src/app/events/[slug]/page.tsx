import { headers } from "next/headers";

import { getActivity } from "@/activities";
import EventWaiting from "@/components/events/EventWaiting";

import { loadEvent } from "./loadEvent";

interface EventPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

/** 이벤트 페이지 — 놀이 모듈이 있으면 그 입구, 없으면 이벤트 레코드(card, copy) 문구로 그린 기본 화면. */
export default async function EventPage({ params, searchParams }: EventPageProps) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const { event, previewToken } = await loadEvent(slug, preview);

  const activity = getActivity(event.activityId);
  if (activity) {
    const h = await headers();
    // 쿠키로만 들어온 미리보기도 밖의 브라우저(쿠키 없음)에서 열리도록 토큰을 주소에 다시 붙인다
    const query = previewToken ? `?preview=${encodeURIComponent(previewToken)}` : "";
    const url = `${requestOrigin(h)}/events/${encodeURIComponent(slug)}${query}`;
    return <activity.Entrance event={event} userAgent={h.get("user-agent") ?? ""} url={url} />;
  }

  const { phase, card, copy } = event;

  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-[16px] bg-paper px-[16px] py-[48px] text-center">
      {phase === "upcoming" ? (
        <EventWaiting title={card.title} startAt={event.startAt} message={copy.upcoming} />
      ) : (
        <section className="flex flex-col items-center gap-[12px]">
          <h1 className="m-0 text-[24px] text-ink">{card.title}</h1>
          {phase === "live" ? (
            <>
              {copy.live ? <p className="m-0 text-[14px] text-grey">{copy.live}</p> : null}
              <div className="mt-[16px] flex aspect-[3/4] w-full max-w-[320px] items-center justify-center bg-studio text-[14px] text-ink-soft">
                곧 이 자리에서 찍을 수 있어요
              </div>
            </>
          ) : copy.ended ? (
            <p className="m-0 text-[14px] text-grey">{copy.ended}</p>
          ) : null}
        </section>
      )}
    </main>
  );
}

/* ─── 하위 함수 ─────────────────────────── */

const SITE_ORIGIN = "https://takesuaci.com";
const PROD_ORIGINS = new Set([SITE_ORIGIN, "https://www.takesuaci.com"]);
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

// 이 주소는 앱 밖으로 넘기는 링크가 되므로 요청 헤더를 그대로 믿지 않고 허용 목록만 쓴다.
// Amplify(CloudFront) 뒤에서는 x-forwarded-*가 원래 주소를 갖고 있다. 로컬 주소는 개발에서만
function requestOrigin(h: Headers): string {
  const forwardedProto = h.get("x-forwarded-proto")?.split(",")[0].trim();
  const hosts = [h.get("x-forwarded-host")?.split(",")[0].trim(), h.get("host")];
  for (const host of hosts) {
    if (!host) continue;
    const isLocal = /^(localhost|127\.0\.0\.1)(:|$)/.test(host);
    const proto =
      forwardedProto === "http" || forwardedProto === "https"
        ? forwardedProto
        : isLocal
          ? "http"
          : "https";
    const origin = `${proto}://${host}`;
    if (PROD_ORIGINS.has(origin)) return origin;
    if (process.env.NODE_ENV !== "production" && LOCAL_ORIGIN.test(origin)) return origin;
  }
  return SITE_ORIGIN;
}
