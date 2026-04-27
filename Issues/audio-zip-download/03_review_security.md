---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  feature: audio-zip-download
  review_kind: security
---

# Security & Performance Review

## Summary

클라이언트 전용 ZIP 생성·다운로드 흐름은 서버 업로드나 DOM HTML 삽입 경로가 없어 공격 면이 작다. `fflate`는 `npm audit` 기준 신규 취약점으로 잡히지 않았다. 다만 `zipSync`와 전 구간 `arrayBuffer()`로 긴 녹음에서 메인 스레드 정지와 메모리 피크가 커질 수 있다.

## Security Findings

### [LOW] ZIP 엔트리 이름·다운로드 파일명의 특수 문자

- Location: `src/lib/download-recording.ts` (대략 22–38, 52–60행)
- Category: input-validation
- Risk: `sanitizePrefix`가 `:`, `/`, `\`, 제어 문자는 제거·치환하지만 `..`, 유니코드 경로 구분자 변종, RTL 제어 문자 등은 그대로 남을 수 있다. 현재 엔트리는 `prefix-segment-NNN.webm` 한 단계라 클라이언트 생성 ZIP 자체의 “zip slip”은 해당 없음에 가깝다. 다만 수신 측 도구나 OS가 이상한 파일명을 어떻게 처리하느냐는 제품 정책 차원에서만 검토하면 된다.
- Remediation: 필요 시 `..` 연속 제거, 허용 문자 화이트리스트(예: `[a-zA-Z0-9._-]+`), 또는 `session.id`만 ASCII로 정규화하는 추가 규칙을 적용한다.

### [LOW] 의존성 공급망

- Location: `package.json` (`fflate` ^0.8.2)
- Category: dependency
- Risk: `fflate`는 순수 JS 압축 라이브러리로 일반적으로 신뢰도가 높다. 이번 `npm audit` 결과에는 `fflate` 관련 권고가 없었다(다른 직·간접 의존성 이슈는 기존과 동일).
- Remediation: 릴리스 전 `npm audit`·lockfile 고정 유지, 주기적 업데이트.

### [정보] XSS·비밀 노출·로깅

- Location: `src/components/session-detail.tsx`, `src/lib/download-recording.ts`
- Category: data-handling / auth
- Risk: 다운로드 UI는 정적 라벨이며 `dangerouslySetInnerHTML` 없음. ZIP은 로컬 Blob만 사용. 에러/성공 경로에 오디오 내용·세션 데이터를 로그로 남기지 않음.
- Remediation: 현재 설계 유지.

## Performance Findings

### [HIGH] 동기 압축으로 인한 메인 스레드 블로킹

- Location: `src/lib/download-recording.ts` 58행 (`zipSync`)
- Category: rendering (UX/반응성)
- Impact: 세그먼트 총량이 크면 압축이 한 번에 CPU를 많이 쓰며 UI가 멈춘 것처럼 보일 수 있다. “ZIP 생성 중…” 스피너도 메인 스레드가 막히면 덜 부드럽게 갱신될 수 있다.
- Suggestion: Worker에서 `zipSync` 실행, 또는 스트리밍/청크 API(`fflate`의 비동기·스트림 계열)로 분할 처리. 최소한 `requestIdleCallback`/`setTimeout(0)`으로 청크 간 양보는 제한적 완화에 그칠 수 있음.

### [HIGH] 메모리 중복(원본 + ZIP)

- Location: `src/lib/download-recording.ts` 53–59행
- Category: memory
- Impact: 각 세그먼트를 `arrayBuffer()`로 전부 메모리에 올리고, `zipSync` 결과 `Uint8Array`를 또 보유한 뒤 `Blob`으로 감싼다. 녹음이 수백 MB에 가까우면 탭 OOM 위험이 커진다.
- Remediation: 스트리밍 ZIP 생성(가능한 라이브러리/Worker), 또는 세그먼트 수·총 크기 상한과 사용자 경고. 다운로드 후 참조 해제로 GC에 맡기기(현재 Blob은 다운로드 트리거 후 범위를 벗어나면 수집 가능).

### [LOW] `revokeObjectURL` 타이밍

- Location: `src/lib/download-recording.ts` 15–19행
- Category: memory
- Impact: 100ms 지연 후 해제는 대부분 브라우저에서 무난하나, 극단적으로 느린 환경에서는 드물게 다운로드와 경합할 여지는 있다.
- Suggestion: 문제가 보이면 `blur`/`visibilitychange` 또는 더 긴 지연과 함께 관찰 후 조정.

## Verdict

PASS_WITH_NOTES
