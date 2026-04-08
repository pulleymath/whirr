# Feature 4: IndexedDB 기반 세션 저장소 연동

## 1. 개요

녹음이 완료된 후 확정된 전사 텍스트와 메타데이터를 브라우저의 IndexedDB에 자동 저장하는 기능을 구현합니다. 서버에 데이터를 저장하지 않고 클라이언트 로컬에만 보관합니다.

## 2. 상세 기획 (Detailed Plan)

- **IndexedDB 설정 및 스키마 정의**: `src/lib/db.ts`
  - IndexedDB 래퍼 라이브러리(예: `idb`)를 설치하여 데이터베이스 초기화 로직 작성.
  - 데이터베이스명: `whirr-db`, 스토어명: `sessions`
  - 스키마 필드: `id` (string, UUID), `createdAt` (number, timestamp ms), `text` (string, 최종 확정 텍스트)
  - 인덱스: `createdAt` 필드에 인덱스 생성 (날짜별 정렬 및 그룹화 용도)
- **CRUD 유틸리티 함수 구현**:
  - `saveSession(text: string): Promise<string>` - 새 세션 저장 후 ID 반환
  - `getAllSessions(): Promise<Session[]>` - 모든 세션 조회
  - `getSessionById(id: string): Promise<Session | undefined>` - 특정 세션 조회
- **녹음 종료 이벤트 연동**:
  - `use-transcription.ts` 또는 메인 페이지에서 녹음 중지 이벤트 발생 시, 최종 전사 텍스트가 비어있지 않으면 `saveSession` 함수를 호출하여 IndexedDB에 자동 저장하도록 로직 연동.

## 3. 완료 조건 (Done Criteria)

- [ ] IndexedDB 데이터베이스(`whirr-db`)와 `sessions` 스토어가 정상적으로 생성된다.
- [ ] 녹음을 중지했을 때, 전사 텍스트가 존재하면 IndexedDB의 `sessions` 스토어에 새로운 세션 레코드가 생성된다.
- [ ] 저장된 데이터에 고유 ID, 생성 시각(`createdAt`), 최종 텍스트(`text`)가 정확히 포함되어 있다.
- [ ] 오디오 데이터(PCM 등)는 저장되지 않고 텍스트만 저장된다.
