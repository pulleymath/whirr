---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: security-reviewer
  feature: "recorder-pre-recording-context"
  review_kind: security
---

# Security & Performance Review

## 요약

본 브랜치는 클라이언트 상태·UI 가시성만 바꾸며, 기존과 동일하게 `sessionContext`/`meetingTemplate`는 서버(`/api/meeting-minutes`)에서 타입·길이 검증 후 LLM 파이프라인으로 전달된다. **새 비밀 노출·XSS·저장 경로상의 입력 로깅은 확인되지 않았다.** 저장 실패 시 초기화 미호출 및 배치 재시도(`handleBatchRetry` → `persistBatchResult`) 성공 시 초기화 흐름은 코드상 일관된다.

## 보안 발견 사항

### [LOW] 저장 실패 시 `console.error`에 예외 메시지 기록

- 위치: `src/components/recorder.tsx` (대략 229, 284, 329행 근방 `catch` 블록)
- 분류: data-handling
- 위험: `e instanceof Error ? e.message : String(e)`가 **사용자가 타이핑한 참석자·주제·키워드**를 직접 실어 보내는 경로는 아니나(대개 `saveSession`/`IndexedDB` 계열 메시지), 배포 환경에서 콘솔·로깅 싱크가 수집되면 **내부/구현 상세가 메타데이터 형태로 유출**될 수 있다. 사용자 입력은 해당 `console.error` 줄에 포함되지 않는다.
- 조치: 프로덕션에서는 민감·내부 구조를 줄인 정적 코드(예: `"[session-storage] save failed"`)만 남기거나, PII 정책에 맞춰 서버/클라이언트 로그 레벨·샘플링을 조정한다.

### [LOW] LLM에 전달되는 회의 컨텍스트의 프롬프트 인젝션(잔여 위험, 본 diff로 악화 없음)

- 위치: 클라 → `enqueuePipeline` 본문(JSON) (`src/lib/post-recording-pipeline/context.tsx` 179–190행 근방) → `src/app/api/meeting-minutes/route.ts`의 `parseSessionContext` 및 `generateMeetingMinutes`
- 분류: data-handling
- 위험: API는 문자열 타입 및 `MEETING_MINUTES_MAX_SESSION_CONTEXT_FIELD_LENGTH`로 **길이만** 제한하며, **의미·지시문(neutralization) sanitization은 하지 않는다.** 따라서 사용자가 악의적 지시 텍스트를 넣어 모델 동작을 흔들 **프롬프트 인젝션 가능성**은 아키텍처상 존재한다. idle에서 입력 가능해진 것은 노출/UI일 뿐, **종료 후 동일 페이로드 경로로 전달되는 점에서 공격 면 자체가 넓어졌다고 보기 어렵다** (다만 입력 기회만 늘어난다는 UX 관점은 있음).
- 조치: 시스템/유저 역할 분리, 구분자·고정 헤더, 출력 검증 등 LLM 신뢰 경계 보강(기존 권장사항·이 브랜치 범위 밖).

## 성능 발견 사항

### [LOW] idle에서 회의 정보 영역이 시각적으로 항상 “펼쳐진” 상태

- 위치: `src/components/recorder.tsx` (`showSessionContext = true`), `RevealSection` + `SessionContextInput`/`MeetingTemplateSelector` 자식 트리
- 분류: rendering
- 영향: `RevealSection`은 `visible=false`여도 자식을 **언마운트하지 않고** `h-0`/`inert`/숨김만 적용했다(`src/components/recorder-reveal-section.tsx`). 따라서 **idle에서도 이전부터 동일 서브트리가 마운트되어 있었고**, React 트리 비용 급증은 크지 않다. 다만 **실제 높이·페인트·히트 테스트 대상이 되므로** 이전보다 레이아웃/컴포지팅 및 스크롤 가능 영역은 커진다.
- 제안: 병목으로 보일 때만(프로파일링 후) 회의 카드 접기 기본값, 지연 마운트 등을 검토; 현재 변경만으로는 **치명적 병목으로 보이지 않는다.**

### [LOW] idle에서 회의 정보 필드 타이핑으로 인한 `Recorder` 재렌더 빈도

- 위치: `sessionContext`/`meetingTemplate` state와 연동되는 `persistBatchResult`·`stop`의 의존성 배열 (`recorder.tsx`)
- 분류: rendering
- 영향: 녹음 **전**부터 필드 수정이 가능해져, 키 입력마다 부모 재렌더가 발생할 수 있다. `persistBatchResult` 등은 기존부터 `sessionContext`/`meetingTemplate`를 deps에 두었을 가능성이 높아 **패턴 자체의 변화는 제한적**이며, `resetSessionInputs`는 `[]` 의존 `useCallback`으로 **stale closure 유발 요인은 추가되지 않는다.**
- 제언: 불필요한 핸들러 재생성·하위 트리 전파 비용이 측정상 문제일 때만 `SessionContextInput` 쪽 로컬 state + 커밋 패턴 등을 검토(스코프 확대 시).

## Verdict

**PASS_WITH_NOTES**
