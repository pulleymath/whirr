---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: audio-zip-download
  review_kind: architecture
---

# Architecture & Code Style Review

## Summary

클라이언트 전용 ZIP·다운로드 흐름은 `docs/ARCHITECTURE.md`의 브라우저·로컬 저장 경계와 잘 맞고, UI는 `downloadRecordingZip` 한 줄로 `lib`에 의존해 결합도가 낮다. `buildRecordingZipBlob` 공개는 테스트 목적에 타당하나 공용 API 표면이 넓어졌고, 빈 `blobs`에 대한 두 계층의 의미가 달라 API 일관성 측면에서만 짚을 만하다.

## Architecture Findings

### [LOW] `download-recording` 모듈의 책임 범위

- Location: `src/lib/download-recording.ts` (전체)
- Category: solid / cohesion
- Description: 한 파일에 DOM 앵커 트리거, prefix sanitize, ZIP 바이너리 조립, 고수준 `downloadRecordingZip` 오케스트레이션이 함께 있다. 규모상 문제는 없으나 “다운로드 트리거”와 “ZIP 페이로드 생성”이 논리적으로는 두 축이다.
- Suggestion: 기능이 커지면 `triggerBlobDownload`는 기존처럼 공용 유틸로 두고, ZIP 전용(`buildRecordingZip` / `sanitizeRecordingPrefix` 등)만 분리하는 정도로 점진 분리하면 된다. 현재는 과도한 분리는 피하는 편이 낫다.

### [MEDIUM] 빈 `blobs`에 대한 이중 계약

- Location: `buildRecordingZipBlob` (48–50행) vs `downloadRecordingZip` (70–72행)
- Category: coupling / structure
- Description: 빈 배열에서 빌더는 예외를 던지고, 다운로드 진입점은 조용히 no-op 한다. 호출자가 빌더를 직접 쓰면 예외, UI 경로만 쓰면 무시로 읽힌다.
- Suggestion: 의도가 “UI에서는 세그먼트 없을 때 버튼 자체를 숨김”이라면 문서화 한 줄이나 JSDoc으로 “`downloadRecordingZip`은 빈 배열을 허용하고 아무 것도 하지 않는다”를 명시하거나, 빌더도 동일하게 no-op/빈 zip 중 하나로 정책을 통일해 API를 한 가지 이야기로 맞춘다.

### [LOW] `buildRecordingZipBlob`의 공개 export

- Location: `src/lib/download-recording.ts` — `export async function buildRecordingZipBlob`
- Category: structure / open-closed
- Description: 계획서에는 `downloadRecordingZip` 중심으로만 서술되어 있어, 공개 표면이 한 단계 넓어졌다. 다만 ZIP 구조·sanitize를 단위 테스트에서 직접 검증하려면 합리적인 편이다.
- Suggestion: `@internal` 주석(팀에서 쓰는 경우) 또는 “테스트 및 고급 사용처용” JSDoc으로 소비 범위를 한정해, 향후 리팩터 시 깨지기 쉬운 외부 의존을 줄인다. 대안으로는 빌더를 export하지 않고 `downloadRecordingZip` + mock된 `triggerBlobDownload`만으로 unzip 검증을 유지하는 방식이나, 전용 `*.test-only` 패턴은 이 코드베이스 관례와 맞는지 확인 후 도입한다.

### [LOW] 서드파티 의존성(`fflate`) 위치

- Location: `package.json` dependencies, `src/lib/download-recording.ts`
- Category: dependency
- Description: ZIP은 순수 클라이언트 연산이며 서버로 오디오를 보내지 않아 ARCHITECTURE의 “범용 백엔드 오디오 중계 없음”과 충돌하지 않는다. 번들 크기는 기능 대비 최소 축에 가깝다.
- Suggestion: 유지. 추후 동일 라이브러리를 서버 컴포넌트에서 import하지 않도록(실수 방지) 이 모듈은 `"use client"`를 쓰는 호출 경로에만 두는 현재 구조를 유지하면 된다.

## Code Style Findings

### [LOW] `session-detail.tsx` import 블록 내 `@/lib` 삽입 위치

- Location: `src/components/session-detail.tsx` (대략 7–33행)
- Category: formatting
- Description: `@/lib/db` 다음에 긴 `@/components` 묶음이 오고, 그 뒤에 `@/lib/download-recording` 및 기타 `@/lib/*`가 이어진다. 체크리스트의 “external → internal” 관점에서는 `@/lib`가 한 덩어리로 모이지 않는다.
- Suggestion: 본 변경이 해당 줄을 추가했으므로, 팀 규칙이 “모든 `@/lib`를 `@/components` 앞에 둔다”라면 한 번에 정렬하는 편이 좋다. 기존 파일 관례를 따르는 것이 우선이면 그대로 두어도 된다.

### [LOW] 인라인 `onClick` 핸들러 분리 여부

- Location: `src/components/session-detail.tsx` (488–498행 부근)
- Category: readability
- Description: `setIsDownloading` + `try/finally` + `downloadRecordingZip`가 JSX 인라인에 있다. `SessionDetailReadyContent`는 이미 크고 상태가 많다.
- Suggestion: 스타일 일관성을 위해 `handleDownloadAudioZip` 같은 `useCallback`으로 빼면 가독성과 테스트 포인트가 좋아질 수 있으나, 필수는 아니다.

### [LOW] 네이밍·주석

- Location: `sanitizePrefix`, `segmentEntryName`, `buildRecordingZipBlob`, `downloadRecordingZip`
- Category: naming
- Description: 역할이 이름에서 드러나고, 한국어 UI 문자열과 영문 코드 식별자 구분이 명확하다. `buildRecordingZipBlob` 주석에 “단위 테스트·검증용”이 있어 export 의도가 코드에 남아 있다.
- Suggestion: 유지.

## Verdict

PASS_WITH_NOTES
