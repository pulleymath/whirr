---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: session-detail-edit-modal
  review_kind: architecture
---

# Architecture & Code Style Review

## Summary

플랜의 방향(읽기 전용 상세 + 편집 모달, 속성 행 추출, `src/lib` 보조 함수)과 대체로 잘 맞으며, 브라우저·로컬 저장소 경계도 ARCHITECTURE.md와 충돌하지 않습니다. 다만 **영속/도메인 헬퍼가 다이얼로그 컴포넌트 모듈에 묶인 점**과 **상세 페이지가 녹음 워크스페이스 모듈에서 탭 스타일 상수만 가져오는 결합**은 레이어·응집도 측면에서 정리 여지가 있습니다.

## Architecture Findings

### [MEDIUM] 영속 로직이 UI 컴포넌트 파일에 공존

- Location: `src/components/session-edit-dialog.tsx` (`persistSessionEditSnapshot`, `SessionEditSnapshot` 등)
- Category: coupling / structure
- Description: `SessionDetailReadyContent`가 요약 파이프라인에서 `persistSessionEditSnapshot`을 같은 파일에서 import합니다. UI 레이어와 IDB `updateSession` 호출·페이로드 조립이 한 모듈에 있어, 상세 화면이 “다이얼로그 구현”에 대한 비‑UI 의존성을 갖게 됩니다.
- Suggestion: `persistSessionEditSnapshot`과 스냅샷 타입을 `src/lib/`(예: `session-edit-persist.ts`)로 옮기고, 다이얼로그는 그 함수만 호출하도록 분리하면 의존 방향이 “화면 → lib → db”로 명확해집니다.

### [LOW] 상세 화면이 녹음 워크스페이스 모듈에 스타일 상수로 결합

- Location: `src/components/session-detail.tsx` (import from `@/components/recorder-note-workspace`)
- Category: coupling / structure
- Description: 탭 UI 상수(`NOTE_TAB_*`)만 필요해 `recorder-note-workspace.tsx` 전체 모듈을 끌어옵니다. 플랜에서도 언급된 대안(공유 파일 추출)과 비교하면 결합도가 다소 높습니다.
- Suggestion: `note-tab-styles.ts` 같은 얇은 공유 모듈로 상수만 분리하거나, 플랜대로 한 곳으로 모아 두면 상세·홈이 동일 토큰을 공유하면서도 서로의 기능 묶음에는 덜 묶입니다.

### [LOW] 플랜 대비 모달 크기·z-index 차이

- Location: `src/components/session-edit-dialog.tsx` (`max-w-3xl`, `z-[70]`)
- Category: structure
- Description: 계획서는 데스크탑 `max-w-2xl`, SettingsPanel 참조 `z-60` 등을 예시로 들었는데, 구현은 더 넓은 폭과 다른 z 스택을 씁니다. 제품 결정일 수 있으나 **문서·구현 불일치**로 추후 스택/오버레이 정리 시 혼선 소지가 있습니다.
- Suggestion: 의도적이면 플랜/이슈 문구를 현재 값으로 맞추고, 그렇지 않다면 계획한 토큰으로 통일합니다.

## Code Style Findings

### [MEDIUM] 불리언처럼 보이는 이름이 실제로는 함수

- Location: `src/components/session-edit-dialog.tsx` (`const isDirty = useCallback(...)` 후 `isDirty()` 호출)
- Category: naming / readability
- Description: `isDirty`는 호출 시점마다 계산하는 함수인데, 이름은 불리언 상태처럼 읽혀 혼동을 줍니다.
- Suggestion: `computeIsDirty`, `checkDirty`, `getDirtyState` 등 동작이 드러나는 이름으로 바꾸거나, 실제 불리언 상태로 두고 스냅샷 변경 시에만 갱신하는 패턴을 검토합니다.

### [LOW] import 그룹 순서가 파일마다 약간 다름

- Location: `src/components/session-detail.tsx` (`@/hooks/use-before-unload`가 `@/lib/*` 뒤에 위치)
- Category: formatting
- Description: 프로젝트 관행이 “external → internal”이라면 `@/components` / `@/hooks` / `@/lib` 같은 그룹 순서를 한 파일 안에서 일관되게 두는 편이 읽기 좋습니다.
- Suggestion: 팀 규칙에 맞춰 `@/hooks`를 `@/lib` 앞 또는 별도 블록으로 정렬합니다.

### [LOW] 빈 `SessionContext` 기본값 표현 중복

- Location: `src/components/session-detail.tsx` (`EMPTY_SESSION_CONTEXT`), `src/components/session-edit-dialog.tsx` (인라인 `{ participants: "", ... }`)
- Category: readability / cohesion
- Description: 동일한 “빈 컨텍스트” 리터럴이 여러 곳에 있어 변경 시 여러 파일을 건드려야 합니다.
- Suggestion: `EMPTY_SESSION_CONTEXT`를 `src/lib/glossary/types` 근처나 작은 상수 모듈로 한 번만 정의해 재사용합니다.

### [LOW] 스냅샷 동등성에 `JSON.stringify` 사용

- Location: `src/components/session-edit-dialog.tsx` (`snapshotsEqual`)
- Category: readability / typescript
- Description: 용어집·템플릿 비교에 `JSON.stringify`를 사용하면 코드 의도가 한 번에 읽히기 어렵고, 키 순서 등에 대한 가정이 숨습니다(동작 판단은 하지 않음).
- Suggestion: 배열은 길이·요소 순서 비교, 템플릿은 필드별 비교 같은 명시적 비교로 바꾸면 의도가 드러납니다.

## Verdict

PASS_WITH_NOTES
