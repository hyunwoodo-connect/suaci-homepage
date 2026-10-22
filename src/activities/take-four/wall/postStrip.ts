import { wallApi } from "./api";
import type { StripView, WallApi } from "./api";
import { rememberMine } from "./local";
import { makeThumb } from "./thumb";

/**
 * 완성 화면의 사진 기둥을 벽에 붙인다: 만들기 → 원본·썸네일 S3 업로드(병렬) → 확정.
 * 하나라도 실패하면 던진다 — 만들어진 `pending`은 서버가 하루 뒤 지운다.
 */
export async function postStrip(photos: Blob, api: WallApi = wallApi): Promise<StripView> {
  const thumb = await makeThumb(photos);
  const { id, uploads } = await api.create();
  await Promise.all([api.upload(uploads.original, photos), api.upload(uploads.thumb, thumb)]);
  const view = await api.confirm(id);
  rememberMine(view.stripId);
  return view;
}
