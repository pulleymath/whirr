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

/**
 * 여러 오디오 세그먼트를 순차적으로 다운로드합니다.
 */
export function downloadRecordingSegments(
  blobs: Blob[],
  prefix: string = "recording",
): void {
  blobs.forEach((blob, index) => {
    const segmentNumber = String(index + 1).padStart(3, "0");
    // Windows 등 일부 OS에서 파일명에 ':' 문자가 포함되면 문제가 될 수 있으므로 치환합니다.
    const safePrefix = prefix.replace(/:/g, "-");
    const filename = `${safePrefix}-segment-${segmentNumber}.webm`;
    triggerBlobDownload(blob, filename);
  });
}
