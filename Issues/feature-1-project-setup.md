# Feature 1: 프로젝트 기반 설정 및 아키텍처 구성

## 1. 개요

Next.js (App Router) 기반의 프로젝트 초기 환경을 구성하고, Vercel 배포를 위한 파이프라인을 준비합니다. 또한, 향후 STT 엔진 교체를 대비하여 프론트엔드에 STT Provider 추상화 계층을 설계합니다.

## 2. 상세 기획 (Detailed Plan)

- **프로젝트 초기화**: Next.js (App Router), TypeScript, Tailwind CSS를 사용하여 기본 뼈대를 구성합니다.
- **디렉토리 구조 셋업**: `src/app`, `src/components`, `src/hooks`, `src/lib`, `src/types` 등 아키텍처 문서에 명시된 구조를 생성합니다.
- **STT Provider 추상화 인터페이스 정의**: `src/lib/stt/types.ts` 파일에 `TranscriptionProvider` 인터페이스를 정의하여, UI 코드가 특정 STT 서비스(AssemblyAI 등)에 종속되지 않도록 설계합니다.
  - `connect(onPartial, onFinal, onError): Promise<void>`
  - `sendAudio(pcmData: ArrayBuffer): void`
  - `stop(): Promise<void>`
  - `disconnect(): void`
- **환경 변수 템플릿 작성**: `.env.local` 템플릿을 생성하고, 서버 전용 환경 변수인 `ASSEMBLYAI_API_KEY`를 설정합니다. (`NEXT_PUBLIC_` 접두사 사용 금지)
- **Vercel 배포 연동**: GitHub 리포지토리와 Vercel을 연결하여 CI/CD 파이프라인이 정상 동작하는지 테스트합니다.

## 3. 완료 조건 (Done Criteria)

- [ ] Next.js 기본 페이지가 로컬 브라우저에서 정상적으로 렌더링된다.
- [ ] `TranscriptionProvider` 인터페이스가 TypeScript로 명확하게 정의되어 있다.
- [ ] Vercel에 성공적으로 배포되어 외부에서 URL로 접근 가능하다.
- [ ] `.env.local` 파일에 필요한 환경 변수 템플릿이 작성되어 있다.
