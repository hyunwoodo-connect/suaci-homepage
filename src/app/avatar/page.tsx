import { redirect } from "next/navigation";

/** 아바타는 이벤트 페이지 안에 산다(목록 위의 '내 아바타') — 따로 열던 이 주소는 그리로 보낸다 */
export default function AvatarPage(): never {
  redirect("/events");
}
