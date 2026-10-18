/** 사이트 전역 상수 */
export const SITE = {
  name: "SUACI",
  wordmark: "suaci",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://suaci.com",
  title: "suaci — take suaci.",
  description:
    "brume no.1 — lime & basil face mist. a quick, playful refresh for the days your mind gets sensitive before your skin does.",
  copyright: "© 2026 suaci",
  tagline: "take suaci.",
} as const;
