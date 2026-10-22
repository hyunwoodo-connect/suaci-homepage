export type ShareResult = "shared" | "downloaded" | "cancelled";

/**
 * 파일 공유가 되는 폰이면 공유 시트, 아니면(PC 크롬·구형 브라우저) 내려받기.
 * 사용자가 시트를 닫거나 앞선 공유가 아직 열려 있으면 cancelled. 공유가 다른 이유로 실패하면 내려받기로 넘어간다.
 */
export async function shareOrDownload(blob: Blob, filename: string): Promise<ShareResult> {
  const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
  const data: ShareData = { files: [file] };
  if (typeof navigator.canShare === "function" && navigator.canShare(data)) {
    try {
      await navigator.share(data);
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
  downloadBlob(blob, filename);
  return "downloaded";
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
