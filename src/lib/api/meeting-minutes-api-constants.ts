/** 회의록 API에 허용하는 스크립트 본문 최대 길이(문자 수). 파이프라인에서 클라이언트 상한을 두지 않으므로 서버에서 방어한다. */
export const MEETING_MINUTES_MAX_TEXT_LENGTH = 500_000;

/** glossary 항목 최대 개수 */
export const MEETING_MINUTES_MAX_GLOSSARY_ITEMS = 200;

/** sessionContext 각 문자열 필드 최대 길이 */
export const MEETING_MINUTES_MAX_SESSION_CONTEXT_FIELD_LENGTH = 2000;

/** glossary 단일 항목 최대 길이(문자 수) */
export const MEETING_MINUTES_MAX_GLOSSARY_TERM_LENGTH = 500;
