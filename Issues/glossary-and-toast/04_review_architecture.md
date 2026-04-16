---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "glossary-and-toast"
  review_kind: architecture
---

# Architecture & Code Style Review

## Summary

`01_plan.md`와 `docs/ARCHITECTURE.md`가 말하는 경계(브라우저 설정·로컬 세션, 호스팅 앱의 회의록 API, `PostRecordingPipelineProvider` 기반 비동기) 안에서 **용어·세션 컨텍스트 → API → 프롬프트 빌더 → 로컬 세션 `context` 저장 → 완료 토스트** 흐름이 한 줄로 이어지도록 배선된 점은 방향이 좋습니다. `src/lib/glossary/types.ts`를 클라이언트·서버·IndexedDB가 공유하는 **얇은 도메인 타입**으로 두고, 파이프라인에 `buildMeetingContextForPersistence`로 영속 형태를 모은 것도 응집도 면에서 납득됩니다. 다만 계획서와의 불일치(레이아웃 토스트 테스트 경로, 네비게이션 방식)와 레이어 간 결합 몇 가지는 후속 정리 여지가 있습니다.

## Architecture Findings

### [MEDIUM] 계획 대비 Toaster 검증 위치 불일치

계획 Step 11은 `src/app/__tests__/layout-toaster.test.tsx`를 명시했는데, 변경 파일 목록에는 해당 테스트가 없고 대신 `AppToaster` 클라이언트 래퍼(`src/components/app-toaster.tsx`)로 루트 레이아웃이 구성되었습니다. 래퍼 분리 자체는 서버/클라이언트 경계 측면에서 합리적이나, **“계획에 적힌 산출물(파일 경로·테스트 위치)”과 저장소 실제 구조가 어긋나** 이후 이슈/리뷰어가 계획만 보고 파일을 찾기 어려워질 수 있습니다. 계획을 갱신하거나, 동등한 검증을 `app` 트리 규칙에 맞는 경로로 옮겨 문서와 맞추는 편이 좋습니다.

### [MEDIUM] 세션 이동: 계획·아키텍처 문서와 다른 내비게이션 전략

계획과 이슈 초안은 `next/navigation`의 `useRouter` / `router.push`를 전제로 했고, `docs/ARCHITECTURE.md`도 같은 탭에서의 **클라이언트 측 흐름**을 전제로 파이프라인을 설명합니다. 구현은 `PipelineToastNotifier`에서 `window.location.assign`을 사용해, **App Router 클라이언트 내비게이션 계층을 우회**합니다. 의도된 선택일 수는 있으나, “프레임워크가 제공하는 라우팅 추상화 vs 직접 `window`”가 코드베이스 나머지와 한 축으로 맞춰지지 않으면 유지보수 시 혼선이 생깁니다. 계획을 실제 구현에 맞게 고치거나, `useRouter().push`로 통일하는 쪽이 아키텍처 일관성에 유리합니다.

### [LOW] `Session` 영속 모델이 `MeetingContext`에 직접 결합

`src/lib/db.ts`의 `Session`이 `@/lib/glossary/types`의 `MeetingContext`를 그대로 참조합니다. 규모가 작을 때는 실용적이지만, 저장 스키마가 API/LLM 입력 모델과 **동일 타입으로 묶이면** 필드 추가·이름 변경 시 파급 범위가 커집니다. 당장 문제라기보다는, 장기적으로는 `SessionMeetingContext` 같은 저장 전용 타입을 두거나 `Pick`/`zod` 스키마로 분리할 여지가 있습니다.

### [LOW] API 파서의 관대한 형태와 용어 파서의 엄격함 대비

`parseGlossary`는 배열이 아니면 실패하지만, `parseSessionContext`는 객체이기만 하면 알 수 없는 키를 무시하고 문자열이 아닌 필드는 빈 문자열로 흡수합니다. **의도된 관대한 파싱**이면 주석이나 공통 `parseBodyField` 패턴으로 “왜 400이 아닌지”를 코드 차원에서 고정해 두면, 이후 기여자가 엄격화했을 때 깨지는 테스트/계약을 줄일 수 있습니다.

## Code Style Findings

### [LOW] `PipelineToastNotifier` 테스트 하네스의 `isBusy`가 실제 Provider와 다름

`pipeline-toast-notifier.test.tsx`의 `Harness`가 `phase === "done"`일 때만 `isBusy: true`로 둡니다. 실제 `PostRecordingPipelineProvider`는 `transcribing` / `summarizing` / `done`에서 `isBusy`가 참입니다. 토스트 컴포넌트는 `isBusy`를 쓰지 않아 현재는 무해하지만, **테스트 더블이 프로덕션 값 규칙과 어긋나** 있어 향후 리팩터 시 헷갈릴 수 있습니다. `mkValue`에서 실제 메모이즈 로직을 재사용하거나 Provider를 그대로 감싸는 편이 읽기에 안전합니다.

### [LOW] 용어 Context와 설정 Context의 상태 업데이트 스타일 차이

`SettingsProvider`는 `setSettings(prev => …)` 형태로 이전 상태를 기준으로 병합하고, `GlossaryProvider`는 `updateGlossary`가 항상 전체 배열을 대체합니다. 둘 다 타당하지만, **“전역 localStorage Context” 패밀리**로 보면 한쪽은 함수형 업데이트, 한쪽은 완전 치환으로 보여 약간의 미세한 스타일 불균형이 있습니다. 의도적이면 그대로 두어도 됩니다.

## Verdict

**PASS_WITH_NOTES**
