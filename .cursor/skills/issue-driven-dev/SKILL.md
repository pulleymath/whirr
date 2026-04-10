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

## 금지 사항 및 게이트 (Subagent 필수 구간)

아래 구간에서는 **메인 에이전트가 동일 역할을 대신 수행하는 것을 금지**한다. 산출물은 **지정된 Task(subagent)의 반환값**을 기준으로만 작성한다.

### Phase 1 (계획)

- **금지**: 메인 에이전트가 `01_plan.md`의 본문(개발 범위, TDD Step, 파일 계획 등)을 **직접 작성·요약·재작성**하는 것.
- **게이트**: `Task`(`subagent_type: generalPurpose`)를 **먼저** 호출하고, 그 **응답 전문**(아래 [검증 가능한 흔적](#검증-가능한-흔적-산출물-메타데이터)에 맞는 형식 포함)을 `01_plan.md`에 저장한 뒤에만 Phase 2로 진행한다.
- **예외 없음**: Task 실패·타임아웃 시에는 Phase 2로 넘어가지 않고 Task를 재시도하거나 사용자에게 보고한다.
- **금지**: `Task`를 호출할 때 `claude-4.6-opus-max-thinking`외 다른 모델을 사용하는 것.

### Phase 3 (병렬 리뷰)

- **금지**: 메인 에이전트가 `02_review_*.md`, `03_review_*.md`, `04_review_*.md` 내용을 **직접 작성**하는 것.
- **게이트**: **동일한 assistant 메시지(턴)**에서 `Task`를 **정확히 3번** 병렬 호출한 뒤, 각 Task 응답을 해당 파일에 저장한다. 3번이 아니면 파일을 쓰지 않는다.
- **금지**: 한 번에 한 리뷰만 Task로 돌리고 나머지는 직접 쓰는 것.
- **금지**: `Task`를 호출할 때 `auto`외 다른 모델을 사용하는 것.

### Phase 4 (리뷰 종합)

- **금지**: 메인 에이전트가 `05_review_synthesis.md`를 **직접 작성**하는 것.
- **게이트**: `Task`(`subagent_type: generalPurpose` + review-synthesizer 프롬프트) 응답을 저장한 뒤에만 Phase 5로 진행한다.

### Phase 2·5·6·7

- Subagent 강제 구간이 아니다. 다만 Phase 5는 **`05_review_synthesis.md`가 Phase 4 게이트를 통과한 파일**일 때만 수행한다.

## 검증 가능한 흔적 (산출물 메타데이터)

Subagent가 만든 문서는 **파일 최상단에 YAML 프론트 매터 한 블록**을 두어 출처를 남긴다. 메인 에이전트는 Task 프롬프트에 **반드시** 아래 형식을 출력하라고 명시한다.

공통 키(모든 해당 파일):

| 키                               | 필수 | 설명                                                |
| -------------------------------- | ---- | --------------------------------------------------- |
| `issue_driven_dev.source`        | 예   | 항상 문자열 `subagent`                              |
| `issue_driven_dev.phase`         | 예   | `plan` \| `review` \| `synthesis`                   |
| `issue_driven_dev.subagent_type` | 예   | Task에 사용한 `subagent_type` 값 (문자열)           |
| `issue_driven_dev.feature`       | 예   | `Issues/{feature}/`의 `{feature}` 디렉터리명과 동일 |

리뷰 전용(`02`/`03`/`04`):

| 키                             | 필수 | 설명                                                                     |
| ------------------------------ | ---- | ------------------------------------------------------------------------ |
| `issue_driven_dev.review_kind` | 예   | `implementation` \| `security` \| `architecture` (`02`/`03`/`04`와 일치) |

### `01_plan.md` 예시 (파일 맨 앞)

```yaml
---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: "{feature-directory-name}"
---
```

### `02` / `03` / `04` 예시 (각 파일 맨 앞)

```yaml
---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "{feature-directory-name}"
  review_kind: implementation
---
```

`03`은 `subagent_type: security-reviewer`, `review_kind: security`.  
`04`는 `subagent_type: code-reviewer`, `review_kind: architecture`.

### `05_review_synthesis.md` 예시 (파일 맨 앞)

```yaml
---
issue_driven_dev:
  source: subagent
  phase: synthesis
  subagent_type: generalPurpose
  feature: "{feature-directory-name}"
---
```

**검증**: PR·셀프체크 시 위 프론트 매터 존재 및 `review_kind`·파일명 일치를 확인하면, Subagent 생략 여부를 기계적으로 걸러내기 쉽다.

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

파일 **첫 줄부터** [검증 가능한 흔적](#검증-가능한-흔적-산출물-메타데이터)의 `01_plan.md` YAML 블록을 두고, 이어서 본문을 작성한다.

```markdown
---
issue_driven_dev:
  source: subagent
  phase: plan
  subagent_type: generalPurpose
  feature: "{feature-directory-name}"
---

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

`Issues/{feature}/01_plan.md`에 Write 도구로 작성한다. 내용은 **계획 Task의 응답 전문**이며, [금지 사항 및 게이트](#금지-사항-및-게이트-subagent-필수-구간) 및 [검증 가능한 흔적](#검증-가능한-흔적-산출물-메타데이터)을 만족해야 한다.

## Phase 2: 구현

**모델: 기본 모델 (auto) — Task 도구 사용 시 `model` 파라미터를 지정하지 않는다. 사용자가 별도로 모델을 명시한 경우에만 해당 모델을 사용한다.**

`01_plan.md`를 읽고 TDD 순서에 따라 직접 구현한다.

각 Step마다:

1. **RED**: 실패하는 테스트 작성 → `npm test` 실행 → 실패 확인
2. **GREEN**: 테스트 통과하는 최소 코드 구현 → `npm test` 실행 → 통과 확인
3. **REFACTOR**: 중복 제거, 네이밍/구조 개선 → `npm test` 실행 → 여전히 통과 확인

모든 Step 완료 후 전체 테스트 실행하여 regression 없음을 확인한다.

## Phase 3: 병렬 코드 리뷰

**3개의 Task를 동시에 실행한다.** 반드시 하나의 메시지에서 3개의 Task 도구를 병렬 호출한다. [금지 사항 및 게이트](#금지-사항-및-게이트-subagent-필수-구간)를 위반하지 않는다.

각 리뷰 Task 프롬프트에 [검증 가능한 흔적](#검증-가능한-흔적-산출물-메타데이터)에 따라 해당 `review_kind`와 YAML 프론트 매터를 **응답 맨 앞**에 출력하도록 지시한다.

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

3개 리뷰가 모두 완료된 후 실행한다. [금지 사항 및 게이트](#금지-사항-및-게이트-subagent-필수-구간)에 따라 메인 에이전트가 종합문을 직접 쓰지 않는다.

- Task `subagent_type`: `generalPurpose`
- `.cursor/agents/review-synthesizer.md`의 시스템 프롬프트를 프롬프트에 포함
- 입력: 3개 리뷰 문서 (`02_review_implementation.md`, `03_review_security.md`, `04_review_architecture.md`) 전문
- 산출물: `Issues/{feature}/05_review_synthesis.md` — [검증 가능한 흔적](#검증-가능한-흔적-산출물-메타데이터)의 `05` YAML 블록으로 시작해야 한다. Task 프롬프트에 동일 형식을 요구한다.

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
