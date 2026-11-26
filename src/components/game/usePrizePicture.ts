"use client";

import { useEffect, useState } from "react";

import { avatarAssetUrl, loadAvatarManifest } from "@/lib/avatar/bundle";
import { printKey } from "@/lib/avatar/outfit";
import { thumbKey } from "@/lib/avatar/parts";
import type { BoxPrize } from "@/lib/prize-box";

import { MIST_PICTURE } from "./pictures";

/**
 * 박스에서 나온 것의 그림. 옷장 칸은 옷장에 보이는 그 그림이고(부품은 칸 그림, 무늬는 무늬 그림) 아바타 에셋 묶음에 있어 화면이 뜬 뒤에 받는다 —
 * 못 받으면 null(이름은 그대로 보인다)
 */
export function usePrizePicture(prize: BoxPrize): string | null {
  const item = prize.kind === "item" ? prize.item : null;
  const [picture, setPicture] = useState<{ item: string; url: string | null } | null>(null);

  useEffect(() => {
    if (item === null) return;
    let cancelled = false;
    loadAvatarManifest()
      .then((manifest) => {
        if (cancelled) return;
        const url =
          avatarAssetUrl(manifest, thumbKey(item)) ?? avatarAssetUrl(manifest, printKey(item));
        setPicture({ item, url });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [item]);

  if (prize.kind === "mist") return MIST_PICTURE;
  return picture?.item === item ? picture.url : null;
}
