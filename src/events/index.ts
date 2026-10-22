import { NO01 } from "./no01";

/**
 * 모든 이벤트가 갖는 내용. 레코드에 아직 없는 것만 여기 둔다(같은 필드가 레코드에 생기면 그쪽으로 옮긴다).
 * 놀이마다 더 받는 것은 그 놀이가 자기 타입으로 정하고(예: `TakeFourEventContent`), 이벤트 모듈이 그 타입에 맞춘다.
 */
export interface EventContent {
  /** 이 이벤트가 얹힌 놀이(레코드 `activityId`와 같은 값). 놀이가 자기 내용 타입으로 좁힐 때 본다 */
  activityId: string;
  /** 회차 이름(`No.01`) */
  label: string;
}

const CONTENTS: Record<string, EventContent> = { no01: NO01 };

/** 레코드 eventId로 이벤트 내용을 찾는다. */
export function getEventContent(eventId: string): EventContent | undefined {
  return Object.hasOwn(CONTENTS, eventId) ? CONTENTS[eventId] : undefined;
}
