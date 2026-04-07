# 아키텍처 및 코드 스타일 리뷰 (요약)

- Provider 추가로 `index.ts` re-export·팩토리 패턴이 AssemblyAI와 대칭을 이룸.
- 16kHz 파이프라인 유지 + Provider 내부 24kHz 리샘플로 오디오 모듈 변경 최소화.
- `useAssemblyAiPcmFraming` 옵션으로 레거시 프레이밍을 분리해 훅 단일 구현 유지.
