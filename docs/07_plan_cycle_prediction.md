# Cycle Prediction — Evidence and Implementation

How Open Cycle Tracker forecasts the next period, ovulation/fertile window, and PMS —
what the algorithm does, why, and the evidence behind it. Companion to
[`06_symptom-tracking.md`](./06_symptom-tracking.md) (which covers *what* to track);
this covers *how we predict from it*.

## 1. Starting point

The shipped engine ([`ui/src/data/prediction.ts`](../ui/src/data/prediction.ts)) was the
pure **calendar/rhythm method**: a rolling mean of the last 6 onset-to-onset gaps (filtered
to a hard 15–90 day range) ± sample std-dev; ovulation pinned at `nextOnset − 14` (fixed
luteal); fertile window = ovulation −5/+1; PMS = onset −5/−1. Everything is pure,
client-side, and **non-persisted** (computed for display, never written to `Day` records),
so algorithm changes need no migration.

Two weaknesses, both confirmed by the literature:

- **A fixed ovulation point estimate is inherently imprecise.** For a 28-day cycle the most
  likely ovulation day is day 16 (21%), with day 14 only 4th (14%) and the true day spanning
  days 11–20; calendar apps predict the single ovulation day with ≤21% accuracy
  (Johnson, Marriott & Zinaman 2018; Wilcox et al. 2000).
- **A hard 90-day cutoff is a blunt way to handle irregular cycles.** It silently drops a
  long gap rather than recognising it as a skipped *log* relative to the user's own rhythm.

## 2. Phase A — CLD / skip-aware statistical layer (shipped)

Robust, per-user variability handling, no new user data. All in `prediction.ts`.

- **Cycle-Length-Difference (CLD)** = |difference between consecutive cycle lengths|. The
  per-user **median CLD** is the robust variability metric (Li, Urteaga & Elhadad,
  *npj Digital Medicine* 2020). `medianCld > 9 days` ⇒ "consistently highly variable."
  Exposed on `CycleStats` as `medianCld` / `isHighlyVariable`.
- **Skip detection** (`flagSkippedCycles`): a length whose CLD exceeds the user's *own* median
  CLD by >=10 days is flagged as a likely skipped/unlogged period (≈89% of such gaps contain no
  bleeding) — a personalised replacement for the fixed cap. The 15–90 day bound stays only as a
  coarse outer sanity guard. Surfaced as `skippedCount`.
- **Personalised band** (`predictNextPeriod`): the ± window widens to the median CLD for highly
  variable users (widen-only `max(stdDev, medianCld)`, capped at half the average length), so we
  never show a tight point estimate to someone whose cycles don't warrant it.
