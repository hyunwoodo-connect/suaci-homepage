// 게임 틀(시작 → 해결 → 랜덤박스)의 글자. 이 틀은 이벤트 화면(문구 묶음이 없다)에서 그려지므로 사이트의 messages 가 아니라 여기에 둔다.
// 글은 적게 — 무엇이 일어나는지는 그림이 보여 준다

/** 게임 틀의 글자 */
export const GAME_LABELS = {
  start: "시작",
  loading: "불러오는 중",
  failed: "불러오지 못했어요",
  cleared: "clear!",
  /** 박스를 누르라는 손짓 옆 글자 */
  tap: "tap",
  next: "다음",
  again: "다시 하기",
  leave: "나가기",
  close: "닫기",
  mist: "진짜 미스트",
  /** 읽는 이름(그림만 보이는 칸) */
  box: "랜덤박스",
  openBox: "랜덤박스 {n} 열기",
  boxes: "랜덤박스 {total}개 가운데 {opened}개 열었어요",
  goal: "{goal} {count}개를 해내면 랜덤박스 {boxes}개",
  won: "받은 것",
} as const;

/** 글자 속 {이름} 자리에 값을 넣는다 */
export function fillLabel(text: string, values: Readonly<Record<string, string | number>>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : whole,
  );
}
