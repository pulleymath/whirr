---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "session-detail-home-note-ui"
  review_kind: architecture
---

# Architecture & Code Style Review

## Summary

이슈의 레이아웃·재사용·제목 읽기 전용·스크립트 탭 하단 요약 생성·`MainTranscriptTabs` 제거·`RecordingCard` 비노출 방향과 구현이 잘 맞습니다. `SessionDetail`은 로컬 DB + 요약 API + UI 상태만 담당하고, `RecorderNoteWorkspace`는 노트 크롬 역할에 집중합니다.

## 잘된 점

1. 상세가 `RecorderNoteWorkspace`로 홈과 동일한 탭/속성 리듬을 사용.
2. `SessionContextInput` 중복 제거 — SRP·DRY에 유리.
3. 상세에 녹음 도킹 없음 — 화면 조합과 도메인 분리 명확.
4. `summaryPanelContent`, `titleReadOnly` 네이밍 명확; 홈은 새 props 없이 하위 호환.

## 결합도·SRP

- 큰 JSX 슬롯 주입은 세션별 차이에 자연스러움.
- 요약 탭이 홈(템플릿 미리보기) vs 상세(실데이터)로 갈라지나 `summaryPanelContent != null`로 단순 분기.

## TypeScript·스멜

- **`titleReadOnly`일 때도 `onNoteTitleChange` 필수 + noop**: 경미한 스멜. 판별 유니온으로 개선 권장.

## 심각도

| 심각도     | 항목                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| Critical   | 없음                                                                                                   |
| Important  | `titleReadOnly` + 필수 noop — 후속 PR에서 타입 모델 개선 권장                                          |
| Suggestion | `pipelineBusy` 의미가 홈/상세에서 다소 다름 — 주석으로 의도 명시. 슬롯 JSX가 커지면 하위 컴포넌트 추출 |

## 결론

구현은 이슈·아키텍처와 정합적이며, 재사용을 위한 슬롯 추가는 합리적입니다.
