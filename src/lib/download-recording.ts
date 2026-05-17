import { zipSync } from "fflate";

/**
 * Blob을 브라우저에서 다운로드하도록 트리거합니다.
 */
export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();

  // 약간의 지연 후 정리 (일부 브라우저에서 즉시 호출 시 다운로드 실패 방지)
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function sanitizePrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (trimmed.length === 0) {
    return "recording";
  }
  const replaced = trimmed
    .replace(/[:/\\]/g, "_")
    .replace(/[\u0000-\u001f]/g, "_");
  if (!/[^_]/.test(replaced)) {
    return "recording";
  }
  return replaced;
}

function segmentEntryName(safePrefix: string, index: number): string {
  const segmentNumber = String(index + 1).padStart(3, "0");
  return `${safePrefix}-segment-${segmentNumber}.webm`;
}

/**
 * 녹음 세그먼트 Blob들로 zip Blob과 저장 파일명을 만든다. (단위 테스트·검증용)
 */
export async function buildRecordingZipBlob(
  blobs: Blob[],
  prefix: string = "recording",
): Promise<{ zipBlob: Blob; filename: string }> {
  if (blobs.length === 0) {
    throw new Error("buildRecordingZipBlob: blobs must be non-empty");
  }
  const safePrefix = sanitizePrefix(prefix);
  const files: Record<string, Uint8Array> = {};
  for (let i = 0; i < blobs.length; i++) {
    const name = segmentEntryName(safePrefix, i);
    const buf = await blobs[i].arrayBuffer();
    files[name] = new Uint8Array(buf);
  }
  const zipped = zipSync(files);
  const zipBlob = new Blob([Uint8Array.from(zipped)], {
    type: "application/zip",
  });
  return { zipBlob, filename: `${safePrefix}-audio.zip` };
}

/**
 * 단일 WebM 오디오 Blob을 다운로드합니다.
 * `blob`이 비어 있으면 아무 작업도 하지 않습니다(예외 없음).
 */
export function downloadRecordingAudio(
  blob: Blob,
  prefix: string = "recording",
): void {
  if (blob.size === 0) {
    return;
  }
  const safePrefix = sanitizePrefix(prefix);
  triggerBlobDownload(blob, `${safePrefix}-audio.webm`);
}

/**
 * 여러 오디오 세그먼트를 하나의 zip으로 묶어 한 번만 다운로드합니다.
 * `blobs`가 비어 있으면 아무 작업도 하지 않습니다(예외 없음).
 * ZIP 바이너리만 필요하면 `buildRecordingZipBlob`를 사용하세요(비어 있으면 예외).
 */
export async function downloadRecordingZip(
  blobs: Blob[],
  prefix: string = "recording",
): Promise<void> {
  if (blobs.length === 0) {
    return;
  }
  const { zipBlob, filename } = await buildRecordingZipBlob(blobs, prefix);
  triggerBlobDownload(zipBlob, filename);
}
