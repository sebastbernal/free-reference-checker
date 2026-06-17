## Problem
When a reference carries an AI-tool tracking parameter (e.g. `utm_source=chatgpt.com`), the current code appends a warning note but leaves the verdict as `"real"` (green) if the link/page otherwise resolves. The user wants the **main verdict to be `"check"` (yellow/amber)** so the reference is flagged for human review, matching the existing `"check"` verdict style.

## Change
1. In `src/lib/reference-check.functions.ts`, update `processReference` so that when `result.aiTrace` is present, the verdict is forced to `"check"` regardless of what `processReferenceCore` returned.
2. Update the note text to mention that the reference was flagged because of the AI trace.
3. Leave the amber AI-trace badge and detail row in `ReferenceResultCard.tsx` unchanged — they already match the desired color.

## Verification
Paste a reference with a known AI-tracked URL (e.g. `Queensland Trust for Nature. https://qtfn.org.au/?utm_source=chatgpt.com`). The main verdict badge should now read **"Check"** with a yellow/amber background instead of "Real" with a green background. The "AI trace" badge should remain next to it.

## Technical details
- Single function change: `processReference` in `src/lib/reference-check.functions.ts`.
- No new dependencies or UI components needed.