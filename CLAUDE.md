@AGENTS.md
# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

<!--
한글 번역

@AGENTS.md

# CLAUDE.md

LLM이 코딩할 때 흔히 발생하는 실수를 줄이기 위한 행동 지침입니다. 필요에 따라 프로젝트별 지침과 함께 적용합니다.

**트레이드오프:** 이 지침은 속도보다 신중함을 우선하도록 유도합니다. 단순한 작업에서는 상황에 맞게 판단합니다.

## 1. 코딩하기 전에 생각하기

**추측하지 않습니다. 혼란스러운 부분을 숨기지 않습니다. 선택에 따른 장단점을 드러냅니다.**

구현하기 전에 다음 사항을 따릅니다.

- 가정한 내용을 명확하게 설명합니다. 확실하지 않으면 질문합니다.
- 여러 가지 해석이 가능하다면 조용히 하나를 선택하지 말고 각각을 제시합니다.
- 더 간단한 접근 방식이 있다면 알립니다. 필요한 경우 요청에 이의를 제기합니다.
- 명확하지 않은 부분이 있으면 멈춥니다. 무엇이 혼란스러운지 밝히고 질문합니다.

## 2. 단순함을 우선하기

**문제를 해결하는 데 필요한 최소한의 코드만 작성합니다. 추측에 기반한 코드는 추가하지 않습니다.**

- 요청받은 범위를 넘어서는 기능을 추가하지 않습니다.
- 한 번만 사용하는 코드를 위해 추상화하지 않습니다.
- 요청받지 않은 유연성이나 설정 기능을 추가하지 않습니다.
- 발생할 수 없는 상황을 위한 오류 처리를 추가하지 않습니다.
- 50줄로 작성할 수 있는 코드를 200줄로 작성했다면 다시 작성합니다.

스스로 다음과 같이 질문합니다. "숙련된 개발자가 이 코드가 지나치게 복잡하다고 말할 것인가?" 그렇다면 단순화합니다.

## 3. 필요한 부분만 정확하게 변경하기

**반드시 필요한 부분만 수정합니다. 자신이 만든 문제만 정리합니다.**

기존 코드를 수정할 때 다음 사항을 따릅니다.

- 주변 코드, 주석 또는 서식을 임의로 개선하지 않습니다.
- 문제가 없는 코드를 리팩터링하지 않습니다.
- 다른 방식을 선호하더라도 기존 코드 스타일을 따릅니다.
- 작업과 관련 없는 사용되지 않는 코드를 발견하면 삭제하지 말고 알립니다.

자신의 변경으로 사용되지 않는 코드가 생겼을 때 다음 사항을 따릅니다.

- 자신의 변경으로 인해 사용되지 않게 된 import, 변수와 함수는 제거합니다.
- 별도 요청이 없다면 기존부터 사용되지 않던 코드는 제거하지 않습니다.

판단 기준은 다음과 같습니다. 변경한 모든 줄은 사용자의 요청과 직접 연결되어야 합니다.

## 4. 목표 중심으로 실행하기

**성공 기준을 정의하고 검증될 때까지 반복합니다.**

작업을 검증 가능한 목표로 변환합니다.

- "검증 추가" → "잘못된 입력에 대한 테스트를 작성한 다음 테스트를 통과시킵니다."
- "버그 수정" → "버그를 재현하는 테스트를 작성한 다음 테스트를 통과시킵니다."
- "X 리팩터링" → "리팩터링 전과 후에 테스트가 통과하는지 확인합니다."

여러 단계로 구성된 작업에는 다음과 같이 간단한 계획을 제시합니다.

```text
1. [단계] → 검증: [확인 방법]
2. [단계] → 검증: [확인 방법]
3. [단계] → 검증: [확인 방법]
```

명확한 성공 기준이 있으면 독립적으로 검증을 반복할 수 있습니다. "동작하게 만들기"와 같이 불명확한 기준은 계속해서 추가 확인이 필요합니다.

**이 지침이 제대로 작동하고 있다는 기준:** Diff에서 불필요한 변경이 줄어들고, 지나친 복잡성으로 인한 재작성이 줄어들며, 구현 후 실수를 발견하는 대신 구현 전에 필요한 확인 질문을 하게 됩니다.
-->
