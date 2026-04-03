---
name: issue-driven-dev
description: Issue-driven development workflow with TDD, parallel code review, and quality gates. Use when the user assigns an issue, asks to work on a feature, or says "이슈 작업 시작", "{feature} 작업해줘", or references a specific feature issue file. Orchestrates the full cycle from branch creation through merge.
---

# Issue-Driven Development

이슈 파일을 기반으로 브랜치 생성 → TDD 계획 수립 → 구현 → 병렬 리뷰 → 수정 → 품질 검증 → 병합까지의 전체 사이클을 자동 수행한다.

## Artifacts

모든 산출물은 `Issues/{feature}/` 디렉토리에 생성한다. 피쳐 디렉토리명은 이슈 파일명에서 `.md`를 제외한 값이다.

| 순서 | 파일                          | 내용                         | 생성 단계 |
| ---- | ----------------------------- | ---------------------------- | --------- |
| 0    | `00_issue.md`                 | 원본 이슈 문서               | Phase 0   |
| 1    | `01_plan.md`                  | TDD 기반 개발 계획서         | Phase 1   |
| 2    | `02_review_implementation.md` | 기능 구현 및 테스트 리뷰     | Phase 3   |
| 3    | `03_review_security.md`       | 성능 및 보안 리뷰            | Phase 3   |
| 4    | `04_review_architecture.md`   | 아키텍처 및 코드 스타일 리뷰 | Phase 3   |
| 5    | `05_review_synthesis.md`      | 종합 리뷰 및 액션 아이템     | Phase 4   |
| 6    | `06_fixes.md`                 | 리뷰 반영 수정 기록          | Phase 5   |
| 7    | `07_summary.md`               | 전체 작업 요약               | Phase 7   |

## Phase 0: 준비

1. 이슈 파일 읽기 (`Issues/{issue-file}.md`)
2. 프로젝트 문서 읽기: `docs/README.md`
3. `Issues/STATUS.md`에서 해당 이슈 상태를 `🔄 진행 중`으로 변경
4. 피쳐 이름 추출 (이슈 파일명에서 `.md` 제외한 값)
5. 브랜치 생성 및 체크아웃:

```bash
git checkout -b {feature-name}
```

6. `Issues/{feature}/` 디렉토리 생성
7. 이슈 파일을 `Issues/{feature}/00_issue.md`로 복사

## Phase 1: 계획 수립

**Task 도구 사용 — 모델: `claude-4.6-opus-max-thinking`**

`subagent_type: "generalPurpose"` 로 계획 수립 에이전트를 실행한다.

### 에이전트에게 전달할 컨텍스트

- 이슈 파일 전체 내용
- `docs/README.md`
- 기존 코드베이스 구조 (필요 시)

### 계획서 필수 포함 사항

```markdown
# {Feature Name} — 개발 계획서

## 개발 범위

## 기술적 접근 방식

## TDD 구현 순서

각 단계는 아래 형식을 따른다:

### Step N: {기능 단위 설명}

**RED** — 실패하는 테스트 작성

- 테스트 파일: {경로}
- 테스트 케이스 목록

**GREEN** — 테스트를 통과하는 최소 구현

- 구현 파일: {경로}
- 핵심 구현 내용

**REFACTOR** — 코드 개선

- 리팩토링 대상 및 방향

## 파일 변경 계획

## 완료 조건

## 테스트 전략
```

### 산출물

`Issues/{feature}/01_plan.md`에 Write 도구로 작성. 에이전트의 응답 전문을 파일에 저장한다.

## Phase 2: 구현

**모델: 기본 모델 (auto) — Task 도구 사용 시 `model` 파라미터를 지정하지 않는다. 사용자가 별도로 모델을 명시한 경우에만 해당 모델을 사용한다.**

`01_plan.md`를 읽고 TDD 순서에 따라 직접 구현한다.

각 Step마다:

1. **RED**: 실패하는 테스트 작성 → `npm test` 실행 → 실패 확인
2. **GREEN**: 테스트 통과하는 최소 코드 구현 → `npm test` 실행 → 통과 확인
3. **REFACTOR**: 중복 제거, 네이밍/구조 개선 → `npm test` 실행 → 여전히 통과 확인

