# Architecture & Code Style Review

## Summary

`ARCHITECTURE.md` §7에 맞는 `lib` / `hooks` / `components` 배치와 클라이언트 경계가 일관됩니다. 훅 파일에 순수 유틸 `formatElapsed`가 함께 있는 점은 소폭 개선 여지가 있습니다.

## Architecture Findings

### [LOW] 브라우저 전용 `lib/audio.ts`의 모듈 경계

- **Location:** `src/lib/audio.ts`
- **Suggestion:** 클라이언트에서만 import하는 규칙 문서화.

### [LOW] 레벨 미터 읽기 루프의 위치

- **Location:** `src/hooks/use-recorder.ts`

### [MEDIUM] 훅 파일에 순수 유틸 `formatElapsed` 공존

- **Location:** `src/hooks/use-recorder.ts`
- **Suggestion:** `src/lib/format-elapsed.ts` 등으로 분리(선택).

## Code Style Findings

### [LOW] `mapMediaErrorToMessage`의 타입 좁히기

- **Location:** `src/lib/audio.ts`

### [LOW] 네이밍·import·`"use client"` 배치

- **Verdict:** 유지 가능.

## Verdict

**PASS_WITH_NOTES**
