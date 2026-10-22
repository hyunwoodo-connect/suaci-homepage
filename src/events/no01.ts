import type { TakeFourEventContent } from "@/activities/take-four/eventContent";

/**
 * No.01 — take four. 첫 이벤트.
 * - `label`은 시안 기본 회차 이름. 레코드엔 회차 이름 필드가 없고 `card.title`은 놀이 이름(take four)이라,
 *   안내 화면은 이 값을 쓰고 이벤트 내용이 없을 때만 `card.title`로 물러난다. 입구·띠의 회차 표시도 이 값이다.
 * - `reward`는 이벤트 내용(받는 것). 운영 레코드에 아직 이 필드가 없어 여기 둔다.
 * - `fallbackCopy`는 시안(Event.dc.html) 기본 문구. 운영 레코드 `copy`의 그 phase가 비었을 때만 쓰고,
 *   레코드에 문구가 있으면 레코드가 이긴다.
 * - `note`는 입구 쪽지 문구(시안 Main), `wallNotice`는 벽 안내 띠(시안 Wall), `removeNote`는 벽 떼기 시트.
 */
export const NO01 = {
  activityId: "take-four",
  label: "No.01",
  note: "인화해서 보내 드려요",
  reward: "suaci 첫 병과 인화한 내 네컷",
  fallbackCopy: {
    upcoming: ({ start }) => `${start}에 시작해요.\n부스는 지금도 열려 있어요.`,
    live: () => "네컷 100장을 골라요.",
    ended: ({ announce }) =>
      announce ? `응모는 끝났어요.\n${announce}에 연락드려요.` : "응모는 끝났어요.",
    announced: () => "100명에게 연락드렸어요.\n함께해 줘서 고마워요.",
  },
  wallNotice: {
    upcoming: ({ start }) => [`${start} 시작`, "100장을 골라요"],
    live: ({ start, end }) => [`${start} – ${end}`, "100장에 suaci 첫 병을 보내요"],
    ended: ({ announce }) => ["응모 끝", announce ? `${announce}에 연락드려요` : "응모는 끝났어요"],
    announced: () => ["발표 끝", "함께해 줘서 고마워요"],
  },
  removeNote: "응모했다면 응모는 그대로 남고 우리만 봐요.",
} satisfies TakeFourEventContent;
