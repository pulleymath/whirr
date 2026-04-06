# Architecture & Code Style Review

## Summary

STT 토큰 라우트, `lib/stt`의 `TranscriptionProvider` 구현, `use-transcription`·`TranscriptView`·`Recorder` 조합은 `01_plan.md` 및 `ARCHITECTURE.md`의 데이터 흐름·디렉터리 배치와 대체로 잘 맞습니다. 다만 문서에 적힌 “환경 변수 기반 Provider 팩토리”와 “UI가 구현체를 직접 참조하지 않음”을 엄격히 적용하면, 기본 경로에서 훅이 AssemblyAI 구체 클래스에 고정되는 점과 `index.ts` 역할 기술 간에 작은 간극이 있습니다.

## Architecture Findings

### [MEDIUM] 훅의 기본 Provider 의존이 추상화 경계와 문구와 어긋남

- Location: `src/hooks/use-transcription.ts` (`AssemblyAIRealtimeProvider` 직접 import 및 기본 `createProvider`)
- Category: coupling / solid
- Description: `ARCHITECTURE.md` §2.1은 UI가 Provider 구현체를 직접 참조하지 않도록 하고, §7은 `lib/stt/index.ts`를 “환경 변수 기반 Provider factory”로 기술합니다. 컴포넌트(`Recorder`, `TranscriptView`)는 `TranscriptionProvider` 타입만 간접적으로 쓰지만, 기본 실행 경로에서 훅이 `@/lib/stt/assemblyai` 구체 클래스에 직접 의존합니다. 테스트용 `createProvider` 주입은 있으나, 런타임 스위칭은 `index` 팩토리에 모이지 않았습니다.
- Suggestion: `src/lib/stt/index.ts`에 `createTranscriptionProvider(token)`(또는 환경/설정 기반 팩토리)을 두고, 훅 기본값은 `@/lib/stt` 배럴만 참조하도록 정리하면 문서·교체 가능성·의존 방향이 한곳으로 모입니다.

### [MEDIUM] ARCHITECTURE §7의 `index.ts` 역할과 실제 export만 있는 구현의 불일치

- Location: `docs/ARCHITECTURE.md` §7 vs `src/lib/stt/index.ts`
- Category: structure
- Description: 문서는 `index.ts`를 “Provider factory (환경 변수 기반)”로 적어 두었으나, 변경분의 `index.ts`는 타입 재export와 `AssemblyAIRealtimeProvider` export만 수행합니다.
- Suggestion: 팩토리 함수를 구현하거나, 문서의 해당 줄을 현재 구조(구현체 export + 훅에서 옵션 주입)에 맞게 수정해 단일 진실 원천을 맞춥니다.

### [LOW] API 라우트의 업스트림 호출·검증이 단일 핸들러에 집중됨

- Location: `src/app/api/stt/token/route.ts`
- Category: structure / readability
- Description: `01_plan.md` REFACTOR 단계에서 URL·에러 매핑을 작은 헬퍼로 나누는 것을 제안했으나, 핸들러 한 파일에 fetch·JSON 검증·응답이 모두 있습니다.
- Suggestion: `fetchAssemblyAiRealtimeToken(apiKey)` 같은 순수 함수로 분리하고 라우트는 입출력·HTTP 매핑만 담당하게 합니다.

### [LOW] `Recorder`에 녹음·전사 오케스트레이션 로직이 함께 있음

- Location: `src/components/recorder.tsx` (`start`/`stop`의 `prepareStreaming`·`finalizeStreaming` 순서)
- Category: coupling / cohesion
- Description: 계획서 Step 5 REFACTOR에서 언급한 `RecordingWithTranscript` 분리는 선택 사항이며, 현재는 한 컴포넌트가 두 훅의 순서를 조율합니다.
- Suggestion: 필요 시 얇은 래퍼 컴포넌트나 커스텀 훅(`useRecordingWithTranscription`)으로 순서만 캡슐화합니다.

## Code Style Findings

### [LOW] `TranscriptView` 목록 항목 key가 콘텐츠 일부에 의존

- Location: `src/components/transcript-view.tsx` (`finals.map`의 `key`)
- Category: naming / readability
- Description: `key={\`${i}-${line.slice(0, 12)}\`}`는 동일 인덱스에서 앞 12자가 같으면 충돌 가능성이 있고, React key 관례(안정적 식별자) 측면에서 다소 임의적입니다.
- Suggestion: `key={i}`만 쓰거나, 향후 세션/턴 id가 생기면 그 id를 key로 사용합니다.

### [LOW] STT 모듈 import 경로가 타입과 구현체에서 불일치

- Location: `src/hooks/use-transcription.ts` (`@/lib/stt/types`, `@/lib/stt/assemblyai`)
- Category: formatting / conventions
- Description: 같은 기능 영역을 `@/lib/stt` 배럴과 하위 경로가 섞여 참조합니다.
- Suggestion: `AssemblyAIRealtimeProvider`를 `@/lib/stt`에서 가져오거나, 팀 규칙에 맞게 경로를 통일합니다.

### [LOW] import 정렬은 대체로 일관됨

- Location: `src/components/recorder.tsx` 등
- Category: formatting
- Description: `react` → `@/hooks` → `@/components` 순서로 정리되어 있으며, dead code는 보이지 않습니다.
- Suggestion: 유지.

## Verdict

PASS_WITH_NOTES
