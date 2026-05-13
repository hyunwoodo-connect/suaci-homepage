import Link from "next/link";

export default function NotFound() {
  return (
    <html lang="ko">
      <body
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "4rem", fontWeight: 700, margin: 0 }}>404</h1>
          <p style={{ marginTop: "1rem", color: "#666" }}>
            페이지를 찾을 수 없습니다
          </p>
          <Link href="/" style={{ color: "#111", marginTop: "1.5rem", display: "inline-block" }}>
            홈으로 돌아가기
          </Link>
        </div>
      </body>
    </html>
  );
}
