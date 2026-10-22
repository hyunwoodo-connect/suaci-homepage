export type ShareResult = "shared" | "downloaded" | "cancelled";

/**
 * 파일 공유가 되는 폰이면 공유 시트, 아니면(PC 크롬·구형 브라우저) 내려받기.
 * 사용자가 시트를 닫거나 앞선 공유가 아직 열려 있으면 cancelled. 공유가 다른 이유로 실패하면 내려받기로 넘어간다.
 */
export async function shareOrDownload(blob: Blob, filename: string): Promise<ShareResult> {
  const file = toFile(blob, filename);
  return shareFilesOrDownload([[file]], file);
}

/**
 * 완성 화면 `공유하기`. 스토리(9:16)와 카드를 같이 보낼 수 있으면 둘 다, 안 되면 스토리만,
 * 파일 공유가 아예 안 되면 스토리를 내려받는다.
 */
export async function shareStoryOrDownload(
  story: { blob: Blob; filename: string },
  strip: { blob: Blob; filename: string },
): Promise<ShareResult> {
  const storyFile = toFile(story.blob, story.filename);
  const stripFile = toFile(strip.blob, strip.filename);
  return shareFilesOrDownload([[storyFile, stripFile], [storyFile]], storyFile);
}

/** 후보 파일 묶음 중 이 브라우저가 공유할 수 있는 첫 묶음. 없으면 null(→ 내려받기). */
export function pickShareFiles(candidates: File[][]): File[] | null {
  if (typeof navigator.canShare !== "function") return null;
  return candidates.find((files) => navigator.canShare({ files })) ?? null;
}

/** `<a download>`로 내려받기. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  // 바로 지우면 일부 브라우저(사파리)가 받기 전에 URL을 잃는다
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/* ─── 내부 ─────────────────────────── */

function toFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}

async function shareFilesOrDownload(candidates: File[][], download: File): Promise<ShareResult> {
  const files = pickShareFiles(candidates);
  if (files) {
    try {
      await navigator.share({ files });
      return "shared";
    } catch (error) {
      // AbortError: 시트를 닫음. InvalidStateError: 앞선 공유가 아직 열려 있음 — 둘 다 내려받지 않는다
      if (
        error instanceof DOMException &&
        (error.name === "AbortError" || error.name === "InvalidStateError")
      ) {
        return "cancelled";
      }
    }
  }
  downloadBlob(download, download.name);
  return "downloaded";
}
