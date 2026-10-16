import Link from "next/link";

export default function NotFound() {
  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "Geist, system-ui, sans-serif",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "4rem", fontWeight: 400, margin: 0 }}>404</h1>
          <p style={{ marginTop: "1rem", color: "#666" }}>
            page not found.
          </p>
          <Link href="/" style={{ color: "#111", marginTop: "1.5rem", display: "inline-block" }}>
            back to suaci
          </Link>
        </div>
      </body>
    </html>
  );
}
