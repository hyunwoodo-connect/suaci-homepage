import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ko from "@/messages/ko.json";

const { uploadClaimPhoto, prepareClaimPhoto } = vi.hoisted(() => ({
  uploadClaimPhoto: vi.fn(),
  prepareClaimPhoto: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ api: { uploadClaimPhoto } }));
vi.mock("@/lib/claims/photo", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/claims/photo")>()),
  prepareClaimPhoto,
}));

import PhotoPicker from "./PhotoPicker";

const onChange = vi.fn();
const onBusyChange = vi.fn();

function renderPicker() {
  return render(
    <NextIntlClientProvider locale="ko" messages={ko}>
      <PhotoPicker orderId="o1" onChange={onChange} onBusyChange={onBusyChange} />
    </NextIntlClientProvider>,
  );
}

const file = (name: string) => new File(["x"], name, { type: "image/jpeg" });

/** 파일 고르기 — 받은 파일들을 input 에 넣고 change */
function pick(input: HTMLElement, files: File | File[]) {
  const list = Array.isArray(files) ? files : [files];
  act(() => {
    fireEvent.change(input, { target: { files: list } });
  });
}

describe("PhotoPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
    prepareClaimPhoto.mockImplementation((f: File) => Promise.resolve(new Blob([f.name])));
  });

  it("고르면 다시 그려(사진 정보 떼기) 올리고, 다 올라간 ID 를 넘긴다 — 올리는 동안 바쁨", async () => {
    let finish: (id: string) => void = () => undefined;
    uploadClaimPhoto.mockImplementationOnce(
      () => new Promise<string>((resolve) => (finish = resolve)),
    );
    renderPicker();
    pick(screen.getByLabelText(/사진 고르기/), file("a.jpg"));
    expect(prepareClaimPhoto).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(true));
    expect(screen.getByText("올리는 중")).toBeTruthy();
    await act(async () => finish("ID1"));
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(["ID1"]));
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
    expect(uploadClaimPhoto).toHaveBeenCalledWith("o1", expect.any(Blob));
  });

  it("3장까지만 — 더 고르면 앞의 것만, 다 차면 고르기 칸이 사라진다", async () => {
    uploadClaimPhoto
      .mockResolvedValueOnce("ID1")
      .mockResolvedValueOnce("ID2")
      .mockResolvedValueOnce("ID3");
    renderPicker();
    pick(screen.getByLabelText(/사진 고르기/), [
      file("a.jpg"),
      file("b.jpg"),
      file("c.jpg"),
      file("d.jpg"),
    ]);
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(["ID1", "ID2", "ID3"]));
    expect(uploadClaimPhoto).toHaveBeenCalledTimes(3);
    expect(screen.queryByLabelText(/사진 고르기/)).toBeNull();
  });

  it("못 올린 사진 → '못 올렸어요', 빼면 다시 고를 수 있다", async () => {
    uploadClaimPhoto.mockRejectedValueOnce(new Error("s3"));
    renderPicker();
    pick(screen.getByLabelText(/사진 고르기/), file("a.jpg"));
    expect(await screen.findByText("못 올렸어요")).toBeTruthy();
    expect(onChange).toHaveBeenLastCalledWith([]);
    fireEvent.click(screen.getByRole("button", { name: "사진 1 빼기" }));
    expect(screen.queryByText("못 올렸어요")).toBeNull();
    expect(screen.getByLabelText(/사진 고르기 \(3장 더\)/)).toBeTruthy();
  });

  it("다시 그리지 못하는 파일(이미지가 아님) → 못 올렸어요, 올리지 않는다", async () => {
    prepareClaimPhoto.mockRejectedValueOnce(new Error("decode"));
    renderPicker();
    pick(screen.getByLabelText(/사진 고르기/), file("a.jpg"));
    expect(await screen.findByText("못 올렸어요")).toBeTruthy();
    expect(uploadClaimPhoto).not.toHaveBeenCalled();
  });
});