모든 Step 완료 후 전체 테스트 실행하여 regression 없음을 확인한다.

## Phase 3: 병렬 코드 리뷰

**3개의 Task를 동시에 실행한다.** 반드시 하나의 메시지에서 3개의 Task 도구를 병렬 호출한다.

### 공통 컨텍스트 (모든 리뷰어에게 전달)

- `01_plan.md` 전문
- `git diff main` 출력 (변경 내용 전체)
- `git diff --name-only main` 출력 (변경 파일 목록)

### 3-1. 기능 구현 및 테스트 리뷰

- Task `subagent_type`: `code-reviewer`
- `.cursor/agents/implementation-reviewer.md`의 시스템 프롬프트를 프롬프트에 포함
- 산출물: `Issues/{feature}/02_review_implementation.md`
- 에이전트가 리뷰 결과를 반환하면 Write 도구로 파일 저장

### 3-2. 성능 및 보안 리뷰

- Task `subagent_type`: `security-reviewer`
- `.cursor/agents/security-reviewer.md`의 시스템 프롬프트를 프롬프트에 포함
- 산출물: `Issues/{feature}/03_review_security.md`

### 3-3. 아키텍처 및 코드 스타일 리뷰

- Task `subagent_type`: `code-reviewer`
- `.cursor/agents/architecture-reviewer.md`의 시스템 프롬프트를 프롬프트에 포함
- 산출물: `Issues/{feature}/04_review_architecture.md`

## Phase 4: 리뷰 종합

3개 리뷰가 모두 완료된 후 실행한다.

- Task `subagent_type`: `generalPurpose`
- `.cursor/agents/review-synthesizer.md`의 시스템 프롬프트를 프롬프트에 포함
- 입력: 3개 리뷰 문서 (`02_review_implementation.md`, `03_review_security.md`, `04_review_architecture.md`) 전문
- 산출물: `Issues/{feature}/05_review_synthesis.md`

## Phase 5: 수정

`05_review_synthesis.md`를 읽고 즉시 수정이 필요한 항목을 처리한다.

- 심각도 CRITICAL, HIGH 항목은 반드시 수정
- MEDIUM 항목은 판단하여 수정
- 수정마다 관련 테스트 실행으로 regression 확인
- 수정 사항이 없으면 "수정 필요 항목 없음"으로 기록

### 산출물: `Issues/{feature}/06_fixes.md`

```markdown
# 리뷰 반영 수정 기록

## 수정 항목

### 1. {이슈 제목}

- 심각도: {CRITICAL/HIGH/MEDIUM}
- 출처: {02/03/04 중 어떤 리뷰}
- 수정 내용: {변경 요약}
- 변경 파일: {파일 경로}

## 미수정 항목 (사유 포함)

## 수정 후 테스트 결과
```

## Phase 6: 품질 게이트

아래 명령을 순서대로 실행한다. 하나라도 실패하면 수정 후 전체를 다시 실행한다.

```bash
npx tsc --noEmit          # 타입 체크
npx eslint .              # 린트
npx prettier --check .    # 포매팅
npm test                  # 테스트
npm run build             # 빌드
```

모든 검사가 통과할 때까지 반복한다.

## Phase 7: 문서화 및 병합

### 7-1. 작업 요약 작성

`Issues/{feature}/07_summary.md`:

```markdown
# {Feature Name} — 작업 요약

## 구현된 기능

## 주요 기술적 결정

## 테스트 커버리지

## 파일 변경 목록

## 알려진 제한 사항

## 다음 단계 (해당 시)
```

### 7-2. 프로젝트 문서 업데이트

`docs/` 하위 문서에 변경/추가 사항이 있으면 반영한다.

### 7-3. 이슈 상태 업데이트

`Issues/STATUS.md`에서 해당 이슈를 `✅ 완료`로 변경한다.

### 7-4. 커밋 및 병합

```bash
git add -A
git commit -m "{feature-name}: 구현 완료"
git checkout main
git merge {feature-name}
git push origin main
git branch -d {feature-name}
```
