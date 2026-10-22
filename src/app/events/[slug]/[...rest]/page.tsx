import { notFound } from "next/navigation";

import { getActivity } from "@/activities";

import { loadEvent } from "../loadEvent";

interface EventSubPageProps {
  params: Promise<{ slug: string; rest: string[] }>;
  searchParams: Promise<{ preview?: string }>;
}

/** 이벤트 아래 화면(`/events/{slug}/booth` 등) — 놀이 모듈 라우터가 고른다. 모르는 경로는 404. */
export default async function EventSubPage({ params, searchParams }: EventSubPageProps) {
  const { slug, rest } = await params;
  const { preview } = await searchParams;
  const event = await loadEvent(slug, preview);

  const screen = getActivity(event.activityId)?.route(rest, event);
  if (!screen) notFound();
  return screen;
}
