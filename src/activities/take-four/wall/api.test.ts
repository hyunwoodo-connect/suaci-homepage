import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { getDeviceToken } from "@/lib/device-token";

import { createWallApi, selectWallApi, uploadTo } from "./api";
import { createMockWallApi } from "./mockApi";
import type { StripView, UploadTarget } from "./api";

function response(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  };
}

const VIEW: StripView = {
  stripId: "01J",
  serial: 347,
  eventId: "no01",
  ribbons: 0,
  thumbUrl: "https://cdn.test/t.jpg",
  photoUrl: "https://cdn.test/o.jpg",
  postedAt: 1,
  postedDtm: "2026-10-22T09:00:00+09:00",
};

const TARGET: UploadTarget = {
  url: "https://bucket.test",
  fields: {
    key: "activities/take-four/strips/01J/original.jpg",
    Policy: "p",
    "X-Amz-Signature": "s",
  },
  key: "activities/take-four/strips/01J/original.jpg",
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("uploadTo", () => {
  it("fields를 먼저, file을 마지막에 붙여 url로 POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(204));
    vi.stubGlobal("fetch", fetchMock);
    const blob = new Blob(["jpg"], { type: "image/jpeg" });
    await uploadTo(TARGET, blob);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://bucket.test");
    expect(init.method).toBe("POST");
    const form = init.body as FormData;
    expect(Array.from(form.keys())).toEqual(["key", "Policy", "X-Amz-Signature", "file"]);
    expect(form.get("file")).toBeInstanceOf(Blob);
  });

  it("2xx가 아니면 던진다", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(403)));
    await expect(uploadTo(TARGET, new Blob(["x"]))).rejects.toMatchObject({ status: 403 });
  });
});

describe("wallApi (http)", () => {
  it("list: data·cursor를 items·cursor로, cursor는 쿼리로", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, { data: [VIEW], cursor: "c2" }));
    vi.stubGlobal("fetch", fetchMock);
    const page = await createWallApi("https://api.test").list("c1");
    expect(page).toEqual({ items: [VIEW], cursor: "c2" });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.test/activities/take-four/strips?cursor=c1",
    );
  });

  it("list: cursor가 없으면 null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(200, { data: [] })));
    expect(await createWallApi("https://api.test").list()).toEqual({ items: [], cursor: null });
  });

  it("get: 404 → null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(404, { error: "STRIP_NOT_FOUND", message: "없음" })),
    );
    expect(await createWallApi("https://api.test").get("x")).toBeNull();
  });

  it("create: X-Device-Token을 달아 POST, data를 돌려준다", async () => {
    const created = { stripId: "01J", uploads: { original: TARGET, thumb: TARGET } };
    const fetchMock = vi.fn().mockResolvedValue(response(201, { data: created }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await createWallApi("https://api.test").create()).toEqual(created);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/activities/take-four/strips");
    expect(init.method).toBe("POST");
    expect(init.headers["X-Device-Token"]).toBe(getDeviceToken());
  });

  it("confirm: /{id}/confirm POST → StripView", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, { data: VIEW }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await createWallApi("https://api.test").confirm("01J")).toEqual(VIEW);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.test/activities/take-four/strips/01J/confirm",
    );
  });

  it("confirm: 409 UPLOAD_MISSING → 그 코드로 던진다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response(409, { error: "UPLOAD_MISSING", message: "없음" })),
    );
    await expect(createWallApi("https://api.test").confirm("01J")).rejects.toMatchObject({
      code: "UPLOAD_MISSING",
      status: 409,
    });
  });

  it("ribbon: PUT → 리본 수", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, { data: { ribbons: 3 } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await createWallApi("https://api.test").ribbon("01J")).toBe(3);
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
    expect(fetchMock.mock.calls[0][1].headers["X-Device-Token"]).toBe(getDeviceToken());
  });

  it("report·remove: 204 → 끝, 메서드와 기기 토큰", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(204));
    vi.stubGlobal("fetch", fetchMock);
    const api = createWallApi("https://api.test");
    await api.report("01J");
    await api.remove("01J");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.test/activities/take-four/strips/01J/report",
    );
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
    expect(fetchMock.mock.calls[1][1].headers["X-Device-Token"]).toBe(getDeviceToken());
  });
});

describe("wallApi (mock)", () => {
  it("만들기 → 업로드 두 번 → 확정 → 목록 맨 앞", async () => {
    const api = createMockWallApi();
    const { stripId: id, uploads } = await api.create();
    await api.upload(uploads.original, new Blob(["o"], { type: "image/jpeg" }));
    await api.upload(uploads.thumb, new Blob(["t"], { type: "image/jpeg" }));
    const view = await api.confirm(id);
    expect(view).toMatchObject({ stripId: id, serial: 1, ribbons: 0 });
    expect(view.thumbUrl).toMatch(/^data:image\/jpeg/);
    expect((await api.list()).items[0].stripId).toBe(id);
    expect(await api.get(id)).toEqual(view);
  });

  it("업로드 없이 확정 → 409 UPLOAD_MISSING", async () => {
    const api = createMockWallApi();
    const { stripId } = await api.create();
    await expect(api.confirm(stripId)).rejects.toMatchObject({ code: "UPLOAD_MISSING" });
  });
});

describe("selectWallApi", () => {
  it("운영 + 주소 없음 → 빈 벽, 붙이기는 던진다(가짜 네컷 금지)", async () => {
    const api = selectWallApi(undefined, "production");
    expect(await api.list()).toEqual({ items: [], cursor: null });
    expect(await api.get("x")).toBeNull();
    await expect(api.create()).rejects.toBeTruthy();
  });

  it("주소 있음 → http", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, { data: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await selectWallApi("https://api.test", "production").list();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
