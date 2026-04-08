---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  feature: "feature-4-session-storage"
  review_kind: security
---

# Security & Performance Review

## Summary

클라이언트 전용 IndexedDB에 전사 텍스트만 저장하는 구조는 서버 유출 면에서는 비교적 단순하나, 디바이스 내 평문 보관·로그·테스트용 API 노출 가능성은 정리할 여지가 있다. 성능 측면에서는 세션 전량 로드·메모리 정렬이 세션이 많아질 때 병목이 될 수 있다.

## Security Findings

### [MEDIUM] 로컬 저장소에 전사 텍스트 평문 보관

- Location: `src/lib/db.ts` (`saveSession`, 스키마 `text`)
- Category: data-handling
- Risk: IndexedDB는 같은 프로필/브라우저에서 다른 사이트 스크립트와는 격리되지만, 기기 공유·악성 확장·로컬 접근 시나리오에서는 민감한 음성 전사가 평문으로 남는다. 규제·프라이버시 요구가 높은 제품이면 위험도가 올라간다.
- Remediation: 제품 정책상 필요하면 저장 전 암호화(사용자 비밀번호 기반 키 등), 보관 기간·삭제 UX, 민감 정보 경고 문구를 검토한다. (스코프 밖이면 위험을 문서화만 해도 된다.)

### [LOW] `resetWhirrDbForTests`가 프로덕션 DB 모듈에서 export됨

- Location: `src/lib/db.ts` (대략 37–48행)
- Category: data-handling / auth(가용성)
- Risk: 현재는 클라이언트가 `saveSession`만 가져오므로 트리 셰이킹으로 번들에서 빠질 가능성이 크다. 다만 동일 모듈을 통째로 import하거나 배럴 재export가 생기면 테스트용 전체 DB 삭제 API가 런타임에 노출될 수 있어, 실수나 악용 시 사용자 로컬 데이터가 한 번에 지워질 수 있다.
- Remediation: 테스트 전용 파일(예: `db.test-utils.ts`)로 분리하거나, 프로덕션 빌드에서 제외되는 패턴으로만 export한다.

### [LOW] 저장 실패 시 `console.error`에 원본 에러 객체 전달

- Location: `src/components/recorder.tsx` (대략 47–48행)
- Category: data-handling
- Risk: 브라우저 콘솔에는 스택 등이 보일 수 있고, 이후 APM/Sentry 등에 콘솔을 붙이면 내부 메시지가 수집될 수 있다. 전사 본문은 직접 넣지 않아도, 환경에 따라 로그 정책과 맞지 않을 수 있다.
- Remediation: 사용자 노출용은 짧은 코드만, 디버그는 개발 환경에서만 상세 로그하거나 `String(e)` 수준으로 제한한다.

### [LOW] `idb` 신규 의존성

- Location: `package.json` (`idb ^8.0.3`)
- Category: dependency
- Risk: 일반적으로 유지보수되는 라이브러리이나, 공급망 취약점은 주기적 점검이 필요하다.
- Remediation: `npm audit` / Dependabot 등으로 정기 점검을 유지한다.

## Performance Findings

### [MEDIUM] `getAllSessions`가 전체 세션을 메모리로 가져와 정렬

- Location: `src/lib/db.ts` (대략 66–69행)
- Category: storage / memory
- Impact: `getAllFromIndex`로 스토어 전체를 한 번에 로드한 뒤 `[...rows].sort`로 다시 정렬한다. 세션 수가 커지면 메모리·CPU가 선형~`n log n`으로 증가하고, UI에서 목록을 열 때마다 반복 호출되면 체감 지연이 난다.
- Remediation: 목록 UI가 생기면 커서/페이지네이션, 인덱스 역방향 순회(가능 시), 또는 상한(예: 최근 N개만 조회)을 도입한다.

### [LOW] 세션 텍스트 길이·개수에 대한 상한 없음

- Location: `src/lib/db.ts` `saveSession`, `src/components/recorder.tsx` `trimmed` 저장 경로
- Category: storage
- Risk: 악의적 입력이라기보다 아주 긴 녹음/전사가 반복되면 QuotaExceededError·전체 DB 비대화로 이어져 같은 탭/기기에서 저장 실패나 느려짐이 난다.
- Remediation: 저장 전 최대 길이(문자/바이트) 제한, 오래된 세션 자동 정리, 또는 사용자에게 용량 안내를 고려한다.

### [LOW] 싱글톤 `openDB` Promise 캐시

- Location: `src/lib/db.ts` (대략 21–34행)
- Category: network(연결) / storage
- Impact: 반복 `openDB`를 막아 호출 경로가 많아질 때 유리하다. 현재 사용 패턴에서는 긍정적이다.
- Suggestion: 유지한다. DB 업그레이드/마이그레이션 시 `dbPromise` 무효화 전략만 장기적으로 일관되게 두면 된다.

## Verdict

PASS_WITH_NOTES
