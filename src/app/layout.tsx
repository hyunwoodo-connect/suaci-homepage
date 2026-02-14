import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SUACI — Official",
  description: "SUACI 공식 웹사이트",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
