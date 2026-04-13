---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: "feature-13-5min-segment-recording"
---

# 5분 세그먼트 녹음 + 디버그 오디오 저장 — 개발 계획서

## 개발 범위

- `gpt-4o-transcribe` 출력 토큰 제한(16K) 해결을 위한 5분 단위 세그먼트 녹음 구현
- 녹음 중 백그라운드 전사 수행 및 점진적 결과 UI 반영
- IndexedDB v2 스키마 확장: `session-audio` store 추가 및 오디오 Blob 저장
- 녹음 파일 다운로드 기능 (세그먼트별 WebM)
- 세션 상세 화면에서 오디오 다운로드 버튼 추가

## 기술적 접근 방식

- `MediaRecorder`를 5분마다 교체(rotate)하여 독립된 Blob 생성
- `AudioContext` 및 `AnalyserNode`는 전체 세션 동안 유지하여 끊김 없는 레벨 메터 제공
- `useBatchTranscription` 훅을 세그먼트 기반으로 재작성하여 상태 관리 및 전사 로직 고도화
- IndexedDB v2 마이그레이션 로직 구현

## TDD 구현 순서

### Step 1: `src/lib/audio.ts` -- SegmentedRecordingSession 추가

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/__tests__/audio-segmented-recording.test.ts`
- 테스트 케이스: `startSegmentedRecording` 호출 시 세션 객체 반환, `rotateSegment` 호출 시 새로운 Blob 반환 및 리코더 교체 확인

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/audio.ts`
- 핵심 구현 내용: `SegmentedRecordingSession` 인터페이스 정의, `rotateSegment`, `stopFinalSegment`, `close` 메서드 구현

**REFACTOR** — 코드 개선

- 기존 `startBlobRecording`과의 공통 로직 추출 및 중복 제거

### Step 2: `src/lib/download-recording.ts` -- 다운로드 유틸리티

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/__tests__/download-recording.test.ts`
- 테스트 케이스: `triggerBlobDownload` 호출 시 `URL.createObjectURL` 및 `click` 이벤트 발생 확인

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/download-recording.ts`
- 핵심 구현 내용: `triggerBlobDownload`, `downloadRecordingSegments` 함수 구현

**REFACTOR** — 코드 개선

- 파일명 생성 규칙 최적화 및 `revokeObjectURL` 안정성 확보

### Step 3: `src/lib/db.ts` -- IndexedDB 스키마 확장

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/__tests__/db.test.ts`
- 테스트 케이스: v2 마이그레이션 후 `session-audio` store 존재 확인, CRUD 동작 확인

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/db.ts`
- 핵심 구현 내용: `DB_VERSION` 업데이트, `upgrade` 로직 추가, `saveSessionAudio`, `getSessionAudio` 등 추가

**REFACTOR** — 코드 개선

- 에러 핸들링 보강 및 타입 정의 정교화

### Step 4: `src/hooks/use-batch-transcription.ts` -- 세그먼트 녹음 전환

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/hooks/__tests__/use-batch-transcription.test.tsx`
- 테스트 케이스: 5분 경과 시 `rotateSegment` 호출 및 백그라운드 전사 시작 확인, 점진적 결과 업데이트 확인

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/hooks/use-batch-transcription.ts`
- 핵심 구현 내용: 타이머 기반 세그먼트 교체 로직, 백그라운드 전사 큐 관리, 결과 병합 로직

**REFACTOR** — 코드 개선

- 상태 관리 복잡도 감소를 위한 리팩토링, 에러 복구 로직 강화

### Step 5: UI 컴포넌트 업데이트 (`recorder.tsx`, `session-detail.tsx`)

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/components/__tests__/recorder-batch.test.tsx`, `src/components/__tests__/session-detail-audio.test.tsx`
- 테스트 케이스: 진행률 표시 확인, 다운로드 버튼 노출 및 클릭 동작 확인

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/components/recorder.tsx`, `src/components/session-detail.tsx`
- 핵심 구현 내용: `segmentProgress` 연동, 다운로드 버튼 추가, 오디오 저장 로직 연결

**REFACTOR** — 코드 개선

- UI 일관성 및 UX 개선 (로딩 상태, 버튼 위치 등)

## 파일 변경 계획

- `src/lib/audio.ts`: 수정
- `src/lib/download-recording.ts`: 신규
- `src/lib/db.ts`: 수정
- `src/hooks/use-batch-transcription.ts`: 수정
- `src/components/recorder.tsx`: 수정
- `src/components/session-detail.tsx`: 수정
- 테스트 파일 다수 추가 및 수정

## 완료 조건

- 5분 단위 세그먼트 녹음 및 전사가 정상 동작함
- 녹음 종료 후 전체 텍스트가 올바르게 병합됨
- IndexedDB에 오디오 Blob이 저장되고 상세 화면에서 다운로드 가능함
- 모든 단위 테스트 및 통합 테스트 통과

## 테스트 전략

- `jest` 및 `react-testing-library`를 사용한 단위/통합 테스트
- `MediaRecorder` 및 `AudioContext` Mocking을 통한 오디오 로직 검증
- IndexedDB Mocking을 통한 데이터 저장 검증
- 수동 QA: 5분 이상의 실제 녹음 테스트를 통한 세그먼트 교체 및 전사 확인
