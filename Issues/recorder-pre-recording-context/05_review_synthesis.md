---
issue_driven_dev:
  source: subagent
  phase: synthesis
  subagent_type: generalPurpose
  feature: "recorder-pre-recording-context"
---

# Review Synthesis

## 종합 품질 점수

B — 구현·테스트·문서·보안·아키텍처 모두 계획서 의도에 부합하나, 신규 회귀 테스트 파일이 Git에 미추적이라 머지 전 절차적 수정이 필요하다.

## 종합 요약

세 리뷰어 모두 PASS_WITH_NOTES로 판정했으며, `showSessionContext` 상수화·`resetSessionInputs` 추출·배치/스트리밍 양쪽 성공 경로 초기화·`USER_FLOWS.md` §2 갱신은 계획·이슈와 일관되게 반영되었다. 신규 비밀 노출이나 XSS는 없고 변경으로 인한 공격 면 확대도 없다. 가장 시급한 항목은 새 테스트 파일이 워크트리에서 untracked 상태(`??`)인 점이며, 그 외에는 `showSessionContext` 네이밍 정리, `pipeline.isBusy` 비활성화 회귀 테스트 보강 정도가 권장된다.

## 통합 발견 사항

### 즉시 수정 필요 (CRITICAL/HIGH)

| #   | 발견                                                                                  | 출처 | 심각도 | 분류               |
| --- | ------------------------------------------------------------------------------------- | ---- | ------ | ------------------ |
| 1   | 신규 회귀 테스트 파일 `recorder-pre-recording-context.test.tsx`가 Git에 추적되지 않음 | impl | HIGH   | process / coverage |

#### 1. 신규 회귀 테스트 파일이 Git에 포함되지 않음

- 원본 심각도: implementation=HIGH, security=언급 없음, architecture=언급 없음
- 조정 후 심각도: HIGH (단일 출처지만 머지 시 회귀 보호가 사라지는 결과를 낳으므로 격하 없이 유지)
- 위치: 워크트리 `git status` — `?? src/components/__tests__/recorder-pre-recording-context.test.tsx`
- 액션:
  ```bash
  git add src/components/__tests__/recorder-pre-recording-context.test.tsx
  git commit -m "test(recorder): pre-recording context regression suite"
  ```
  커밋 후 `git diff main --stat`에서 신규 테스트 파일이 +로 잡히는지 확인한다. 머지 전 필수.

### 권장 개선 사항 (MEDIUM)

| #   | 발견                                                                                    | 출처 | 분류                 |
| --- | --------------------------------------------------------------------------------------- | ---- | -------------------- |
| 1   | `showSessionContext`가 항상 `true`인데 조건부 노출 이름을 유지함                        | arch | naming / readability |
| 2   | `pipeline.isBusy=true` 분기에서 회의 정보 입력 비활성·안내 회귀가 본 피쳐 테스트에 없음 | impl | coverage             |
| 3   | `Recorder` 단일 컴포넌트에 오케스트레이션·UI 가시성·영속화가 계속 집중됨                | arch | solid / structure    |

#### 1. `showSessionContext`가 사실상 상수가 된 후 네이밍·표현 정리

- 원본 심각도: architecture=MEDIUM
- 조정 후 심각도: MEDIUM (스타일 단독 이슈, 상한 유지)
- 위치: `src/components/recorder.tsx` 375–376행, 457–458행 / `src/components/recorder-ui-preview.tsx` 37–38행, 119–120행
- 액션: 셋 중 하나를 선택해 일관 적용한다. (a) `RevealSection visible={true}`로 인라인하고 위에 한 줄 주석 "idle부터 항상 노출"; (b) 변수명을 `alwaysShowSessionContext`로 변경; (c) 향후 다시 조건부로 돌아갈 가능성이 있다면 현 이름을 유지하되 결정 근거를 짧게 주석으로 남긴다. 본 컴포넌트와 프리뷰 컴포넌트에서 동일한 형태를 사용해 두 파일 간 표현이 어긋나지 않게 한다.

