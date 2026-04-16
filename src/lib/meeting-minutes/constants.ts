/** 한 청크 최대 문자 수(한국어 기준 대략적인 토큰 상한). */
export const MEETING_MINUTES_CHUNK_CHAR_LIMIT = 12_000;

/** 청크 간 맥락 유지용 오버랩(문자 수). */
export const MEETING_MINUTES_CHUNK_OVERLAP = 200;

/** map 단계에서 동시에 호출할 Chat Completions 최대 개수(레이트·부하 완화). */
export const MEETING_MINUTES_MAP_CONCURRENCY = 4;
