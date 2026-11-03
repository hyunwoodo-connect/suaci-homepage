/** 사이트 전역 상수 */
export const SITE = {
  name: "suaci",
  wordmark: "suaci",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://suaci.com",
  title: "suaci — take suaci.",
  description:
    "lime & basil facial serum mist · take-01. a quick, playful refresh for the days your mind gets sensitive before your skin does.",
  copyright: "© 2026 suaci",
  tagline: "take suaci.",
} as const;

/** 이벤트 페이지가 서는 운영 주소의 호스트. QR 옆 안내·스토리 주소·밖으로 넘기는 링크의 기준 */
export const SITE_HOST = "takesuaci.com";

/**
 * 사이버몰 운영자 표시(전자상거래법 제10조·제13조). 값의 출처는 운영 서랍 "사업자 정보 (사이트 표시용)".
 * 주소·고객센터 번호는 바뀔 예정이라 여기 한 곳만 고친다. 표시는 사업자 등록 서류 그대로 한국어로 둔다
 */
export const BUSINESS = {
  name: "수아시",
  representatives: "진시우, 도현우",
  registrationNo: "315-15-68551",
  mailOrderNo: "제2026-대전유성-0535호",
  cosmeticsNo: "제53463호",
  address: "대전광역시 유성구 용계동 667-1 207동 701호",
  phone: "010-6227-7918",
  email: "hello@takesuaci.com",
  privacyOfficer: "도현우",
  /** 공정위 사업자정보 공개 페이지(시행규칙 제7조 — 사이버몰 초기 화면에서 연결) */
  verifyUrl: "https://www.ftc.go.kr/bizCommPop.do?wrkr_no=3151568551",
} as const;
