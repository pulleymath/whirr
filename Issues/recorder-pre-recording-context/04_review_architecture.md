---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "recorder-pre-recording-context"
  review_kind: architecture
---

# Architecture & Code Style Review

## 요약
계획서·이슈와의 정합성은 높고, 세션 입력 초기화를 `resetSessionInputs`로 묶은 것은 중복 제거와 훅 의존성 안정화 측면에서 타당하다. 다만 `showSessionContext`가 사실상 상수가 되어 이름·표현이 약간 어긋나고, 테스트·문서는 약간의 중복·합치기가 있어 정리 여지는 남는다.

## 아키텍처 발견 사항

### [MEDIUM] `Recorder` 단일 컴포넌트에 오케스트레이션·UI 가시성·영속화가 계속 집중됨
- 위치: `src/components/recorder.tsx` (컴포넌트 전반)
- 분류: solid / structure
- 설명: 이번 변경은 `resetSessionInputs`·`showSessionContext` 상수화로 라인 수와 책임 표면이 소폭 늘었으나, 본질적으로 녹음·배치·스트리밍·저장·enqueue·폼 상태가 한 컴포넌트에 남아 단일 책임 관점의 복잡도 상한은 그대로다.
- 제안: 이번 스코프 밖이더라도 후속으로는 “세션 입력 폼 상태 + 초기화 정책”을 작은 훅(`useRecorderSessionInputs` 등)이나 인접 모듈로 옮기는 방향을 검토하면 경계가 선명해진다. 당장은 계획 범위 내 최소 변경으로 수용 가능하다.

### [LOW] 성공 경로에서 `enqueuePipeline` 직후 동기 초기화
- 위치: `src/components/recorder.tsx` (약 184–198행, 312–326행)
- 분류: pattern / coupling
- 설명: `enqueuePipeline` 호출 직후 `resetSessionInputs()`를 호출하는 순서는 계획과 일치하고, 저장 실패 시에는 해당 분기에 진입하지 않아 입력 유지와도 모순되지 않는다.
- 제안: 향후 `enqueue`가 비동기 완료를 기다리는 형태로 바뀌면 초기화 시점을 함께 재검토해야 한다는 주석 수준의 메모만 팀에 공유하면 된다(코드 주석 강제는 아님).

### [LOW] `docs/USER_FLOWS.md` §2와 §13의 주제 겹침
- 위치: `docs/USER_FLOWS.md` §2 edge case, §13
- 분류: structure
- 설명: §2에 추가된 “세션 저장 실패”는 홈 루프·enqueue 전 단계에 초점을 맞춘 것이고, §13은 IndexedDB 실패 일반이다. 상충은 없으나 동일 오류 문구가 두 절에 등장해 독자가 중복으로 느낄 수 있다.
- 제안: §2에서는 “자세한 저장 실패 분류는 §13” 한 줄로 위임하거나, §13에서 홈 경로를 §2로 교차 참조만 보강하면 문서 응집도가 좋아진다.

## 코드 스타일 발견 사항

### [MEDIUM] `showSessionContext`가 항상 `true`인데 조건부 노출 이름을 유지함
- 위치: `src/components/recorder.tsx` 375–376행, 457–458행; `src/components/recorder-ui-preview.tsx` 37–38행, 119–120행
- 분류: naming / readability
- 설명: 계획서는 `showTranscript`와 대비되는 의미론적 변수 유지를 권장했지만, 실제 값이 상수이면 “표시 여부”라는 이름이 코드를 읽는 사람에게는 조건부 플래그처럼 오해될 수 있다.
- 제안: (1) `RevealSection`에 `visible`을 `true`로 두고 주석 한 줄로 “idle부터 항상 노출”을 적거나, (2) `alwaysShowSessionContext`처럼 의도가 드러나는 이름으로 바꾸거나, (3) 향후 다시 조건부로 바뀔 여지가 있다면 지금 이름 유지도 타당하다는 팀 합의를 문서에 남긴다.

### [LOW] `resetSessionInputs`를 `useCallback(..., [])`로 둔 선택
- 위치: `src/components/recorder.tsx` 158–161행
- 분류: readability / pattern
- 설명: 본문은 `useState` setter만 호출하므로 의존성 배열 `[]`는 타당하고, `persistBatchResult`·`stop`에 넣었을 때 참조 안정성을 준다. 인라인 함수로 두면 의존성 배열에 넣을 때 매 렌더마다 상위 콜백이 바뀔 수 있어 `useCallback`은 합리적이다.
- 제안: “왜 `useCallback`인가”가 한눈에 안 들어오면, 본문 위에 한 줄만 적어도 가독성이 좋아진다(선택).

### [LOW] `persistBatchResult`·`stop` 의존성 배열에 `resetSessionInputs` 추가
- 위치: `src/components/recorder.tsx` 200–212행, 333–349행
- 분류: pattern
- 설명: `resetSessionInputs`가 안정적 참조이므로 `exhaustive-deps` 관점에서 추가는 일관되고, 누락으로 인한 stale closure 위험을 줄인다.
- 제안: 별도 조치 불필요. 리뷰 시점 기준으로 다른 누락은 두드러지지 않는다.

### [LOW] 신규 테스트의 mock 구조가 `recorder-phased-ui.test.tsx`와 평행이나 공유되지 않음
- 위치: `src/components/__tests__/recorder-pre-recording-context.test.tsx`, `recorder-phased-ui.test.tsx`
- 분류: formatting / structure
- 설명: 둘 다 `vi.hoisted`·동일 훅 mock 패턴을 따르지만, `mockEnqueue` 분리·`vi.mock("@/lib/db")` 유무 등으로 파일 간 중복이 있다. `recorder-batch.test.tsx`는 검색상 해당 트리에 없어 기준 파일은 위 두 개가 된다.
- 제안: 공통 `test-utils/recorder-mocks.ts` 같은 추출은 이슈 범위를 넘지 않으면 보류해도 되고, 테스트가 더 늘어나기 전에만 공통화를 검토하면 된다.

### [LOW] Vitest에서 `as HTMLTextAreaElement` 등 단언
- 위치: `src/components/__tests__/recorder-pre-recording-context.test.tsx` (예: 269–277행, 300–315행)
- 분류: typescript
- 설명: `getByTestId` 반환값에 대해 `.value`를 읽기 위한 단언으로 흔한 패턴이다.
- 제안: `within`·역할 기반 쿼리로 바꿔도 되나 현재 수준은 프로젝트 관행과 어긋나지 않는다.

### [LOW] `recorder-ui-preview.tsx`의 `recordingActive`와 `showSessionContext` 관계
- 위치: `src/components/recorder-ui-preview.tsx` 35–38행
- 분류: naming / readability
- 설명: `showSessionContext`는 `recordingActive`와 분리되어 항상 `true`이고, `recordingActive`는 카드·전사 등에만 쓰인다. 계획서 Step 8과 일치한다.
- 제안: 혼동을 줄이려면 `showSessionContext` 줄을 제거하고 `RevealSection visible`에 리터럴 `true`를 쓰는 편이 더 짧다(프리뷰 전용 컴포넌트이므로).

## Verdict
PASS_WITH_NOTES
