# Recorder 녹음 단계 UI — 작업 요약

## 구현된 기능

- 녹음 비활성: `RecordingCard`만 보이도록 `SessionContextInput`·`TranscriptView`를 `RevealSection`으로 감싸 숨김(`aria-hidden`, `inert`, 높이 0).
- 녹음 중: 회의 컨텍스트 영역 표시(블러·이동·불투명도 전환).
- 스크립트가 생긴 뒤: `TranscriptView` 표시(동일 전환). 배치·실시간·Web Speech 모드 모두 `hasTranscriptScript`로 판별.
- 녹음 중 스크립트 없이 전사 오류만 있는 경우: 트랜스크립트 패널은 닫고 `RecordingCard` 메시지로 오류 표시.

## 주요 기술적 결정

- Flex `gap-6` 제거 후 보이는 블록에만 `mt-6`을 주어, `h-0` 숨김과 `gap` 빈 공간 문제를 피함.
- 애니메이션: `opacity`, `transform`, `filter(blur)`를 `motion-safe:`로 전환하고 `motion-reduce:`에서 전환 제거.

## 테스트 커버리지

- `recorder-phased-ui.test.tsx`: idle/녹음/스크립트 유무·배치 `displayTranscript`·오류 카드 노출·Web Speech 등.
- `recorder-ui.test.tsx`: idle에서 `reveal-transcript` 숨김 및 DOM 잔존 확인.

## 파일 변경 목록

- `src/components/recorder.tsx`
- `src/components/__tests__/recorder-phased-ui.test.tsx` (신규)
- `src/components/__tests__/recorder-ui.test.tsx`
- `Issues/` 이슈·계획·리뷰·요약 문서
- Prettier 통과용: `settings-panel.tsx`, `settings-panel.test.tsx`, `use-batch-transcription.ts`

## 알려진 제한 사항

- 등장 애니메이션을 위해 `SessionContextInput`·`TranscriptView`는 언마운트하지 않고 숨김 처리함(DOM·메모리 관점은 기존과 유사).

## 다음 단계 (해당 시)

- 저사양 기기에서 blur 전환 비용이 문제되면 blur 제거 또는 속성 축소 검토.
