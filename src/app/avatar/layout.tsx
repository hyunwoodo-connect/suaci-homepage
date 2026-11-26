// 루트 레이아웃은 <html>을 그리지 않고 [locale] 레이아웃이 그린다. 이 경로는 [locale] 밖이라 제 <html>을 둔다 —
// 페이지가 곧바로 이벤트 페이지로 보내므로 그릴 것은 없다
export default function AvatarLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
