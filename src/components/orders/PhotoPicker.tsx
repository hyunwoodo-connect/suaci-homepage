"use client";

import { useEffect, useId, useRef, useState } from "react";

import { useTranslations } from "next-intl";

import { api } from "@/lib/api";
import { CLAIM_PHOTO_LIMIT, prepareClaimPhoto } from "@/lib/claims/photo";

interface PhotoPickerProps {
  orderId: string;
  /** 다 올라간 사진 ID 들(신청의 `photoIds`) */
  onChange: (photoIds: string[]) => void;
  /** 올리는 중이면 true — 그동안 신청 버튼을 막는다 */
  onBusyChange: (busy: boolean) => void;
}

interface PickedPhoto {
  key: string;
  previewUrl: string;
  photoId?: string;
  failed?: boolean;
}

/**
 * 반품·교환 신청 사진(선택, 3장까지) — 고르면 바로 다시 그려(사진 정보 떼기) 비공개로 올린다. 사진은 회사만 본다.
 * 실패한 사진은 빼고 다시 고를 수 있다.
 */
export default function PhotoPicker({ orderId, onChange, onBusyChange }: PhotoPickerProps) {
  const t = useTranslations("claims.photos");
  const inputId = useId();
  const hintId = useId();
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [uploading, setUploading] = useState(0);
  const counter = useRef(0);

  // 고른 사진이 바뀌면 다 올라간 것만 신청에 넘긴다
  useEffect(() => {
    const ready = photos.flatMap((p) => (p.photoId ? [p.photoId] : []));
    onChange(ready);
  }, [photos, onChange]);

  useEffect(() => {
    onBusyChange(uploading > 0);
  }, [uploading, onBusyChange]);

  // 떠날 때 미리보기 주소를 놓아 준다
  const previews = useRef<string[]>([]);
  useEffect(() => {
    const urls = previews.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  const room = CLAIM_PHOTO_LIMIT - photos.length;

  async function upload(key: string, file: File) {
    setUploading((n) => n + 1);
    try {
      const prepared = await prepareClaimPhoto(file);
      const photoId = await api.uploadClaimPhoto(orderId, prepared);
      setPhotos((list) => list.map((p) => (p.key === key ? { ...p, photoId } : p)));
    } catch {
      setPhotos((list) => list.map((p) => (p.key === key ? { ...p, failed: true } : p)));
    } finally {
      setUploading((n) => n - 1);
    }
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, room);
    e.target.value = "";
    const picked = files.map((file) => {
      counter.current += 1;
      const previewUrl = URL.createObjectURL(file);
      previews.current.push(previewUrl);
      return { key: `p${String(counter.current)}`, previewUrl, file };
    });
    setPhotos((list) => [...list, ...picked.map(({ key, previewUrl }) => ({ key, previewUrl }))]);
    for (const p of picked) void upload(p.key, p.file);
  }

  function remove(key: string) {
    setPhotos((list) => list.filter((p) => p.key !== key));
  }

  return (
    <div className="flex flex-col gap-[8px]">
      <span className="text-[14px] font-medium text-ink">{t("label")}</span>
      <p id={hintId} className="m-0 text-[13px] leading-[1.6] text-grey">
        {t("hint")}
      </p>
      {photos.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-[8px] p-0">
          {photos.map((p, i) => {
            const n = i + 1;
            const label = t("item", { n });
            const removeLabel = t("remove", { n });
            const state = p.failed ? t("failed") : p.photoId ? "" : t("uploading");
            return (
              <li key={p.key} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- 손님 기기의 로컬 미리보기(blob:)라 next/image 를 쓸 수 없다 */}
                <img
                  src={p.previewUrl}
                  alt={label}
                  className={`size-[72px] border border-line object-cover ${p.photoId ? "" : "opacity-50"}`}
                />
                {state && (
                  <span
                    role={p.failed ? "alert" : "status"}
                    className={`absolute inset-x-0 bottom-0 bg-paper/90 px-[2px] text-center text-[11px] ${p.failed ? "text-alert" : "text-grey"}`}
                  >
                    {state}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(p.key)}
                  aria-label={removeLabel}
                  className="absolute -right-[10px] -top-[10px] flex size-[28px] cursor-pointer items-center justify-center rounded-full border border-line bg-paper text-[14px] leading-none"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {room > 0 && (
        <label
          htmlFor={inputId}
          className="flex min-h-[44px] w-fit cursor-pointer items-center border border-line px-[14px] text-[14px] text-ink"
        >
          {t("add", { left: room })}
          <input
            id={inputId}
            type="file"
            accept="image/*"
            multiple
            aria-describedby={hintId}
            onChange={handleFiles}
            className="sr-only"
          />
        </label>
      )}
    </div>
  );
}
