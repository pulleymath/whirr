---
issue_driven_dev:
  source: subagent
  phase: review
  subagent_type: code-reviewer
  feature: "feature-17-ui-recorder-session"
  review_kind: architecture
---

# Architecture & Code Style Review

`01_plan.md`와 `docs/ARCHITECTURE.md`를 기준으로 `main` 대비 변경분을 검토했다. 변경은 **브라우저 UI·클라이언트 저장소 흐름**에 국한되며, STT/회의록 API 경계나 `PostRecordingPipelineProvider` 같은 서버·파이프라인 개념은 건드리지 않아 **ARCHITECTURE.md의 신뢰·실행 경계**와 잘 맞는다. 홈에서 탭을 없애도 `usePostRecordingPipeline`을 유지해 백그라운드 회의록 생성·`isBusy` 잠금이 이어지는 점은 문서상 “녹음 후 파이프라인” 설명과 일치한다.

잘된 점으로는, 세션 상세에서 Object URL·`<audio>`·`router.back` 의존을 제거해 **메모리 누수 가능성과 내비게이션 결합**을 줄였고, `lucide-react`는 아이콘 렌더링에만 쓰여 **데이터 경로**를 오염시키지 않는다.

## Architecture Findings

### Important (should fix)

1. **계획 대비 테스트 범위 축소**  
   `01_plan.md` Step 4는 `recorder-ui.test.tsx`에 `pipeline.isBusy`일 때 “이전 녹음을 처리 중” 문구 검증을 명시한다. 현재 diff의 `recorder-ui.test.tsx`는 탭 부재·`TranscriptView` 존재까지만 다루고 **파이프라인 잠금 UX**를 검증하지 않는다. 회귀 시 홈만 바뀌고 파이프라인 메시지가 깨져도 테스트가 잡지 못한다.

2. **계획 Step 6·8의 세션 상세 테스트와 구현 불일치**  
   계획은 스크립트/회의록/다시 생성/다운로드에 대해 **lucide SVG 존재**와 일부 **cursor-pointer 클래스** 단언을 요구한다. `session-detail.test.tsx`는 여전히 `aria-label`·행위 중심 assertion 위주이며, 위 단언들이 diff에 없다. 기능은 `IconButton`/`Button` 베이스 클래스로 충족될 수 있으나 **TDD 계획과 리뷰 가능한 스펙 문서**로는 갭이 있다.

### Suggestions (nice to have)

3. **`RecordButton`의 애니메이션 범위**  
   계획은 인디케이터의 `border-radius` 모핑(200ms)을 강조한다. 구현은 `width`·`height`·`border-radius`를 함께 트랜지션하고 지속 시간도 300ms이다. 제품적으로는 자연스러울 수 있으나, **스펙 대비 의도적 확장**이면 계획서나 이슈 본문에 한 줄 반영하는 편이 이후 리뷰에 유리하다.

4. **`IconButton`의 “size variant”**  
   계획 문구에는 size variant가 있으나 구현 Props에는 없다. 필요 없다면 계획/이슈 정리, 필요하다면 `sm`/`md` 등을 추가하는 식으로 **문서와 API를 맞출** 것.

5. **`Button` + `IconButton`의 variant 맵 중복**  
   `VARIANT_CLASSES`가 두 파일에 유사하게 존재한다. 장기적으로는 `ui/variants.ts` 한곳으로 모으면 **테마·다크 모드 토큰 변경** 시 한 번에 반영할 수 있다.

### Plan alignment (non-blocking)

- **`src/components/ui/button.tsx` 추가**는 계획 표의 파일 목록에는 없었으나, 이슈/STATUS의 “공유 Button” 방향과 맞고 `Recorder`·`SessionDetail`의 인라인 버튼을 줄이는 데 기여한다. **편차이지만 아키텍처상 타당**하다.

## Code Style Findings

### Important (should fix)

1. **접근성 Props 네이밍 불일치**  
   `IconButton`은 `ariaLabel`(camelCase), `Button`은 `"aria-label"`(quoted DOM 속성 스타일)을 쓴다. 동일 `ui/` 계층에서 **한 가지 관례**(예: 둘 다 `ariaLabel` + 구현에서 `aria-label`로 전달)로 맞추면 호출부 가독성이 좋아진다.

### Suggestions (nice to have)

2. **`RecordButton` 배치**  
   `IconButton`/`Button`은 `src/components/ui/`에 두고, `RecordButton`은 `src/components/` 루트에 있다. 도메인 전용 컴포넌트로는 타당하나, “녹음 UI만 모은다”면 `components/recorder/` 같은 **기능 폴더**로 묶는 선택지가 있다(필수 아님).

3. **`session-detail.tsx`와 lucide 결합**  
   한 파일 상단에서 `Check`, `Copy`, `Loader2` 등 다수 아이콘을 import한다. 규모가 더 커지면 **액션별 작은 서브컴포넌트**로 나누거나, 아이콘+라벨 매핑을 상수화해 가독성을 높일 수 있다.

4. **Tailwind 문자열 조합**  
   `` `... ${transition}`.trim()`` 패턴은 프로젝트 전반에서 흔하다. `clsx`/`tailwind-merge` 도입 여부는 팀 규칙에 따르면 되고, 현재 수준에서는 **일관성만 유지**하면 된다.

5. **`MainTranscriptTabs`의 `className` 단언**  
   테스트가 `element.className`에 정규식 매칭을 쓴다. Tailwind가 런타임에서 클래스 순서를 바꿔도 통과하지만, **구현 디테일에 과하게 묶이는** 경향이 있으므로 가능하면 `toHaveClass("cursor-pointer")`(지원 시) 등으로 완화할 수 있다.

### Critical (must fix)

- **해당 없음** — 보안 경계(비밀·서버 키)나 데이터 모델을 잘못 바꾼 흔적은 없다.

## Verdict

**조건부 승인(merge 가능하나 보완 권장).**  
아키텍처 경계와 `ARCHITECTURE.md`는 대체로 잘 지켰고, UI 프리미티브(`ui/icon-button`, `ui/button`) 도입 방향도 일관적이다. 다만 **계획서에 적힌 테스트 항목(특히 Recorder 파이프라인 busy 문구, 세션 상세의 아이콘/cursor 단언)**이 diff에 반영되지 않아, “계획 대비 완료” 관점에서는 한 단계 덜 끝난 상태로 본다. 위 Important 항목을 테스트 또는 계획 문서 중 한쪽으로 정리하면 **승인(approved)**으로 올릴 수 있다.