- **Regularity insight**: the Info screen shows an "irregular cycles — rough estimates" note
  when `isHighlyVariable` (seeds roadmap #11).

## 3. Phase B — Symptothermal current-cycle confirmation (shipped)

Uses the BBT (numeric) + cervical-fluid data OCT already collects. New pure module
[`ui/src/data/symptothermal.ts`](../ui/src/data/symptothermal.ts); decrypted inputs assembled
by `useCurrentCycleSymptoDays` ([`hooks.ts`](../ui/src/data/hooks.ts)), which decrypts only the
current cycle's BBT readings (DEK-gated, cache-keyed on ciphertext) and maps fluid level > mucus
enum.

The reimplemented Sensiplan rules:

- **Temperature 3-over-6** (`evaluateTempShift`): coverline = max of the 6 readings before a
  candidate First Higher Measurement; the *regular rule* confirms when 3 consecutive readings
  exceed it and the 3rd is >=0.2 °C above; two documented exceptions tolerate a single dip
  (4th reading required). Ovulation ≈ FHM − 1 day. (BBT is logged in °C, so the 0.2 °C margin
  applies directly.)
- **Cervical-mucus peak +3** (`evaluateMucusPeak`): the last most-fertile day (egg-white >
  creamy > sticky; atypical ignored) followed by 3 drier days.
- **Double-check** (`symptothermal`): ovulation is confirmed only when **both** signals fire;
  the window's end is pulled in to the later of the two confirmation days.

`refineFertileWindow` (in `prediction.ts`) merges this into the forward `FertilePrediction`:
when confirmed, the confirmed ovulation supersedes the estimate and the fertile overlay narrows.
A new `ForecastType` `'ovulation-confirmed'` renders solid (vs the dashed forecast markers) on
the cycle circle and calendar.

**Safety framing (decided): informational only.** OCT is not a certified fertility-awareness
method. It never shows an "infertile/safe" status (`SymptothermalResult.infertileFrom` is used
only to bound the displayed window, never surfaced as a label), and the Info screen carries a
persistent "not birth control — don't rely on this to avoid pregnancy" disclaimer wherever a
confirmation appears.

Effectiveness context (not a direct OCT metric): Sensiplan's published contraceptive failure is
~0.4 (perfect use) / ~1.8 (typical use) per 100 women-years (Frank-Herrmann et al. 2007).

## 4. PMS — deliberately unchanged

`predictPmsWindow` is evidence-unvalidated and already self-gates conservatively
(`source==='learned'`, `variability ≤ 4`, fits the luteal phase) and defaults off. No source in
the research evaluated PMS-window accuracy, so it was left as-is.

## 5. File map

| File | Change |
|---|---|
| `ui/src/data/prediction.ts` | CLD helpers, `CycleStats` variability fields, capped band, `refineFertileWindow`, `'ovulation-confirmed'` |
| `ui/src/data/symptothermal.ts` | **New** pure Sensiplan engine |
| `ui/src/data/hooks.ts` | **New** `useCurrentCycleSymptoDays` (decrypts current-cycle BBT, maps mucus) |
| `ui/src/data/cycles.ts`, `mappers.ts` | `FLUID_SLUG`; `decryptFactorValues` helper |
| `routes/Calendar.tsx`, `routes/Info.tsx`, `routes/cycle/CurrentCycle.tsx`, `components/cycle/CycleCircle.tsx` (+ SCSS) | Wire symptothermal refinement, confirmed-ovulation styling, regularity insight, disclaimer |
| `i18n/locales/en/translation.json` | `info.highlyVariable`, `info.ovulationConfirmed`, `info.notContraceptive` |
| tests | `prediction.test.ts` extended; new `symptothermal.test.ts` |

## 6. Phase C — future (roadmap #34)

- **Generative skip-aware Bayesian model** (Li/Urteaga/Elhadad, *JAMIA* 2022): models skipped
  logs as latent variables (observed length = sum of true Poisson cycle lengths over a
  truncated-Geometric skip count) and yields a posterior predictive band; roughly halves
  long-cycle RMSE vs the mean baseline while matching it for regular users. CLD (Phase A) is the
  lightweight proxy that captures most of this benefit client-side.
- **External LH / urinary-hormone-monitor ingestion** (Marquette-style) to anchor ovulation
  directly — higher logging burden, validated only in small samples.
- **Reinterpreting a flagged skipped-log gap as multiple cycles** (Phase A only flags it).

## 7. Sources

- Li, Urteaga, Wiggins, Druet, Shea, Vitzthum & Elhadad (2020), *npj Digital Medicine* 3:79 —
  CLD, the >9-day variability threshold, the >=10-day skip flag.
- Urteaga, Li, Elhadad et al. (2021 MLHC / 2022 *JAMIA*; arXiv:2102.12439) — generative
  skip-aware cycle-length model.
- Johnson, Marriott & Zinaman (2018), *Current Medical Research and Opinion* — ovulation-day
  distribution and calendar-app accuracy.
- Frank-Herrmann et al. (2007), *Human Reproduction* — Sensiplan symptothermal effectiveness.
