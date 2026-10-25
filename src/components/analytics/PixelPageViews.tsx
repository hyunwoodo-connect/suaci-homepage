"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** 메타 픽셀은 앱 안 화면 이동을 모른다. 경로가 바뀔 때마다(첫 화면 포함) PageView를 보낸다 */
export default function PixelPageViews() {
  const pathname = usePathname();
  useEffect(() => {
    window.fbq?.("track", "PageView");
  }, [pathname]);
  return null;
}
