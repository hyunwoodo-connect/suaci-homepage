import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import AlbumScreen from "./AlbumScreen";

const album = vi.hoisted(() => ({ loadAlbumFrame: vi.fn() }));
vi.mock("./albumFrame", () => album);

function frame(name: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 960;
  canvas.dataset.name = name;
  canvas.toDataURL = () => `data:image/jpeg;base64,${name}`;
  return canvas;
}

function input() {
  return document.querySelector<HTMLInputElement>('input[type="file"]')!;
}

async function pick(slotName: RegExp, fileName: string) {
  fireEvent.click(screen.getByRole("button", { name: slotName }));
  await act(async () => {
    fireEvent.change(input(), { target: { files: [new File(["x"], fileName)] } });
  });
}

beforeEach(() => {
  album.loadAlbumFrame.mockReset().mockImplementation(async (file: File) => frame(file.name));
  vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AlbumScreen", () => {
  it("처음 → 빈 칸 넷, 0 / 4, `4장 더`(못 누름), 사진만 받는 file 입력", () => {
    render(<AlbumScreen slug="take-four" onDone={vi.fn()} />);
    for (const name of ["무표정", "살짝 미소", "방긋", "박장대소"]) {
      expect(screen.getByRole("button", { name: `${name} 칸에 사진 넣기` })).toBeInTheDocument();
    }
    expect(screen.getByText("0 / 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4장 더" })).toBeDisabled();
    expect(input()).toHaveAttribute("accept", "image/*");
  });

  it("칸을 누르면 앨범(file 입력)이 열린다", () => {
    render(<AlbumScreen slug="take-four" onDone={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "방긋 칸에 사진 넣기" }));
    expect(HTMLInputElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it("네 장 채움 → 인화하기, 칸 순서대로 넘긴다", async () => {
    const onDone = vi.fn();
    render(<AlbumScreen slug="take-four" onDone={onDone} />);
    await pick(/박장대소/, "d");
    await pick(/무표정/, "a");
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2장 더" })).toBeDisabled();
    await pick(/방긋/, "c");
    await pick(/살짝 미소/, "b");
    fireEvent.click(screen.getByRole("button", { name: "인화하기" }));
    const frames = onDone.mock.calls[0][0] as HTMLCanvasElement[];
    expect(frames.map((f) => f.dataset.name)).toEqual(["a", "b", "c", "d"]);
  });

  it("찬 칸을 누름 → 그 칸 사진을 바꾸고, 바뀐 캔버스는 비운다", async () => {
    const onDone = vi.fn();
    render(<AlbumScreen slug="take-four" onDone={onDone} />);
    for (const [slot, name] of [
      [/무표정/, "a"],
      [/살짝 미소/, "b"],
      [/방긋/, "c"],
      [/박장대소/, "d"],
    ] as const) {
      await pick(slot, name);
    }
    const old = (await album.loadAlbumFrame.mock.results[1].value) as HTMLCanvasElement;
    await pick(/살짝 미소 사진 바꾸기/, "b2");
    expect(old.width).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "인화하기" }));
    const frames = onDone.mock.calls[0][0] as HTMLCanvasElement[];
    expect(frames.map((f) => f.dataset.name)).toEqual(["a", "b2", "c", "d"]);
  });

  it("못 여는 사진(HEIC) → 안내 문구, 칸은 비어 있다", async () => {
    album.loadAlbumFrame.mockRejectedValue(new Error("heic"));
    render(<AlbumScreen slug="take-four" onDone={vi.fn()} />);
    await pick(/무표정/, "photo.heic");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "이 사진은 열 수 없어요. 다른 사진을 골라 주세요.",
    );
    expect(screen.getByRole("button", { name: "무표정 칸에 사진 넣기" })).toBeInTheDocument();
  });

  it("다시 고르기로 돌아옴(initialFrames) → 네 칸이 찬 채로", () => {
    render(
      <AlbumScreen
        slug="take-four"
        onDone={vi.fn()}
        initialFrames={["a", "b", "c", "d"].map(frame)}
      />,
    );
    expect(screen.getByText("4 / 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "인화하기" })).toBeEnabled();
  });

  it("뒤로 → 카메라 없을 때 화면", () => {
    render(<AlbumScreen slug="take-four" onDone={vi.fn()} />);
    expect(screen.getByRole("link", { name: "뒤로" })).toHaveAttribute(
      "href",
      "/events/take-four/no-camera",
    );
  });

  it("여는 중 → 칸은 aria-disabled(포커스 유지), 눌러도 앨범을 또 열지 않는다", async () => {
    let finish: (c: HTMLCanvasElement) => void = () => {};
    album.loadAlbumFrame.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    render(<AlbumScreen slug="take-four" onDone={vi.fn()} />);
    const first = screen.getByRole("button", { name: "무표정 칸에 사진 넣기" });
    first.focus();
    fireEvent.click(first);
    await act(async () => {
      fireEvent.change(input(), { target: { files: [new File(["x"], "a")] } });
    });
    const other = screen.getByRole("button", { name: "방긋 칸에 사진 넣기" });
    expect(other).toHaveAttribute("aria-disabled", "true");
    expect(other).toBeEnabled();
    expect(document.activeElement).toBe(first);
    fireEvent.click(other);
    expect(HTMLInputElement.prototype.click).toHaveBeenCalledTimes(1);
    await act(async () => finish(frame("a")));
    expect(other).toHaveAttribute("aria-disabled", "false");
  });
});
