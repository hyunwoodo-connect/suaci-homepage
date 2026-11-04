/**
 * 서버에서 글을 받아 오는 화면(약관·이벤트 목록)으로 넘어가는 동안의 동그라미.
 * [locale] 전체에 두면 없는 주소(404)까지 이 Suspense 안에서 그려져 응답 코드가 200 이 된다 — 필요한 곳에만 둔다.
 */
export default function PageLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="size-[28px] animate-spin rounded-full border-2 border-line border-t-ink motion-reduce:animate-none" />
    </div>
  );
}
