export type EventPhase = "upcoming" | "live" | "ended";

export interface EventCard {
  title: string;
  summary: string;
  thumbnail?: string;
  order: number;
}

/** 시각은 `*At`=Unix ms, `*Dtm`=KST ISO 문자열. */
export interface EventSummary {
  eventId: string;
  slug: string;
  activityId: string;
  phase: EventPhase;
  startAt: number;
  startDtm: string;
  endAt: number;
  endDtm: string;
  announceAt?: number;
  announceDtm?: string;
  card: EventCard;
}

export interface EventCopy {
  upcoming?: string;
  live?: string;
  ended?: string;
  announced?: string;
}

export interface EventDetail extends EventSummary {
  copy: EventCopy;
  switches: Record<string, boolean>;
  locales: string[];
}
