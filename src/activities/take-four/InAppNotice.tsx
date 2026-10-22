"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import PillButton from "./parts/PillButton";
import { androidIntentUrl, kakaoExternalUrl } from "./env";
import type { DeviceEnv, InAppBrowser } from "./env";

interface InAppNoticeProps {
  inApp: InAppBrowser;
  os: DeviceEnv["os"];
}

const TOAST_MS = 2000;

/**
 * 인앱 브라우저 안내. 카메라가 안 열리니 밖의 브라우저로 같은 주소(미리보기 토큰 포함)를 넘긴다.
 * 안드로이드는 크롬 intent, iOS 카카오톡은 외부 열기 스킴, 나머지 iOS 인앱은 넘길 방법이 없어 주소를 복사해 준다.
 */
export default function InAppNotice({ inApp, os }: InAppNoticeProps) {
  const url = useSyncExternalStore(subscribeNever, readHref, readNoHref);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handOff =
    os === "android"
      ? androidIntentUrl
      : os === "ios" && inApp === "kakao"
        ? kakaoExternalUrl
        : null;

  async function handleCopy() {
    const isCopied = await copyText(window.location.href);
    setToast(isCopied ? "주소를 복사했어요" : "주소창을 길게 눌러 복사해 주세요");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }

  return (
    <>
      <p className="m-0 text-center text-[14px] leading-[1.5]">
        여기선 카메라가 안 열려요. 오른쪽 위 ··· → 다른 브라우저로 열기
      </p>
      {handOff ? (
        <PillButton href={url ? handOff(url) : undefined}>브라우저로 열기</PillButton>
      ) : (
        <PillButton onClick={handleCopy}>주소 복사하기</PillButton>
      )}
      <p
        role="status"
        className="pointer-events-none fixed inset-x-0 top-[72px] z-10 m-0 flex justify-center px-[24px]"
      >
        {toast ? (
          <span className="rounded-full bg-(--tf-ink) px-[18px] py-[10px] text-[14px] text-(color:--tf-cream)">
            {toast}
          </span>
        ) : null}
      </p>
    </>
  );
}

/* ─── 하위 함수 ─────────────────────────── */

// 주소는 클라이언트에서만 안다. 서버 그림에선 비워 두고 하이드레이션 뒤에 채운다
function subscribeNever() {
  return () => {};
}

function readHref() {
  return window.location.href;
}

function readNoHref() {
  return "";
}

// 인앱 웹뷰는 Clipboard API를 막는 경우가 있어 옛 방식으로 한 번 더 시도한다
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      field.remove();
    }
  }
}