#### 2. `pipeline.isBusy=true` 분기의 입력 비활성·안내 회귀 테스트 보강

- 원본 심각도: implementation=MEDIUM
- 조정 후 심각도: MEDIUM (정확성/회귀 사안이라 구현 리뷰어 의견 우선)
- 위치: `src/components/recorder.tsx` `SessionContextInput`·`MeetingTemplateSelector`의 `disabled={pipeline.isBusy}` (대략 461–469행 인근), 신규 테스트 `src/components/__tests__/recorder-pre-recording-context.test.tsx`
- 액션: 본 피쳐 테스트 파일에 `mocks.pipeline.isBusy = true`로 바꾼 단발 케이스를 추가해 `session-context-input` 또는 회의록 형식 선택기가 `disabled`인지(또는 안내 문구가 노출되는지)를 단언한다. idle에서 입력 노출이 항상 켜진 만큼 "바쁠 때 비활성" 정책이 회귀 보호 없이는 깨질 위험이 커졌다.

#### 3. `Recorder` 컴포넌트 책임 집중 (후속 작업 후보)

- 원본 심각도: architecture=MEDIUM
- 조정 후 심각도: MEDIUM (이번 스코프 밖 권고로 유지)
- 위치: `src/components/recorder.tsx` 컴포넌트 전반
- 액션: 본 PR에서는 변경하지 않는다. 다만 별도 후속 이슈로 "세션 입력 폼 상태 + 초기화 정책"을 `useRecorderSessionInputs` 같은 훅으로 분리하는 리팩터링 작업을 등록해 두면 좋다(이슈 트래커에 메모 수준이면 충분).

### 선택 개선 사항 (LOW)

