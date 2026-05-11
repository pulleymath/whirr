# Whirr — 용어집

Whirr 문서·코드에서 반복되는 **개념**만 짧게 정의한다. 구현 세부(파일명·필드·API)는 넣지 않는다. 시스템 경계·책임은 [ARCHITECTURE.md](./ARCHITECTURE.md), 채택 이유·정책은 [DECISIONS.md](./DECISIONS.md)를 본다.

---

## 저장·데이터

### IndexedDB (이 앱 맥락)

브라우저 안의 **클라이언트 전용** 영속 저장소. Whirr에서는 서버에 사용자 본문을 두지 않는 범위에서, **세션 단위**로 제목·스크립트·요약·맥락 등을 보관하고 목록·정렬·날짜 그룹에 쓴다. 오디오 원본의 장기 보관 대상은 아니다. 개요는 [ARCHITECTURE.md](./ARCHITECTURE.md)의 «데이터가 머무는 곳», «로컬 저장소»를 참고한다.

### 세션(session) 저장 단위

한 번의 녹음·전사·요약 흐름을 묶는 **논리적 단위**. UI·로컬 저장(목록, 제목, 스크립트, 요약, 맥락)이 이 단위로 정리된다. [ARCHITECTURE.md](./ARCHITECTURE.md)의 «로컬 저장소»와 대응한다.

---

## 전사·STT

### partial / final 전사

**부분(partial)**: 아직 확정되지 않은 구간의 **중간** 전사로, UI에서 문장이 갱신되는 형태로 쓰인다.  
**최종(final)**: 구간이 **확정**된 전사로, 누적 표시에 더해지는 단위다.  
STT 어댑터는 공급자별 이벤트를 이 둘(및 오류)로 **정규화**한다. [ARCHITECTURE.md](./ARCHITECTURE.md)의 «전사 계층»을 참고한다.

### STT Provider

**STT(Speech-to-Text)**: 음성을 텍스트로 바꾸는 외부·내부 엔진·서비스를 통칭한다.  
**Provider(공급자·어댑터)**: 특정 STT의 연결 방식·프로토콜 차이를 **같은 UI 이벤트**(부분/최종/오류 등)로 맞추는 **추상화 층**을 가리키는 말로 쓴다. 원칙은 [DECISIONS.md](./DECISIONS.md)의 «프론트엔드·앱 형태»와 [ARCHITECTURE.md](./ARCHITECTURE.md)의 «교체 가능성»과 같다.

### 기본 일괄 전사 경로 vs 대체 실시간 경로

**기본 경로**: 현재 제품의 기본 STT·전사 흐름은 **녹음 후 일괄 전사**다. 안정적인 저장·요약 흐름을 우선한다.
**대체 경로**: 실시간 STT·브라우저 내장 전사는 개발·교체 가능성 범위에서 유지된다. 요지는 [DECISIONS.md](./DECISIONS.md)의 «STT 경로»를 본다.

---

## 보안·자격 증명

### 에피메랄 토큰(ephemeral token)

**짧은 수명**의 자격 증명. 장기 API 키를 브라우저·공개 번들에 두지 않고, 서버 경계에서 외부 서비스 연결을 보호할 때 쓰는 패턴을 가리킨다. [ARCHITECTURE.md](./ARCHITECTURE.md)의 «호스팅 앱», «운영·비밀», [DECISIONS.md](./DECISIONS.md)의 «백엔드 범위», «서버 요청 보호»와 연결된다.

---

## 관련 문서

- [ARCHITECTURE.md](./ARCHITECTURE.md) — 경계·책임·데이터 위치
- [DECISIONS.md](./DECISIONS.md) — 기술·정책 결정
- [README.md](./README.md) — `docs/` 인덱스
