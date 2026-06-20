# Perimenopause & postmenopause mode (roadmap #21)

## Why

Roadmap #21 asked for *discovery* on what a menopause/perimenopause mode should
do. This doc is that discovery, plus the v1 implementation that followed from it.

The app's prediction stack is built on an assumption that breaks down in
perimenopause: **regularity**. `cycleStats` learns a single average cycle length,
the `predict*` functions emit confident windows, and onset-to-onset gaps over 90
days are silently dropped. Perimenopause is *defined* by irregularity — so a mode
for it is mostly about doing less, and being honest about uncertainty, rather than
new prediction math.

The scale of the change in real cycles: a study of ~19M users (Flo, published in
*Nature Scientific Reports* 2024) found cycle-length standard deviation rises from
~3.7 days at ages 36–40 to ~6.5 days at 51–55, and the share of irregular cycles
climbs from ~28% to ~45% across the same span. Predictions that look fine at 35
become misleading at 50.

## What other apps do

The 2025 wave of dedicated perimenopause products converged on the same core
idea — **stop forcing confident predictions** — and expanded symptom tracking to
vasomotor/somatic symptoms.

- **Flo for Perimenopause** (Jul 2025): shows a *window* for the next period
  instead of an exact date; adds a "Perimenopause Score" symptom assessment.
- **Natural Cycles — NC° Perimenopause** (Oct 2025): an algorithm that detects
  ovulation-trend shifts and more frequent anovulation so it works with both
  regular and irregular cycles; classifies users into early/mid/late stages
  (requires a wearable for temperature/heart-rate inputs).
- **Oura** (Nov 2025): labels cycle phases **"unknown"** (attributing them to
  illness, travel, stress, anovulation, etc.) rather than guessing; dropped the
  data needed to start predicting.
- **Clue**: lets users **show/hide cycle predictions** entirely for irregular
  cycles.

Common expanded symptom set across these and dedicated trackers (e.g. mySysters):
hot flashes, night sweats, mood changes, fatigue, sleep disturbance, brain fog,
vaginal dryness, joint pain, heart palpitations, migraines, anxiety, weight
changes.

Caveat on sourcing: these are recent, vendor-announced products; marketing claims
("first scientifically validated…") rest on company-run or preprint studies and
describe *what a product offers*, not independently verified clinical efficacy.

## Clinical backbone: STRAW+10

The Stages of Reproductive Aging Workshop +10 (Harlow et al., 2012) is the
gold-standard staging framework and, usefully, gives **computable thresholds** off
menstrual-cycle characteristics alone (labs/FSH are secondary and assay-dependent):

- **Early menopausal transition (stage −2)** — a *persistent* difference of ≥7
  days in length between consecutive cycles ("persistent" = recurs within 10
  cycles).
- **Late menopausal transition (stage −1)** — amenorrhea of ≥60 days. The
  ReSTAGE Collaboration (Harlow et al., 2006) validated 60 days over the older
  90-day rule.
- **Postmenopause** — 12 months of amenorrhea.

Crucially, these are **suggestive, not diagnostic**: full clinical staging also
weighs age and *excludes* pregnancy and hormonal contraception, and FSH is
"characteristic" rather than a hard cutoff. The app must surface signals, never
diagnoses.

Sources: Harlow et al. 2012 (*Fertility & Sterility*, STRAW+10 executive summary);
NCBI StatPearls (Menopause); Harlow et al. 2006 (ReSTAGE, PubMed 16772350);
Flo/*Nature Sci Rep* 2024 cycle-patterns study.

## Design rationale

The architecture cooperates: prediction is isolated in two pure modules
(`prediction.ts`, `cycles.ts`) consumed identically by three display screens
(CurrentCycle/Calendar/Info), all gated by `markers`. The mode is a single field
on the encrypted `UserSettings` blob — no schema change, and old blobs read as
`standard` via the existing shallow-merge in `decryptSettings`.

Guiding choices:

- **One enum, three values** (`standard | perimenopause | postmenopause`).
  Behaviours nest: peri relaxes/suppresses predictions + adds symptoms; postmeno
  drops cycle forecasts entirely (history + symptoms only).
- **Confidence, not deletion.** `cycleStats` derives a `confidence`
  (`high | low | unknown`). `standard` is always `high`, so its predictions are
  byte-for-byte unchanged. Perimenopause downgrades to `low` (band shown but
  widened, with a floor) or `unknown` (suppressed → UI shows "unknown" instead of
  a fabricated date).
- **Long gaps are signal, not error.** In peri, a gap ≥60 days is treated as a
  skipped cycle: kept *out* of the learned average (so it can't inflate it) but
  surfaced via `skippedCycleCount` / `longestRecentGap`, plus an open-gap
  (last onset → today) check so an in-progress amenorrhea also counts.
- **Suggestive staging only (v1).** `classifyMenopausalStage` implements the
  STRAW+10 thresholds and is used for a single gentle banner suggesting peri mode.
  The full staging UI is deferred — see roadmap #34.

## What shipped (v1)

| Area | Change |
| --- | --- |
| Type model | `trackingMode` on `UserSettings` (default `standard`); `defaultMarkersForMode` — `ui/src/data/types.ts` |
| Prediction | `mode`/`asOf` threaded into `cycleStats`; `confidence`, `skippedCycleCount`, `longestRecentGap`; `predictNextPeriod` "unknown" path + low-confidence band floor; `predictFertileWindow` gated on high confidence; `classifyMenopausalStage` helper — `ui/src/data/prediction.ts` |
| Symptoms | New `vasomotor` category (hot flashes, night sweats, heart palpitations); added levels: Joint pain, Migraine (`pain`), Brain fog (`mental`), Vaginal dryness (`skin`) — `api/src/db/globalCategories.ts` |
| Settings UI | Mode picker + per-mode marker defaults + staging-suggestion banner + caveats — `ui/src/routes/settings/HealthSettings.tsx` |
| Display | "unknown" countdown + floored band (CycleCircle); range-forward stats + unknown/long-gap notes (Info); wider/absent overlays follow the band automatically (Calendar) |

Key thresholds (constants in `prediction.ts`): `SKIPPED_CYCLE_MIN_GAP = 60`,
`POSTMENOPAUSE_AMENORRHEA_DAYS = 365`, `EARLY_TRANSITION_LENGTH_DIFF = 7`,
`LOW_CONFIDENCE_VARIABILITY = 7`, `PERI_MIN_WINDOW_MARGIN = 5`.

Backwards compatibility: zero DB migration; new categories arrive via the
idempotent `seedGlobalCategories`; onsets still derive from Flow factors.

## Follow-ups (roadmap #34)

- Full STRAW+10 staging UI on the Info screen (stage + signals + exclusion
  caveats), building on `classifyMenopausalStage`.
- Richer first-class symptom taxonomy + mode-conditional tracker ordering.
- Anovulation / ovulation-trend detection (needs BBT / cervical-fluid input —
  overlaps roadmap #6).
- Optional suggestive FSH/lab note.

## A note on placement

Vaginal dryness was added as a level under `skin` rather than a new category, to
keep new-category churn to one (`vasomotor`). If a genitourinary cluster grows
(e.g. with bladder symptoms), promoting it to its own category is the natural next
step.
