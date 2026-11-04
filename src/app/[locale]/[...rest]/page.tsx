import { notFound } from "next/navigation";

/**
 * 어느 화면에도 안 맞는 주소 — 언어별 404(같은 셸·홈으로 버튼)로 보낸다.
 * 이게 없으면 Next 가 언어 밖의 기본 404 를 그려 영어 한 줄만 보인다.
 */
export default function CatchAll() {
  notFound();
}