- 스트리밍 모드 `saveSession` 실패 시 입력 유지 회귀 테스트 한 건 추가 (impl).
- Step 7 테스트를 계획서 표(케이스 10·11) 숫자에 맞춰 `it` 두 개로 분리 (impl, 선택).
- 프로덕션 `console.error`에 동적 예외 메시지 대신 정적 코드(`"[session-storage] save failed"`) 또는 PII 정책에 맞춘 로그 레벨 적용 (security, data-handling).
- LLM 프롬프트 인젝션 잔여 위험은 본 diff로 악화 없음. 시스템/유저 역할 분리·구분자·출력 검증은 별도 이슈로 분리 (security).
- `RevealSection`은 `visible=false`여도 자식을 언마운트하지 않으므로 idle 항상 노출의 추가 렌더 비용은 작음. 측정상 병목으로 드러나면 lazy mount·접기 기본값 검토 (security/perf).
- idle 타이핑 시 `Recorder` 재렌더 빈도는 기존 패턴과 큰 차이 없음. 측정상 문제 시 `SessionContextInput` 로컬 state + 커밋 패턴 검토 (security/perf).
- `enqueuePipeline`이 향후 비동기 완료 대기형으로 바뀌면 초기화 시점도 함께 재검토해야 한다는 메모를 팀에 공유 (arch).
- `docs/USER_FLOWS.md` §2에 "자세한 저장 실패 분류는 §13" 한 줄 위임을 넣어 §13과의 표현 중복을 줄임 (arch, 문서 응집도).
- `resetSessionInputs`를 `useCallback(..., [])`로 둔 이유를 한 줄 주석으로 보강 (arch, 선택).
- `recorder-pre-recording-context.test.tsx`와 `recorder-phased-ui.test.tsx`의 mock 구조 공통화(`test-utils/recorder-mocks.ts` 추출)는 테스트가 더 늘기 전에만 검토 (arch).
- `as HTMLTextAreaElement` 단언은 프로젝트 관행과 어긋나지 않음. 필요 시 `within`·역할 기반 쿼리로 점진적 전환 (arch, typescript).
- `recorder-ui-preview.tsx`에서 `showSessionContext` 줄을 제거하고 `RevealSection visible={true}` 리터럴 사용도 가능 (arch, 위 MEDIUM #1과 함께 처리하면 자연스러움).

## 교차 도메인 관찰

- **idle 항상 노출의 부수 효과가 세 리뷰에 모두 흩어져 나타난다.** architecture는 네이밍, implementation은 `pipeline.isBusy` 분기 테스트 누락, security는 추가 마운트·재렌더 비용으로 다른 각도에서 같은 변경의 영향을 짚는다. 이는 `showSessionContext` 한 줄을 상수로 만든 결정이 명목적·가시성·동작·성능 차원에 동시에 파급된다는 증거이며, 다음 후속 작업에서는 `useRecorderSessionInputs` 훅 분리(arch MEDIUM #3)로 이 파급을 한 곳에 가둘 수 있다.
- **회귀 테스트 자산 관리가 약점으로 드러난다.** HIGH로 격상된 git 미추적 이슈 외에도, architecture가 지적한 mock 구조 중복(LOW)과 implementation이 지적한 `pipeline.isBusy` 회귀 누락·Step 7 분리 누락(MEDIUM/LOW)이 같은 결을 가진다 — 테스트 인프라(공용 mocks·시나리오 매트릭스)가 컴포넌트 진화 속도를 따라잡지 못하고 있다.
- **보안·성능 영향은 작지만, 모두 "idle에서 입력 가능 → 사용자 입력이 더 일찍·자주 LLM 페이로드 경계에 닿는다"는 한 축으로 수렴한다.** 신규 위험은 없지만 LLM 신뢰 경계 보강(role 분리, 구분자, 출력 검증)을 별도 이슈로 가시화해 두는 것이 합리적이다.

## 중복 제거 항목

- **`showSessionContext` 명명 vs 프리뷰 표현 일치**: architecture가 동일 사안을 두 위치(`recorder.tsx` MEDIUM, `recorder-ui-preview.tsx` LOW)로 별도 보고했다. 본 종합에서는 MEDIUM 한 건(권장 #1)으로 통합하고 프리뷰 처리는 LOW 선택지에 남겼다. 격상 규칙은 "여러 리뷰어가 같은 항목"에 적용되므로 단일 리뷰어 내 중복은 격상하지 않고 통합만 했다.
- **`useCallback`·의존성 배열 추가 (arch LOW 두 건)**: 본질적으로 `resetSessionInputs` 도입에 따른 같은 결정의 양면이라 LOW 단일 항목 묶음으로 정리.
- **저장 실패 시 입력 유지 (impl Step 7 케이스 분리 LOW + impl 스트리밍 실패 테스트 LOW)**: 둘 다 "실패 경로 회귀 보강"이라는 같은 주제이며, 본 종합에서는 별 항목으로 두되 LOW로 유지했다(서로 다른 테스트 시나리오라 합치지 않음).

## 충돌 해소

없음 — 세 리뷰 모두 `PASS_WITH_NOTES`로 일치하며, 동일 코드 경로에 대한 상반된 권고(예: 초기화를 catch로 옮기라 vs 두지 마라 등)는 발견되지 않았다. `showSessionContext` 네이밍에 대해서도 architecture만 의견을 제시했고 implementation/security는 이의가 없으므로 충돌이 아니다.

## 최종 Verdict

FIX_THEN_SHIP

### 근거

코드 품질·보안·아키텍처 적합성 모두 머지 가능 수준이지만, **HIGH로 분류된 신규 회귀 테스트 파일 git 추가는 머지 전 필수**다. 추적되지 않으면 PR 검토자와 CI는 이 피쳐의 회귀 보호를 보지 못한 채 변경을 승인하게 되고, 다음 수정에서 같은 회귀가 조용히 재발할 수 있다. 액션은 단일 `git add` + 커밋이며, 이후 권장 MEDIUM(`showSessionContext` 네이밍 정리, `pipeline.isBusy` 회귀 테스트 보강)은 같은 PR에 합칠 수 있으면 한 번에, 아니면 후속 PR로 처리한다. `Recorder` 컴포넌트 책임 분리는 별도 이슈로 등록해 백로그에 두는 것을 권장한다.
