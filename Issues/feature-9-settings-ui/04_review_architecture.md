---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  subagent_model: "composer"
  feature: "feature-9-settings-ui"
  review_kind: architecture
---

# Architecture & Code Style Review

설정 도메인(`src/lib/settings`), 녹음 활동 전역 플래그(`src/lib/recording-activity`), `(main)` 레이아웃의 클라이언트 Provider 래퍼, `MainShell`·`Recorder`·`SettingsPanel` 연동을 기준으로 검토했습니다.

## Summary

App Router에서 **RSC 레이아웃 + 얇은 클라이언트 Provider 경계**를 유지하고, 순수 타입·파서는 `types.ts`에 두어 서버/클라이언트 공유 가능성을 열어 둔 점은 방향이 좋습니다. Provider 중첩 순서(`Settings` → `RecordingActivity` → children)는 하위 트리가 두 Context를 모두 쓸 수 있게 하며, `Recorder`가 `isRecording`의 사실상 단일 갱신자인 구조도 단순합니다. 다만 **계획서의 문서 갱신 완료 조건**과 `docs/` 현재 내용이 맞지 않고, `SettingsPanel`의 다이얼로그 패턴은 키보드/포커스 측면에서 한 단계 보강 여지가 있습니다.

## Architecture Assessment

### Next.js App Router / 클라이언트 경계

- `src/app/(main)/layout.tsx`는 기본적으로 RSC로 두고, `"use client"`인 `MainAppProviders`만 조합하는 형태는 **전형적이고 적절**합니다. 레이아웃 전체를 클라이언트로 올리지 않아 불필요한 번들 확장을 피합니다.
- `src/lib/settings/types.ts`는 `"use client"` 없이 순수 타입·`parseTranscriptionSettings`만 제공하므로, 향후 Server Component나 Route Handler에서 import해도 경계가 깨지지 않습니다.
- `context.tsx`, `recording-activity/context.tsx`, `main-app-providers.tsx`, `settings-panel.tsx`, `main-shell.tsx`, `recorder.tsx`는 모두 클라이언트 훅/브라우저 API를 쓰는 위치에 두였고, **경계가 명확**합니다.

### `src/` 배치·모듈화

- `src/lib/settings/`에 타입·파서·Context를 묶은 것은 **도메인 단위 응집**에 맞습니다. 계획서에 있던 선택적 `parse.ts` 분리는 생략되었으나, 현재 `types.ts` 규모에서는 **과도한 분리를 하지 않은 합리적 선택**입니다.
- `src/lib/recording-activity/context.tsx`는 UI보다는 **앱 전역 세션 신호**에 가깝습니다. `components/providers`에만 두는 팀도 있으나, `settings`와 대칭으로 `lib`에 두는 것은 **일관된 규칙만 문서화되면** 수용 가능합니다.

### 결합도·책임(SOLID 관점)

- **Settings**: `SettingsProvider`는 저장·파싱·갱신 API만 노출하고, UI는 `useSettings`로 소비 — 단일 책임에 가깝습니다.
- **Recording activity**: `MainShell`(설정 버튼·패널)과 `Recorder`(실제 녹음 상태)를 잇기 위한 **얇은 전역 컨텍스트**로 역할이 제한되어 있고, `setIsRecording` 사용처가 `Recorder`에만 있는 점은 **단일 작성자**에 가깝게 유지됩니다.
- **Recorder**: `settings.mode !== "realtime"`이면 `prepareStreaming`을 호출하지 않아, `useTranscription`이 마운트 시 네트워크를 열지 않는 기존 설계와도 **충돌하지 않습니다**.

### Provider 순서 (`Settings` > `RecordingActivity`)

- 바깥이 `Settings`이므로 트리 어디서든 `useSettings` 사용이 가능하고, 안쪽 `RecordingActivity`는 설정과 무관한 짧은 수명 UI 상태에 가깝습니다.

### 계획 대비 편차

- 계획의 **Step 6**는 `SettingsProvider`만 `(main)`에 연결하는 것이었고, 실제로는 `RecordingActivityProvider`까지 같은 래퍼에 넣었습니다. 이는 **헤더·패널이 녹음 중 비활성화를 알아야 한다**는 요구를 만족시키기 위한 합리적 확장으로 보이며, 계획서에 “RecordingActivity는 설정 UI와의 교차 관심사” 한 줄 보강을 권장합니다.
- 계획 **완료 조건**에 `docs/DECISIONS.md`, `docs/ARCHITECTURE.md` 갱신이 포함되어 있는데, 리뷰 시점에는 `docs`에 `MainAppProviders` / `SettingsProvider` / storage 키 등이 **반영되어 있지 않았습니다**.

## Code Style Notes

- 네이밍: `MainAppProviders`, `SettingsProvider`, `RecordingActivityProvider`, `parseTranscriptionSettings` 등은 역할이 읽힙니다.
- `SETTINGS_STORAGE_KEY`를 `context`에서 export해 테스트·단일 진실 공급원으로 쓰기 좋습니다.
- `SettingsPanel`에서 `role="dialog"`·`aria-labelledby`·배경 클릭 닫기는 잘 갖췄습니다.
- `main-shell.tsx`의 설정 버튼에 `disabled={isRecording}`만 있고 `aria-disabled`는 없습니다. **일관되게 접근성 속성을 맞추려면** 버튼에도 보조 설명이나 `aria-disabled` 정렬을 검토할 수 있습니다.

## Findings

| 심각도         | 내용                                                                                                                   | 권장 조치                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Important**  | 계획 완료 조건의 문서(`DECISIONS.md`, `ARCHITECTURE.md`)가 설정·Provider·storage 키·Feature 10/11 경계를 반영하지 않음 | 스토리지 키, 기본값, Provider 트리, `(main)` 한정 범위를 짧게라도 문서에 추가        |
| **Important**  | 계획 Step 5에서 제안한 `buildTranscriptionHookOptions(settings)` 같은 추출은 미적용                                    | 필수는 아니나, `Recorder`가 커지면 옵션 조립을 순수 헬퍼로 분리해 테스트·가독성 향상 |
| **Suggestion** | `SettingsPanel` 모달: 포커스 트랩, 초기 포커스, Escape 닫기 등은 디자인 시스템 수준에서 선택                           | Radix Dialog 등 프로젝트 표준이 있으면 정렬                                          |
| **Suggestion** | `recording-activity`를 `lib`에 둔 규칙을 `CONVENTIONS.md` 또는 `CODEMAP`에 명시                                        | 신규 Context 추가 시 위치 논쟁 방지                                                  |
| **Suggestion** | `useTranscription`은 비-realtime 모드에서도 항상 마운트됨. 현재는 `prepareStreaming` 전까지 네트워크가 없어 수용 가능  | 장기 복잡도가 올라갈 때만 검토                                                       |

## Verdict

**조건부 통과(Conditional pass).** App Router 클라이언트 경계·`src/lib` vs 컴포넌트 역할·Provider 설계는 전반적으로 건전합니다. **문서 완료 조건이 계획에 명시되어 있으므로**, `docs` 동기화 후 **완전 통과**로 보는 것이 좋습니다.
