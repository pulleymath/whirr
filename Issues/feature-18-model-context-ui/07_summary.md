# Feature 18 — 모델·컨텍스트 UI — 작업 요약

## 구현된 기능

- 홈: 녹음·모델·회의 컨텍스트·스크립트 4영역 데스크톱 2열 레이아웃, `ModelQuickPanel` 연동.
- 세션 상세: `scriptMeta` 읽기 전용 표시, 컨텍스트·용어 사전·회의록 모델 편집, 단일 재생성 플로우.
- IndexedDB `Session.scriptMeta` 및 파이프라인 완료 시 `scriptMeta` 저장.
- `fetchMeetingMinutesSummary` 호출 시 glossary·sessionContext 전달.

## 주요 기술적 결정

- 회의록 모델은 클라이언트에서도 `isAllowedMeetingMinutesModelId`로 클램프하여 API·로컬 메타 정합을 맞춘다.
- `formatScriptMetaLine`로 배치/실시간 메타 한 줄 표기를 통일한다.

## 테스트 커버리지

- 기존: `db`, `recorder`, `session-detail`, `meeting-minutes-fetch`, 파이프라인 `script-meta-persistence` 등.
- 추가: `session-script-meta-display.test.tsx`, `recorder-session-storage`의 `scriptMeta.mode` 단언 구체화.

## 파일 변경 목록

- 핵심: `recorder.tsx`, `home-page-shell.tsx`, `session-detail.tsx`, `db.ts`, `session-script-meta.ts`, `post-recording-pipeline/context.tsx`, `model-quick-panel.tsx`, 세션 편집 보조 컴포넌트, 관련 `__tests__` 및 `Issues/feature-18-model-context-ui/*`.

## 알려진 제한 사항

- `scriptMeta`가 없는 매우 오래된 세션에서 회의록 모델만 바꿀 때 로컬 메타 갱신이 제한될 수 있다(제품 정책 미결).
- 계획서에 있던 일부 통합 테스트 파일은 아직 추가하지 않았다.

## 다음 단계 (해당 시)

- `model-quick-panel`, 세션 상세 재생성·컨텍스트 에디터 통합 테스트 추가.
- `session-detail` 로직 훅 분리 및 glossary 입력 디바운스.
