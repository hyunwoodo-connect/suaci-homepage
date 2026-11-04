/**
 * 한글 글꼴(브랜드 기준 Pretendard) — 공식 안내대로 CDN 의 '쓰는 글자 조각만' 판을 건다.
 * 화면에 나온 글자가 든 조각만 받아서, 한 벌을 통째로 받는 것보다 첫 화면이 가볍다.
 * 미들웨어의 잠금 화면도 이 주소를 쓰므로 next/font 가 없는 이 파일에 둔다.
 */
export const PRETENDARD_CSS =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

/** 일본어 화면용 Pretendard JP — 가나·한자가 든 판. 일본어 화면에서만 건다 */
export const PRETENDARD_JP_CSS =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-jp-dynamic-subset.min.css";
