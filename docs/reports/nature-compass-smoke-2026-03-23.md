# Nature Compass Smoke Report (2026-03-23)

## Scope
- Keep main generation chain stable:
  - Google grounding -> fact sheet -> Phase1 roadmap -> Phase2 handbook/downstream
- Verify degradation policy:
  - 1y -> 3y -> 5y (continue strategy, not hard stop)
- Verify mode/weather constraints:
  - school mode
  - family mode (ESL on / off)
  - rainy execution safety
- Verify page-constraint path:
  - Phase1 roadmap done first
  - Phase2 strict page validation + per-phase allocation

## Code Changes In This Pass
- Unified structured topic research into grounding service with freshness metadata:
  - `apps/nature-compass/services/groundingService.ts`
  - `apps/nature-compass/services/structuredHandbookService.ts`
  - `apps/nature-compass/hooks/useStructuredKnowledgeResearch.ts`
  - `apps/nature-compass/types.ts`
  - `apps/nature-compass/components/InputSection.tsx`
- Structured prompt quality/risk/weather constraints:
  - `apps/nature-compass/services/gemini/structuredPrompts.ts`
- UI text fix (reported garbled text):
  - `apps/nature-compass/components/LessonPlanDisplay.tsx`
- Lint blocker fix unrelated to core chain but required for passing static checks:
  - `apps/nature-compass/components/CurriculumResultDisplay.tsx`

## Automated Checks

### 1) Type/Lint
- Command: `npm -w apps/nature-compass run lint`
- Result: PASS

### 2) Build
- Command: `npm -w apps/nature-compass run build`
- Result: PASS

### 3) Chain/Rule Static Smoke Assertions
- Verified PASS (key evidences):
  - fact sheet before Phase1:
    - `hooks/useLessonKitGeneration.ts:149`
  - Phase1 roadmap_only marker:
    - `services/gemini/streaming.ts:27`
  - Phase2 downstream commit:
    - `components/LessonPlanDisplay.tsx:779`
  - commit comment passthrough:
    - `components/LessonPlanDisplay.tsx:711`
  - strict page validation + strict allocation prompt:
    - `services/gemini/supportingContent.ts:69`
    - `services/gemini/supportingContent.ts:281`
  - family/school lenses in roadmap prompts:
    - `services/gemini/streaming.ts:93`
    - `services/gemini/streaming.ts:99`
  - rainy enforcement in Phase1/Phase2/structured:
    - `services/gemini/streaming.ts:127`
    - `services/gemini/supportingContent.ts:275`
    - `services/gemini/structuredPrompts.ts:130`
  - structured path uses unified grounding:
    - `services/structuredHandbookService.ts:21`
  - 1y -> 3y -> 5y sequence:
    - `services/groundingService.ts:15`

## Outcome
- Main architecture and large UI structure remain unchanged.
- Grounding + freshness policy now consistently applies to structured topic research as well.
- Risk metadata and source details are propagated into structured input context for downstream generation quality control.
- Two-stage generation logic remains intact.

## Residual Risks / Limits
- This smoke is static + compile/build level in local environment.
- Full live-model E2E content quality verification (real API outputs across 3 scenario runs) still needs online runtime execution with available model credentials.
