# Feature 2: 웹 오디오 녹음 및 마이크 캡처 — 개발 계획서

## 개발 범위

- **마이크 입력**: `navigator.mediaDevices.getUserMedia({ audio: true })`로 오디오 스트림 획득 및 권한 처리(허용/거부, 사용자에게 메시지 표시).
- **처리 파이프라인**: `AudioContext` + `AudioWorklet`으로 실시간 처리. 워클릿은 **반드시** `public/audio-processor.js` 단일 파일로 제공(번들과 분리).
- **출력 형식**: STT 전송에 맞춘 **PCM 16-bit, 16 kHz, mono** 청크를 워클릿에서 생성해 메인 스레드로 전달(예: `MessagePort` / `postMessage`).
- **라이브러리 계층**: `src/lib/audio.ts`에서 스트림 획득·컨텍스트/노드 연결·워클릿 로드·정리(`stop`/트랙 `stop`/`close`)를 캡슐화.
- **상태/훅**: `src/hooks/use-recorder.ts`에서 녹음 시작/중지, 권한·런타임 오류 상태, 경과 시간 타이머, PCM 청크 콜백 연결.
- **UI**: `src/components/recorder.tsx`에서 시작/중지 버튼, 경과 시간 표시, 마이크 입력에 반응하는 **레벨 바 또는 단순 웨이브폼** 시각화.
- **페이지 통합**: `src/app/page.tsx`에 `Recorder` 배치해 실제 브라우저에서 동작 검증 가능하게 함.
- **테스트 범위**: Node(Vitest) 환경 한계를 인정하고, **파일 존재·정적 계약·순수 로직** 위주로 RED→GREEN을 유지. 브라우저 전용 동작은 수동/향후 E2E로 보완.

## 기술적 접근 방식

- **Next.js 16 App Router**: `Recorder`는 클라이언트 컴포넌트(`"use client"`)로 두고, `getUserMedia`/`AudioContext`는 **클라이언트에서만** 호출.
- **워클릿 URL**: `audioContext.audioWorklet.addModule("/audio-processor.js")`처럼 `public/` 정적 경로로 로드(빌드 후에도 동일 public URL).
- **샘플레이트**: 입력 디바이스 샘플레이트와 무관하게, 워클릿에서 **16 kHz mono Int16**으로 다운믹스/리샘플링.
- **레벨 미터**: `AnalyserNode`로 RMS/피크를 읽어 React state로 반영.
- **정리 순서**: 중지 시 — 워클릿/노드 연결 해제 → `MediaStreamTrack.stop()` → `AudioContext.close()` → 타이머 클리어 → 콜백 참조 해제(누수 방지).
- **오류 UX**: `NotAllowedError`, `NotFoundError` 등 `DOMException`/`Error` 이름·메시지를 사용자용 한 줄 문구로 매핑(`src/lib/audio.ts`).

## TDD 구현 순서

### Step 1: 아키텍처 파일·디렉터리 계약 (structure)

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/__tests__/structure.test.ts` (기존 확장)
- 테스트 케이스 목록
  - `public/audio-processor.js` 파일이 존재한다.
  - `src/lib/audio.ts`가 존재한다.
  - `src/hooks/use-recorder.ts`가 존재한다.
  - `src/components/recorder.tsx`가 존재한다.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: 위 경로에 최소 스텁, `public/audio-processor.js`는 Step 2에서 즉시 채움.

**REFACTOR** — 코드 개선

- structure 테스트에 중복 경로 상수가 생기면 배열/헬퍼로 묶어 가독성만 정리.

### Step 2: `audio-processor.js` 정적 계약 및 PCM 16kHz mono 동작

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/__tests__/audio-processor.contract.test.ts`
- 테스트 케이스 목록: 파일 내용에 `AudioWorkletProcessor`, `16000`, mono/Int16 처리, `registerProcessor` 포함 여부.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `public/audio-processor.js`

**REFACTOR** — 코드 개선

- 매직 넘버 상수화, 할당 최소화.

### Step 3: `src/lib/audio.ts` — 스트림·컨텍스트·워클릿 연동 API

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/lib/audio.test.ts`
- 테스트 케이스 목록: `getUserMedia` 모킹 성공/실패, `mapMediaErrorToMessage` 등 순수 함수.

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/lib/audio.ts`

**REFACTOR** — 코드 개선

- 에러 매핑 통합, public API 최소화.

### Step 4: `use-recorder` — 타이머·상태·PCM 콜백

**RED** — 실패하는 테스트 작성

- 테스트 파일: `src/hooks/use-recorder.test.ts` (브라우저 API 모킹 + `vi.useFakeTimers`)

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: `src/hooks/use-recorder.ts`

**REFACTOR** — 코드 개선

- 타이머 `useRef` 통합, 중복 `stop` 안전 처리.

### Step 5: `Recorder` UI

**GREEN** (structure/수동 QA 우선)

- 구현 파일: `src/components/recorder.tsx`

### Step 6: 페이지 통합

**GREEN**

- 구현 파일: `src/app/page.tsx`에 `Recorder` 배치.

## 파일 변경 계획

| 경로                                             | 변경 유형 | 설명                                  |
| ------------------------------------------------ | --------- | ------------------------------------- |
| `public/audio-processor.js`                      | 신규      | AudioWorkletProcessor, PCM 16kHz mono |
| `src/lib/audio.ts`                               | 신규      | getUserMedia, AudioContext, worklet   |
| `src/hooks/use-recorder.ts`                      | 신규      | 녹음 상태, 타이머, 에러               |
| `src/components/recorder.tsx`                    | 신규      | UI + 레벨 시각화                      |
| `src/app/page.tsx`                               | 수정      | Recorder 노출                         |
| `src/__tests__/structure.test.ts`                | 수정      | 필수 파일 assert                      |
| `src/__tests__/audio-processor.contract.test.ts` | 신규      | 워클릿 정적 계약                      |
| `src/lib/audio.test.ts`                          | 신규      | audio 모듈 모킹 테스트                |
| `src/hooks/use-recorder.test.ts`                 | 신규      | 훅 모킹 테스트                        |

## 완료 조건

- 마이크 권한 허용/거부 및 거부 시 에러 메시지.
- 녹음 시작 시 타이머 동작, 중지 시 멈춤.
- 마이크 입력에 따른 레벨 시각화.
- AudioWorklet으로 PCM 16-bit 16kHz mono 청크 콜백 전달.
- 중지 시 캡처·타이머 완전 중단.

## 테스트 전략

- Node(Vitest): 구조·워클릿 문자열 계약·`getUserMedia` 모킹·순수 함수.
- 수동: 실제 브라우저에서 마이크 허용/거부 확인.
- 매 커밋 `npm test` 전체 통과.
