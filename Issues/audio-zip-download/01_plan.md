---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: audio-zip-download
---

# Audio Zip Download — 개발 계획서

## 개발 범위

녹음 세션의 오디오 세그먼트들을 개별 파일로 다운로드하는 기존 방식을 제거하고, 모든 세그먼트를 하나의 ZIP 파일로 묶어 다운로드하는 기능으로 교체한다.

- `src/lib/download-recording.ts`의 `downloadRecordingSegments` 함수를 `downloadRecordingZip(blobs, prefix)`로 교체
- `src/components/session-detail.tsx`의 다운로드 버튼 UI 및 호출부 업데이트
- WebM 세그먼트를 하나의 오디오 파일로 병합하지 않음 — 세그먼트별 원본 유지
- IndexedDB `session-audio` 스토어는 변경하지 않음

## 기술적 접근 방식

### ZIP 생성

`fflate`의 `zipSync`를 사용하여 클라이언트 사이드에서 ZIP을 생성한다.

- 각 Blob을 `Uint8Array`로 변환 후 `zipSync`에 전달
- 내부 파일명: `${safePrefix}-segment-001.webm`, `${safePrefix}-segment-002.webm`, ...
- ZIP 파일명: `${safePrefix}-audio.zip`

### 파일명 Sanitize

`prefix`에서 안전하지 않은 문자를 제거한다.

- `:`, `/`, `\\` 및 제어 문자(U+0000–U+001F)를 `_`로 치환
- 빈 문자열이 되면 `recording` 폴백

### 다운로드 트리거

기존 `triggerBlobDownload` 유틸을 재사용하여 ZIP Blob을 한 번만 호출한다.

### UI 변경

- 버튼 텍스트: `오디오 ZIP 다운로드`
- 로딩 상태 텍스트: `ZIP 생성 중...`
- `await downloadRecordingZip(blobs, prefix)` 호출

## TDD 구현 순서

### Step 1 — `downloadRecordingZip` 핵심 로직

**RED**: `src/lib/__tests__/download-recording.test.ts` 작성

- `triggerBlobDownload`를 mock하여 호출 횟수가 정확히 1회인지 검증
- 전달된 Blob을 `fflate`의 `unzipSync`로 풀어 엔트리 이름과 순서 검증
- `safePrefix`에 `:`, `/`, `\\`, 제어 문자가 포함된 경우 sanitize 검증
- 빈 prefix에 대한 폴백 검증

**GREEN**: `src/lib/download-recording.ts` 구현

- `downloadRecordingSegments` 제거
- `downloadRecordingZip(blobs: Blob[], prefix: string): Promise<void>` 구현
- `sanitizePrefix` 내부 함수 구현
- `fflate`의 `zipSync`로 ZIP 생성 후 `triggerBlobDownload` 호출

**REFACTOR**: 타입 정리 및 export 정리

### Step 2 — `session-detail.tsx` UI 연동

**RED**: `src/components/__tests__/session-detail-audio.test.tsx` 작성

- `downloadRecordingZip`를 mock
- 버튼 클릭 시 `downloadRecordingZip`이 올바른 인자로 호출되는지 검증
- 로딩 중 버튼 텍스트가 `ZIP 생성 중...`으로 변경되는지 검증

**GREEN**: `src/components/session-detail.tsx` 수정

- import를 `downloadRecordingZip`으로 변경
- 버튼 텍스트를 `오디오 ZIP 다운로드` / `ZIP 생성 중...`으로 변경
- `onClick` 핸들러에서 `await downloadRecordingZip(blobs, prefix)` 호출

**REFACTOR**: 불필요한 import 제거, 에러 핸들링 일관성 확인

### Step 3 — 통합 검증 및 엣지 케이스

**RED**: 엣지 케이스 테스트 추가

- 빈 blobs 배열 전달 시 동작 검증
- 단일 세그먼트 ZIP 검증

**GREEN**: 엣지 케이스 처리 구현

**REFACTOR**: 전체 코드 정리, 사용하지 않는 코드 제거

## 파일 변경 계획

| 파일                                                     | 변경 유형 | 설명                                                      |
| -------------------------------------------------------- | --------- | --------------------------------------------------------- |
| `src/lib/download-recording.ts`                          | 수정      | `downloadRecordingSegments` → `downloadRecordingZip` 교체 |
| `src/components/session-detail.tsx`                      | 수정      | 버튼 UI 및 호출부 업데이트                                |
| `src/lib/__tests__/download-recording.test.ts`           | 생성      | ZIP 생성 로직 단위 테스트                                 |
| `src/components/__tests__/session-detail-audio.test.tsx` | 생성      | UI 연동 테스트                                            |
| `package.json`                                           | 수정      | `fflate` 의존성 추가 (이미 존재하면 생략)                 |

## Issue-Driven Dev 산출물 및 게이트

| 게이트      | 산출물                 | 통과 기준                          |
| ----------- | ---------------------- | ---------------------------------- |
| Plan Review | `01_plan.md` (본 문서) | 범위·접근 방식·TDD 순서 확정       |
| RED         | 실패하는 테스트        | 모든 테스트가 의도대로 실패        |
| GREEN       | 통과하는 구현          | 모든 테스트 통과, lint 에러 없음   |
| REFACTOR    | 정리된 코드            | 테스트 유지 통과, 불필요 코드 제거 |
| Final       | `vitest run` 전체 통과 | 기존 테스트 포함 전체 green        |

## 완료 조건

- [ ] `downloadRecordingSegments` 완전 제거
- [ ] `downloadRecordingZip`이 `fflate` `zipSync`로 ZIP 생성
- [ ] `triggerBlobDownload` 1회 호출로 `.zip` 다운로드
- [ ] prefix sanitize 처리 (`:`, `/`, `\\`, 제어 문자)
- [ ] 내부 파일명 `${safePrefix}-segment-NNN.webm` 형식
- [ ] ZIP 파일명 `${safePrefix}-audio.zip` 형식
- [ ] 버튼 텍스트 `오디오 ZIP 다운로드` / `ZIP 생성 중...`
- [ ] WebM 세그먼트 병합 없음 — 원본 유지
- [ ] IndexedDB `session-audio` 변경 없음
- [ ] `vitest run` 전체 통과

## 테스트 전략

### 단위 테스트: `src/lib/__tests__/download-recording.test.ts`

- `triggerBlobDownload` mock → 호출 횟수 1회 검증
- 생성된 ZIP Blob을 `fflate` `unzipSync`로 해제하여 엔트리 이름·순서·내용 검증
- prefix sanitize: 특수 문자(`:`, `/`, `\\`), 제어 문자, 빈 문자열 각각 검증
- 엣지 케이스: 빈 blobs 배열, 단일 세그먼트

### 컴포넌트 테스트: `src/components/__tests__/session-detail-audio.test.tsx`

- `downloadRecordingZip` mock
- 버튼 클릭 → mock 호출 인자 검증
- 로딩 상태 텍스트 전환 검증
- 에러 발생 시 UI 복구 검증
