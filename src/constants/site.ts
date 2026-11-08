/** 사이트 이름·주소·기본 제목과 설명 — 메타데이터와 매니페스트가 읽는다 */
export const SITE = {
  name: "suaci",
  wordmark: "suaci",
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://suaci.com",
  title: "suaci — take suaci.",
  description:
    "lime & basil facial serum mist · take-01. a quick, playful refresh for the days your mind gets sensitive before your skin does.",
  copyright: "© 2026 suaci",
} as const;

/** 이벤트 페이지가 서는 운영 주소의 호스트. QR 옆 안내·스토리 주소·밖으로 넘기는 링크의 기준 */
export const SITE_HOST = "takesuaci.com";

/**
 * 사이버몰 운영자 표시(전자상거래법 제10조·제13조). 상호·대표·등록번호·주소는 사업자등록증(서랍 운영/서류) 글자 그대로,
 * 나머지 번호·연락처는 서랍 "사업자 정보 (사이트 표시용)". 바뀌면 여기 한 곳과 약관의 '사업자 정보' 판을 같이 고친다
 */
export const BUSINESS = {
  name: "수아시",
  representatives: "진시우, 도현우",
  registrationNo: "315-15-68551",
  mailOrderNo: "제2026-대전유성-0535호",
  cosmeticsNo: "제53463호",
  /** 사업자등록증(2026-11-04 정식 발급본) 표기 그대로 — 카드사 심사는 등록증과 다르면 반려 */
  address: "대전광역시 유성구 동서대로656번길 16-12, 207동 701호(용계동, 힐스테이트 도안 2차)",
  phone: "010-6227-7918",
  email: "hello@takesuaci.com",
  privacyOfficer: "도현우",
  /** 공정위 사업자정보 공개 페이지(시행규칙 제7조 — 사이버몰 초기 화면에서 연결) */
  verifyUrl: "https://www.ftc.go.kr/bizCommPop.do?wrkr_no=3151568551",
} as const;
