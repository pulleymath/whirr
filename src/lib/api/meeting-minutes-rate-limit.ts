/**
 * 동일 클라이언트 키(IP 등)에 대한 회의록 API 호출 빈도 제한.
 * 서버리스/멀티 인스턴스에서는 인스턴스별 메모리라 완전한 전역 한도는 아니다.
 */

const buckets = new Map<string, number[]>();

export function resetMeetingMinutesRateLimitForTests() {
  buckets.clear();
}

function prune(timestamps: number[], windowMs: number, now: number): number[] {
  const cutoff = now - windowMs;
  return timestamps.filter((t) => t > cutoff);
}

export function isMeetingMinutesRateLimited(
  clientKey: string,
  nowMs: number = Date.now(),
): boolean {
  const max = Math.max(
    1,
    Number(process.env.MEETING_MINUTES_RATE_LIMIT_MAX ?? 40),
  );
  const windowMs = Math.max(
    60_000,
    Number(process.env.MEETING_MINUTES_RATE_LIMIT_WINDOW_MS ?? 600_000),
  );

  let ts = buckets.get(clientKey) ?? [];
  ts = prune(ts, windowMs, nowMs);

  if (ts.length >= max) {
    buckets.set(clientKey, ts);
    return true;
  }

  ts.push(nowMs);
  buckets.set(clientKey, ts);
  return false;
}
