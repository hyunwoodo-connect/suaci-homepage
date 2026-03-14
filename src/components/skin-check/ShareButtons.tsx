"use client";

import { useState, useCallback } from "react";

interface ShareButtonsProps {
  /** 공유할 URL */
  shareUrl: string;
  /** 공유 텍스트 */
  shareText: string;
}

export default function ShareButtons({ shareUrl, shareText }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 폴백: 구형 브라우저
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  const handleKakaoShare = useCallback(() => {
    const kakaoUrl = `https://sharer.kakao.com/talk/friends/picker/link?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(kakaoUrl, "_blank", "noopener,noreferrer");
  }, [shareUrl, shareText]);

  const handleNativeShare = useCallback(async () => {
    if (!navigator.share) return;
    try {
      await navigator.share({
        title: "SUACI 퍼스널 컬러 진단",
        text: shareText,
        url: shareUrl,
      });
    } catch {
      // 사용자가 공유를 취소한 경우
    }
  }, [shareUrl, shareText]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-muted">
        Share Result
      </p>

      <div className="flex items-center justify-center gap-3">
        {/* 링크 복사 */}
        <button
          onClick={handleCopyLink}
          className="flex h-12 items-center gap-2 rounded-full border border-border px-5 text-sm transition-colors hover:bg-foreground/5"
        >
          <LinkIcon />
          {copied ? "복사됨!" : "링크 복사"}
        </button>

        {/* 카카오톡 */}
        <button
          onClick={handleKakaoShare}
          className="flex h-12 items-center gap-2 rounded-full bg-[#FEE500] px-5 text-sm font-medium text-[#191919] transition-opacity hover:opacity-80"
        >
          <KakaoIcon />
          카카오톡
        </button>

        {/* 네이티브 공유 (모바일) */}
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button
            onClick={handleNativeShare}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border transition-colors hover:bg-foreground/5"
            aria-label="공유"
          >
            <ShareIcon />
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── 아이콘 컴포넌트 ─────────────────────────── */

function LinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function KakaoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.72 1.794 5.11 4.508 6.459l-1.15 4.267a.5.5 0 0 0 .77.528l4.95-3.27c.3.02.603.034.922.034 5.523 0 10-3.463 10-7.709C22 6.463 17.523 3 12 3z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}
