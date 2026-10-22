"use client";

import { useEffect, useState } from "react";

import { detectEnv } from "../env";
import { composeStory, storyFilename } from "../story/composeStory";
import { useGuardedAction } from "../useGuardedAction";
import { downloadBlob, shareOrDownload, shareStoryOrDownload } from "./share";

/**
 * 완성 화면의 공유·저장. 공유는 9:16 스토리(+ 되면 카드), 저장은 카드.
 * 스토리는 열리자마자 미리 만든다 — 누른 뒤에 만들면 사파리가 사용자 탭이 아니라며 공유 시트를 막는다.
 * 취소·실패해도 화면은 그대로 — 카드는 완성 화면이 들고 있다.
 */
export function useShareActions(strip: Blob, filename: string, storyLink: string) {
  /** 만드는 중 undefined, 못 만들면 null(→ 카드만 공유) */
  const [story, setStory] = useState<Blob | null | undefined>(undefined);
  // 공유 시트가 떠 있는 동안 두 번 누르면 두 번째 share()가 InvalidStateError — 한 번만
  const { run, isBusy } = useGuardedAction();

  useEffect(() => {
    let isCancelled = false;
    composeStory(strip, storyLink)
      .then((blob) => {
        if (!isCancelled) setStory(blob);
      })
      .catch(() => {
        if (!isCancelled) setStory(null);
      });
    return () => {
      isCancelled = true;
    };
  }, [strip, storyLink]);

  function share() {
    return run(async () => {
      try {
        if (story) {
          await shareStoryOrDownload(
            { blob: story, filename: storyFilename(filename) },
            { blob: strip, filename },
          );
        } else {
          await shareOrDownload(strip, filename);
        }
      } catch {}
    });
  }

  function save() {
    // 아이폰 사파리는 <a download>를 새 탭으로 연다 — 공유 시트의 '이미지 저장'이 사진 앱에 바로 넣는다
    if (detectEnv(navigator.userAgent).os !== "ios") {
      try {
        downloadBlob(strip, filename);
      } catch {}
      return Promise.resolve();
    }
    return run(async () => {
      try {
        await shareOrDownload(strip, filename);
      } catch {}
    });
  }

  return { share, save, isBusy, isStoryReady: story !== undefined };
}
