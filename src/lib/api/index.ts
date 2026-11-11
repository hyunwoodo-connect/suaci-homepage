import type { ApiClient } from "./client";
import { createHttpClient } from "./http";

// 커머스 `api`는 늘 백엔드(`NEXT_PUBLIC_API_BASE_URL`)를 부른다 — 브라우저 안 목업 백엔드는 없다(규칙이 서버와 어긋나 두 벌이 됐다).
// 로컬 개발은 dev 스택 주소를 넣는다. 이벤트·놀이 API는 이와 별개로 `selectApi`(주소가 있으면 live, 없으면 mock, 운영은 빈 응답)를 따른다.
/** 화면이 쓰는 커머스 API — 백엔드를 부르는 클라이언트 하나 */
export const api: ApiClient = createHttpClient();
export type { ApiClient } from "./client";
export { ApiClientError, isAuthRequired, isNotFound, isRateLimited } from "./errors";
export { eventsApi } from "./events";
export type { EventsApi } from "./events";
export { legalApi } from "./legal";
export type { LegalApi } from "./legal";
export { waitlistApi } from "./waitlist";
export type { WaitlistApi, WaitlistJoinInput } from "./waitlist";
export { createFetcher } from "./http/fetcher";
export type { Envelope } from "./http/fetcher";
export { selectApi } from "./select";
