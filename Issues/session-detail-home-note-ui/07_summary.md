# session-detail-home-note-ui — 작업 요약

## 구현된 기능

- 세션 상세를 홈과 동일한 `RecorderNoteWorkspace` 레이아웃(읽기 전용 제목, 속성 행, **AI 요약** / **스크립트** 탭, 동일 탭 표면)으로 전환.
- `RecorderNoteWorkspace`에 `summaryPanelContent`, `titleReadOnly` 추가로 상세 전용 요약 본문·제목 표시 모드 지원.
- `MainTranscriptTabs`·`SessionContextInput`을 상세에서 제거해 중복 제거.
- 오디오 ZIP 다운로드, 스크립트 저장·복사, 요약 생성·재생성, 용어집·모델·메타, `beforeunload` 동작 유지.
- 녹음 플로팅 도킹(`recording-card-dock`) 미포함 — 테스트로 회귀 방지.

## 주요 기술적 결정

- 슬롯(`summaryPanelContent`)으로 홈(템플릿 미리보기) vs 상세(실제 마크다운) 요약 탭 내용 분기.
- 세션 제목은 편집 없이 `h2`로 표시(`titleReadOnly`).

## 테스트 커버리지

- `session-detail.test.tsx`: 탭 **AI 요약**, 도킹 부재, 제목 `H2`, ZIP 조건부, 기존 스크립트·요약·클립보드·저장 흐름.
- `session-detail-idb-failure.test.tsx`, `session-detail-mm-before-unload.test.tsx`: 탭 라벨 갱신 및 기존 시나리오 유지.

## 파일 변경 목록

- `src/components/session-detail.tsx`
- `src/components/recorder-note-workspace.tsx`
- `src/components/__tests__/session-detail*.test.tsx` (3파일)
- `Issues/session-detail-home-note-ui/*` (이슈·계획·리뷰·요약)
- `Issues/STATUS.md`

## 알려진 제한 사항

- `titleReadOnly`일 때도 `onNoteTitleChange` prop이 타입상 필수이며 noop 전달 — 후속에서 판별 유니온 검토.
- `MeetingMinutesMarkdown` 링크 `href` 제한은 본 PR에서 다루지 않음(보안 리뷰 MEDIUM 후속).

## 다음 단계 (해당 시)

- 마크다운 링크 화이트리스트 이슈.
- `RecorderNoteWorkspace` props 타입 정리 PR.
