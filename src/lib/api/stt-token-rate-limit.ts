/**
 * 동일 클라이언트 키(예: IP)에 대한 STT 토큰 요청 빈도 제한.
 * 서버리스/멀티 인스턴스에서는 인스턴스별 메모리라 완전한 전역 한도는 아니다.
 */

const buckets = new Map<string, number[]>();

export function resetSttTokenRateLimitForTests() {
  buckets.clear();
}

function prune(timestamps: number[], windowMs: number, now: number): number[] {
  const cutoff = now - windowMs;
  return timestamps.filter((t) => t > cutoff);
}

export function getClientKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) {
    return realIp;
  }
  return "unknown";
}

/**
 * 한도를 넘기면 true (429 응답 권장).
 */
export function isSttTokenRateLimited(
  clientKey: string,
  nowMs: number = Date.now(),
): boolean {
  const max = Math.max(1, Number(process.env.STT_TOKEN_RATE_LIMIT_MAX ?? 60));
  const windowMs = Math.max(
    60_000,
    Number(process.env.STT_TOKEN_RATE_LIMIT_WINDOW_MS ?? 600_000),
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
