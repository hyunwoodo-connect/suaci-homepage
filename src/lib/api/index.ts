import type { ApiClient } from "./client";
import { createMockClient } from "./mock";
import { createHttpClient } from "./http";

// 커머스 `api`는 NEXT_PUBLIC_API_MODE로 mock/http를 고른다. 이벤트·놀이 API는 이와 별개로
// `selectApi`(주소가 있으면 live, 없으면 mock, 운영은 빈 응답)를 따른다.
const MODE = process.env.NEXT_PUBLIC_API_MODE ?? "mock";
export const api: ApiClient = MODE === "http" ? createHttpClient() : createMockClient();
export type { ApiClient } from "./client";
export { ApiClientError, isNotFound, isRateLimited } from "./errors";
export { eventsApi } from "./events";
export type { EventsApi } from "./events";
export { createFetcher } from "./http/fetcher";
export type { Envelope } from "./http/fetcher";
export { selectApi } from "./select";
