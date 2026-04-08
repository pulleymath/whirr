---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "feature-4-session-storage"
  review_kind: implementation
---

## Summary

`build-session-text` 단위 테스트와 `FINAL_SEPARATOR` 상수화가 계획(TDD Step 1 + REFACTOR)과 잘 맞고, `db.ts`는 스키마·인덱스·`getAllSessions` 최신 우선 정렬·테스트용 `resetWhirrDbForTests`가 요구사항을 충족합니다. `Recorder`의 `stop`은 `stopRecording` 후 `finally`에서 스냅샷 → `finalizeStreaming` → 비어 있지 않을 때만 `saveSession` 순서를 지키고, 저장 실패는 `console.error`로 삼켜 중지 흐름을 깨지 않습니다. 다만 `stop`이 `useCallback`으로 고정된 `finals`/`partial`을 쓰기 때문에, `await stopRecording()` 동안 전사 상태가 바뀌면 스냅샷이 한 박자 늦은 클로저 값이 될 수 있어(실서비스에서 가능한 레이스) 구현 정확도 측면에서 보완 여지가 있습니다.

## Plan Compliance

| 계획 항목                                                          | 상태      | 비고                                                                                                                   |
| ------------------------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| `idb` + `whirr-db` / `sessions` / `by-createdAt`                   | 충족      | `db.ts`에 상수·upgrade로 정의                                                                                          |
| `saveSession` / `getAllSessions` / `getSessionById`, 텍스트·메타만 | 충족      | 오디오 미저장                                                                                                          |
| `buildSessionText` 규칙(trim, join, partial)                       | 충족      | 계획과 동일                                                                                                            |
| 중지 시 비어 있지 않으면 저장, 스냅샷은 `finalize` **전**          | 충족      | `finally` 내 순서 적절                                                                                                 |
| 저장 실패가 중지를 깨지 않음                                       | 충족      | `saveSession` 주변 `try/catch`                                                                                         |
| `fake-indexeddb` + DB 단위 테스트                                  | 충족      | `db.test.ts`                                                                                                           |
| Recorder 통합: `saveSession` 인자·미호출                           | 충족      | `recorder-session-storage.test.tsx`                                                                                    |
| 계획 권장 순서 `stopRecording` → 스냅샷 → `finalize`               | 부분 이슈 | 순서 자체는 맞으나, 스냅샷 시점의 `finals`/`partial`이 클로저에 묶여 `stopRecording` 지연 중 갱신을 반영 못 할 수 있음 |

## Findings

### Important

1. **스냅샷 시점과 클로저 스테일 가능성**  
   `stop`은 `[finals, partial, ...]`에 의존하는 `useCallback` 본문에서 `await stopRecording()` 이후 `buildSessionText(finals, partial)`을 호출합니다. 클릭 시점에 시작된 그 `stop` 인스턴스는, 대기 중에 리렌더·전사 업데이트가 있어도 이전 렌더의 `finals`/`partial`을 참조할 수 있습니다. 계획서는 “화면에 보이던 내용과 일치”를 목표로 했으므로, `finalize` 직전에 최신 전사를 읽도록 `useRef`로 동기화하거나 훅에서 스냅샷 API를 제공하는 편이 의도에 더 가깝습니다.

### Suggestions

2. **`saveSession("")` 방어**  
   호출부에서 `trimmed`로 가드하지만, 계획서에 있던 “DB는 선택적으로 빈 문자열 거부”에 맞추려면 `saveSession` 초반에 빈 문자열이면 no-op 또는 명시적 거부를 넣으면 계약이 분명해집니다(현재는 필수는 아님).

3. **통합 테스트에서 저장 시점 명시**  
   `callOrder`로 `stopRecording` → `finalizeStreaming`은 검증되어 있습니다. 필요하면 `saveSession` mock 안에서 `callOrder.push("saveSession")`을 넣어 `finalizeStreaming` 이후인지까지 순서를 고정하면 계획의 “순서 검증”을 더 직접적으로 만족시킬 수 있습니다.

## Test Coverage Assessment

- **`build-session-text`**: 계획의 RED 케이스 네 가지를 모두 포함하고, 공백-only `finals` 제거까지 추가되어 규칙이 잘 고정되어 있습니다.
- **`db`**: 저장·조회 일치, `getAllSessions` 최신 우선, `crypto`/`Date.now` 스텁으로 결정적 단언, `beforeEach`/`afterEach`에서 DB 리셋으로 격리가 좋습니다. 계획에 “선택”으로 적힌 빈 문자열 `saveSession` 거부 테스트는 없으며, 호출부 가드 전제로는 수용 가능합니다.
- **`Recorder`**: 기대 문자열 한 번 호출·둘 다 비면 미호출을 검증하고, mock의 getter로 리렌더 후 최신 전사를 반영하는 방식은 이 테스트 안에서는 타당합니다(실제 앱의 비동기 스테일 이슈는 위 Important와 별개로 남습니다).

## Verdict

**조건부 통과(Conditional pass).** 계획된 파일·API·TDD 흐름·테스트 품질은 대체로 요구를 만족합니다. 다만 **중지 중 비동기 구간에서의 전사 갱신**을 반영하지 못할 수 있는 클로저 기반 스냅샷은 구현 정확도와 계획의 “화면과 일치” 목표에 비해 리스크가 있으므로, 머지 전 **Important** 항목을 ref 기반(또는 동등한 최신 스냅샷 보장)으로 보완하는 것을 권장합니다.
