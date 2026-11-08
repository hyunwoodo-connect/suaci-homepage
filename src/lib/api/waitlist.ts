import { ApiClientError } from "./errors";
import { createFetcher } from "./http/fetcher";
import { createMockWaitlistApi } from "./mock/waitlist";
import { selectApi } from "./select";

/** 출시 알림 받기. 두 동의는 화면에서 체크했을 때만 부른다(그래서 여기서는 늘 true로 싣는다). */
export interface WaitlistJoinInput {
  email: string;
  locale?: string;
  /** 유입 표시(utm_source 등) */
  source?: string;
}

/** 출시 알림 API 의 모양 — 실서버·목업·빈 응답이 같은 모양으로 구현한다 */
export interface WaitlistApi {
  /** 이미 있는 이메일도 성공. 실패는 `ApiClientError`(code: INVALID_EMAIL·RATE_LIMITED·…) */
  join(input: WaitlistJoinInput): Promise<void>;
}

/** 실서버 출시 알림 API. 화면에서 두 동의를 받은 뒤에만 불러 동의 값은 늘 true 로 싣는다 */
export function createWaitlistApi(baseUrl: string): WaitlistApi {
  const { request } = createFetcher(baseUrl);
  return {
    async join(input) {
      await request("/waitlist", {
        method: "POST",
        body: { ...input, privacyConsent: true, marketingConsent: true },
      });
    },
  };
}

/** 운영에서 주소가 빠지면 남긴 척하지 않는다. 화면이 "잠시 뒤 다시"를 보인다. */
export function createEmptyWaitlistApi(): WaitlistApi {
  return {
    async join() {
      throw new ApiClientError("UNAVAILABLE", "waitlist backend not configured", 503);
    },
  };
}

/** 주소가 있으면 실서버, 없으면 개발·테스트는 목업이고 운영은 빈 응답 */
export function selectWaitlistApi(
  baseUrl: string | undefined,
  nodeEnv: string | undefined,
): WaitlistApi {
  return selectApi(
    { live: createWaitlistApi, mock: createMockWaitlistApi, empty: createEmptyWaitlistApi },
    baseUrl,
    nodeEnv,
  );
}

/** 화면이 쓰는 출시 알림 API — 빌드 환경으로 한 번 정해진다 */
export const waitlistApi: WaitlistApi = selectWaitlistApi(
  process.env.NEXT_PUBLIC_API_BASE_URL,
  process.env.NODE_ENV,
);
