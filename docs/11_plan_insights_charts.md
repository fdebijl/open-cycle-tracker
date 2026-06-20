# Implementation plan: insights & charts (#11)

## Context

The Info screen (`/info`, "My Info") showed only four stat cards plus a fertile-
window line. Roadmap #11 called it "the seed of this but currently just counts"
and asked for real insights: **cycle-length history**, a **cycle-regularity
trend**, and **symptom-vs-cycle-phase correlation**. All the underlying data
already lived client-side; it just wasn't visualised.

Design decisions:

- **Placement:** expand the existing `/info` screen — no new route, no 6th nav
  item. The screen already loads the data the charts need.
- **Charting:** hand-rolled SVG / a plain `<table>`, matching the existing
  `CycleCircle` / `Spinner` convention. **No new dependency** (privacy + minimal-
  deps ethos).
- **Symptom viz:** a heatmap **table** (categories × phases), not grouped bars —
  compact on mobile and accessible as real tabular markup.
- **Scope:** cycle-length history + regularity trend (one combined chart) +
  symptom-vs-phase. A **BBT chart is deferred** — it needs per-day decryption of
  the encrypted factor `value`, unlike everything else here.

## What shipped

### Pure data layer — `ui/src/data/insights.ts` (+ `insights.test.ts`)

Pure, client-side, no DEK required — symptom aggregation runs on raw factor DTOs
(their `categoryLevelId` is plaintext) and only reads already-decrypted day
dates. Reuses constants/`cycleStats` from `prediction.ts` rather than
duplicating them.

- **`cycleLengthHistory(onsets, configuredAverage)`** → `{ points, stats }`. One
  `CycleLengthPoint` per *completed* cycle (the in-progress current cycle has no
  successor onset, so yields no point), oldest → newest, each carrying its
  length, a **causal** rolling average + sample-std-dev variability (last
  `ROLLING_WINDOW` *plausible* lengths up to and including that point), and a ±
  band. Implausible gaps (outside 15–90 days) are still drawn but excluded from
  the trend — the same policy as `observedCycleLengths`. `stats` is the shared
  `cycleStats` so the learned/configured headline matches the rest of the app.
- **`classifyPhase({ date, onset, nextOnset?, averageLength?, isPeriodDay })`** →
  `menstrual | follicular | ovulatory | luteal | null`. Luteal-phase (calendar)
  method, aligned with `predictFertileWindow`: a period day is `menstrual`;
  otherwise ovulation = nextOnset − `LUTEAL_PHASE_DAYS`, with the fertile window
  around it `ovulatory`, before it `follicular`, after it `luteal`. Falls back to
  `onset + averageLength` when the next onset is unknown, and to a cycle-midpoint
  split when the cycle is too short for the luteal model.
- **`symptomPhaseMatrix({...})`** → `{ categories, phaseDayTotals,
  unclassifiedDays }`. Buckets each logged factor onto the phase of its day
  (per-category counts with a per-level drilldown, desc by total). Flow (defines
  the menstrual phase) and BBT (numeric/encrypted) are excluded by slug; custom
  categories flow through. A level logged twice on one day counts once.
  `phaseDayTotals` is the per-phase day count — the heatmap's denominator.

### Hook — `ui/src/data/hooks.ts`

`useInsights()` reuses the queries the Info screen already runs (React Query
dedupes — no extra fetches), memoizes `cycleOnsets(...)`, and returns
`{ history, matrix, isLoading }`.

### UI — `ui/src/components/insights/`

- **`InsightsSection`** — owns the hook, joins category ids → decrypted
  name/color, and gates each chart's empty / insufficient-data state.
- **`CycleLengthChart`** — SVG bars + rolling-average polyline + filled
  variability-band polygon (shown once the average is *learned*, i.e. ≥3
  cycles). Scales via `viewBox` + `width:100%` (mobile-first).
- **`SymptomPhaseChart`** — `<table>` heatmap; each cell's color is the
  category color at an opacity scaled by logging *frequency* in that phase, with
  `<th scope>` + per-cell `aria-label`.
- **`ChartEmpty`** — shared "keep tracking" placeholder.

Strings live under a new `insights` section in
`ui/src/i18n/locales/en/translation.json` (plurals via the i18next `_one/_other`
convention; dates via `useDateFnsLocale()`).

## Known limitations / future work

- **No BBT chart** — would need decrypting each day's factor `value`.
- The phase classifier is the calendar method only (same caveat as the fertility
  forecast, roadmap #6) — BBT / cervical-mucus inputs aren't used.
- The heatmap aggregates over *all* history; there's no per-cycle or date-range
  filter yet.

## Verification

- `cd ui && pnpm test` — `insights.test.ts` (24 cases) green alongside the suite.
- `cd ui && pnpm lint && pnpm lint:css && pnpm build` — clean.
- Manual: open `/info` with <3 cycles (placeholders) and with ≥3 logged cycles
  (full length chart + band + caption; symptom heatmap shaded by phase).
