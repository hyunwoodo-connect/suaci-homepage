import { wallApi } from "./api";
import type { StripView } from "./api";
import { rememberMine } from "./deviceMarks";
import { makeThumb } from "./thumb";

/**
 * 완성 카드를 벽에 붙인다: 만들기 → 원본·썸네일 S3 업로드(병렬) → 확정.
 * 하나라도 실패하면 던진다 — 만들어진 `pending`은 서버가 하루 뒤 지운다.
 */
export async function postStrip(card: Blob): Promise<StripView> {
  const thumb = await makeThumb(card);
  const { stripId, uploads } = await wallApi.create();
  await Promise.all([wallApi.upload(uploads.original, card), wallApi.upload(uploads.thumb, thumb)]);
  const view = await wallApi.confirm(stripId);
  rememberMine(view.stripId);
  return view;
}
