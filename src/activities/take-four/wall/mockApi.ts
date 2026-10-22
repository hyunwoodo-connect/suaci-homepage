import { ApiClientError } from "@/lib/api";

import { blobToDataUrl } from "../canvas";
import type { StripView, UploadTarget, WallApi } from "./api";

function notFound(): ApiClientError {
  return new ApiClientError("STRIP_NOT_FOUND", "없는 네컷이에요", 404);
}

/** 백엔드 주소가 없을 때(로컬 개발·테스트)의 대역. 이 탭 메모리에만 붙는다. */
export function createMockWallApi(): WallApi {
  const uploaded = new Map<string, string>();
  const posted: StripView[] = [];
  const pending = new Set<string>();
  let seq = 0;

  const target = (id: string, name: string): UploadTarget => {
    const key = `activities/take-four/strips/${id}/${name}.jpg`;
    return { url: "mock://upload", fields: { key }, key };
  };

  return {
    async list() {
      return { items: [...posted], cursor: null };
    },
    async get(id) {
      return posted.find((s) => s.stripId === id) ?? null;
    },
    async create() {
      seq += 1;
      const id = `mock-${seq}`;
      pending.add(id);
      return { id, uploads: { original: target(id, "original"), thumb: target(id, "thumb") } };
    },
    async upload(t, blob) {
      uploaded.set(t.key, await blobToDataUrl(blob));
    },
    async confirm(id) {
      const done = posted.find((s) => s.stripId === id);
      if (done) return done;
      if (!pending.has(id)) throw notFound();
      const photoUrl = uploaded.get(target(id, "original").key);
      const thumbUrl = uploaded.get(target(id, "thumb").key);
      if (!photoUrl || !thumbUrl) {
        throw new ApiClientError("UPLOAD_MISSING", "사진이 아직 없어요", 409);
      }
      pending.delete(id);
      const now = Date.now();
      const view: StripView = {
        stripId: id,
        serial: posted.length + 1,
        eventId: "no01",
        ribbons: 0,
        thumbUrl,
        photoUrl,
        postedAt: now,
        postedDtm: new Date(now).toISOString(),
      };
      posted.unshift(view);
      return view;
    },
    async ribbon(id) {
      const strip = posted.find((s) => s.stripId === id);
      if (!strip) throw notFound();
      strip.ribbons += 1;
      return strip.ribbons;
    },
    async report(id) {
      const index = posted.findIndex((s) => s.stripId === id);
      if (index < 0) throw notFound();
      posted.splice(index, 1);
    },
    async remove(id) {
      const index = posted.findIndex((s) => s.stripId === id);
      if (index < 0) throw notFound();
      posted.splice(index, 1);
    },
  };
}
