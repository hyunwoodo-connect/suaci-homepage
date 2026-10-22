import type { EventContent } from ".";

/** No.01 — take four. 첫 이벤트. 문구는 시안 Event.dc.html. */
export const NO01: EventContent = {
  label: "No.01",
  reward: "suaci 첫 병과 인화한 내 네컷",
  fallbackCopy: {
    upcoming: ({ start }) => `${start}에 시작해요.\n부스는 지금도 열려 있어요.`,
    live: () => "네컷 100장을 골라요.",
    ended: ({ announce }) =>
      announce ? `응모는 끝났어요.\n${announce}에 연락드려요.` : "응모는 끝났어요.",
    announced: () => "100명에게 연락드렸어요.\n함께해 줘서 고마워요.",
  },
};
