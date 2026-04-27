---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: audio-zip-download
  review_kind: implementation
---

# Implementation & Test Review

## Summary

`fflate` `zipSync` 기반 ZIP 생성·단일 다운로드·prefix sanitize·세션 상세 UI 연동이 계획서의 핵심 요구를 충족하고, 단위·컴포넌트 테스트로 ZIP 구조와 호출 인자를 실질적으로 검증합니다. 계획서 컴포넌트 테스트 전략에 적힌 **다운로드 실패 시 UI 복구** 시나리오는 테스트가 없어 보완 여지가 있습니다.

## Plan Compliance

| Plan Item                                                     | Status  | Notes                                                                                        |
| ------------------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `downloadRecordingSegments` 제거, `downloadRecordingZip` 제공 | PASS    | 코드베이스에 구 심볼 잔존 없음                                                               |
| `zipSync`로 ZIP 생성                                          | PASS    | `buildRecordingZipBlob` 내부에서 사용                                                        |
| `triggerBlobDownload` 1회·`.zip` 파일명                       | PASS    | 빈 `blobs`는 조기 반환으로 호출 없음                                                         |
| prefix sanitize (`:`, `/`, `\`, 제어 문자, 빈/공백 폴백)      | PASS    | trim + 치환; sanitize 결과가 `_`만이면 `recording` 폴백은 계획 문구보다 넓은 해석이나 합리적 |
| 내부 엔트리 `${safePrefix}-segment-NNN.webm`                  | PASS    | `padStart(3, "0")`                                                                           |
| ZIP 파일명 `${safePrefix}-audio.zip`                          | PASS    |                                                                                              |
| 버튼/로딩 문구 `오디오 ZIP 다운로드` / `ZIP 생성 중...`       | PASS    | `IconButton`의 `ariaLabel`·`label`로 반영                                                    |
| WebM 병합 없음, 세그먼트 원본 유지                            | PASS    | zip에 바이너리 그대로                                                                        |
| IndexedDB `session-audio` 비변경                              | PASS    | 변경 diff에 DB 계층 없음                                                                     |
| `vitest run` 전체 통과                                        | PASS    | 로컬에서 74 파일 / 452 테스트 통과 확인                                                      |
| TDD: `triggerBlobDownload` 직접 mock 1회 검증                 | PARTIAL | `createObjectURL` 1회 + zip unzip으로 동등하게 검증, 계획 문구와는 구현 방식만 상이          |
| 컴포넌트 테스트: 에러 시 UI 복구                              | FAIL    | 계획 §테스트 전략(컴포넌트)에 명시, 구현 없음                                                |

## Findings

### [MEDIUM] 계획의 “에러 시 UI 복구” 컴포넌트 테스트 미구현

- Location: `src/components/__tests__/session-detail-audio.test.tsx` (누락)
- Description: `01_plan.md` 컴포넌트 테스트 전략에 `downloadRecordingZip` 실패 시 UI 복구 검증이 있으나, 해당 케이스 테스트가 없습니다. 구현은 `try`/`finally`로 로딩 플래그를 내리므로 동작 자체는 복구되지만, 계획 대비 검증 공백입니다.
- Suggestion: `downloadRecordingZip`를 `mockRejectedValueOnce`로 거부하게 한 뒤, 클릭 후 `isDownloading` 해제(버튼 재활성·라벨 복귀)를 `waitFor`로 단언하세요.

### [LOW] 계획 RED 단계와 다른 트리거 검증 방식

- Location: `src/lib/__tests__/download-recording.test.ts` — `describe("downloadRecordingZip")`
- Description: 계획은 `triggerBlobDownload` mock 1회를 명시했으나, 테스트는 DOM/`URL.createObjectURL` 경로로 간접 검증합니다.
- Suggestion: 의도 유지 시 문서만 맞추거나, `vi.spyOn`으로 `triggerBlobDownload` 1회 호출을 추가 단언하면 계획과 테스트가 일치합니다.

### [LOW] 로딩 중 접근성 라벨 고정

- Location: `src/components/session-detail.tsx` (대략 481–484행 근처 `IconButton`)
- Description: 다운로드 중에도 `aria-label`은 `"오디오 ZIP 다운로드"`로 고정이고, 보이는 `label`만 `"ZIP 생성 중..."`으로 바뀝니다. 스크린 리더는 로딩 상태를 `aria-label`에서 덜 듣게 될 수 있습니다.
- Suggestion: 로딩 시 `aria-label`을 `"ZIP 생성 중"` 등으로 바꾸거나 `aria-busy`를 사용하는 방안을 검토하세요.

## Test Coverage Assessment

- **강점**: `buildRecordingZipBlob` + `unzipSync`로 **파일명·순서·내용**까지 검증해 형식적인 통과가 아닙니다. sanitize(특수문자·공백 prefix)·빈 배열·단일/다중 세그먼트·`downloadRecordingZip`의 무호출/단일 ZIP 경로가 포함됩니다.
- **컴포넌트**: mock 인자(`segments`, `session-session-123` prefix)와 로딩 문구 전환은 계획과 잘 맞습니다.
- **갭**: 위 MEDIUM 항목(에러 경로). 선택적으로 `triggerBlobDownload` 직접 스파이로 계획 RED 문구와 정합을 맞출 수 있습니다.

## Verdict

**PASS_WITH_NOTES** — 기능·완료 조항·전체 테스트는 충족하나, 계획서에 명시된 컴포넌트 **에러 복구** 테스트가 빠져 있어 병합 전 보완을 권합니다.
