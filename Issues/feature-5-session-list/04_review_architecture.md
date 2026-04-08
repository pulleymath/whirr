---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "feature-5-session-list"
  review_kind: architecture
---

# Architecture & Code Style Review

## Summary

계획서의 계층 분리(순수 `lib` → 클라이언트 컴포넌트 → 얇은 `app` 라우트)와 IndexedDB를 서버가 건드리지 않는 방향이 잘 지켜졌습니다. `HomeContent`로 녹음·목록 조합과 `refreshTrigger` 패턴도 의존성 방향이 자연스럽습니다. 상세 화면에서 로드 실패와 미존재 세션을 동일 UI로 처리하는 점은 손보는 편이 좋습니다.

## Architecture Findings

### [HIGH] 로드 오류와 “없는 세션” UI 혼동

- **Location**: `src/components/session-detail.tsx` (`catch`에서 `setSession(null)`)
- **Category**: 오류 모델 / 사용자 피드백
- **Description**: DB/런타임 예외 시에도 “세션을 찾을 수 없습니다”로 보임.
- **Suggestion**: 로딩 / 없음 / 오류 상태를 구분하거나 catch 시 별도 메시지·재시도.

### [Suggestion] 미리보기 최대 길이의 단일 출처

- **Location**: `session-list.tsx`의 `PREVIEW_MAX` vs `session-preview.ts`
- **Suggestion**: 상수를 lib에 export해 UI·테스트에서 공유.

### [Suggestion] `onSessionSaved` 시그니처 vs 상위 사용

- **Location**: `recorder.tsx` vs `home-content.tsx`
- **Suggestion**: id 사용 또는 `() => void`로 단순화.

## Code Style Findings

### [Suggestion] `Recorder` props 기본값 표현

- **Location**: `src/components/recorder.tsx`

### [Suggestion] 단위 테스트 파일 책임 범위

- **Location**: `src/lib/__tests__/group-sessions-by-date.test.ts`에 `previewSessionText` describe 포함

### [Suggestion] 날짜 라벨 파싱 가정

- **Location**: `formatSessionGroupLabel`

## Verdict

**PASS_WITH_NOTES**
