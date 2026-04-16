import {
  MEETING_MINUTES_CHUNK_CHAR_LIMIT,
  MEETING_MINUTES_CHUNK_OVERLAP,
} from "./constants";

function findLastSentenceBreak(slice: string, minIndex: number): number {
  const re = /[.!?。！？](?:\s|$)|[\r\n]{2,}/g;
  let last = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(slice)) !== null) {
    const end = m.index + m[0].length;
    if (end > minIndex && end <= slice.length) {
      last = end;
    }
  }
  return last;
}

/**
 * 긴 스크립트를 회의록 map 단계용 청크로 나눈다. 문장 경계를 우선하고, 없으면 길이에서 자른다.
 */
export function chunkText(
  text: string,
  options?: { chunkSize?: number; overlap?: number },
): string[] {
  const chunkSize = options?.chunkSize ?? MEETING_MINUTES_CHUNK_CHAR_LIMIT;
  const overlap = options?.overlap ?? MEETING_MINUTES_CHUNK_OVERLAP;
  const t = text.trim();
  if (t.length === 0) {
    return [];
  }
  if (t.length <= chunkSize) {
    return [t];
  }

  const out: string[] = [];
  let start = 0;
  while (start < t.length) {
    let end = Math.min(start + chunkSize, t.length);
    if (end < t.length) {
      const slice = t.slice(start, end);
      const minBreak = Math.floor(chunkSize * 0.35);
      const br = findLastSentenceBreak(slice, minBreak);
      if (br > 0) {
        end = start + br;
      }
    }
    out.push(t.slice(start, end));
    if (end >= t.length) {
      break;
    }
    start = Math.max(end - overlap, start + 1);
  }
  return out;
}
