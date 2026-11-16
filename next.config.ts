import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// 빌드 표시(틈 ?debug 화면 구석): Amplify 가 빌드할 때 주는 커밋(AWS_COMMIT_ID)의 앞 7자와 빌드 시각
const buildCommit = (process.env.AWS_COMMIT_ID ?? "").slice(0, 7);

const nextConfig: NextConfig = {
  devIndicators: false,
  env: {
    NEXT_PUBLIC_BUILD_COMMIT: buildCommit,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  images: {
    minimumCacheTTL: 0,
  },
};

export default withNextIntl(nextConfig);
