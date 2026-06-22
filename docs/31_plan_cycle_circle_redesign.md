# Implementation plan: cycle circle redesign — toggleable markers + PMS (#31)

## Context

Two things are folded together here:

1. **The cycle circle needs a polish pass** — roadmap #25 already notes the dots
   are small, animations are wonky, and it could use a legend. This is the
   redesign umbrella.
2. **A PMS marker.** The original (legacy Ember) design highlit PMS on the last
   five days of the predicted cycle. That heuristic is crude — PMS is a
   **luteal-phase** phenomenon tied to ovulation (~the days leading up to the
   next onset), not a fixed offset from an arbitrary cycle "end". We want it
   back, but (a) **opt-in**, (b) anchored to the predicted next onset rather than
   a flat offset, and (c) shown **only when we can predict it with some
   reliability**.

The unifying design decision: **all four cycle-phase markers — menstruation,
fertile, ovulation, PMS — become individually toggleable.** Menstruation,
fertile, and ovulation default **on**; PMS defaults **off** (it's the least
universally wanted and the most easily misread as authoritative). Even when PMS
is opted in, it stays hidden until the prediction is trustworthy.

## Where things stand today

- **Prediction** (`ui/src/data/prediction.ts`, pure + unit-tested): `cycleStats`
  learns an average + variability from observed onsets once >=3 cycles exist
  (`source: 'learned'`), else falls back to the configured average
  (`source: 'configured'`). `predictFertileWindow` counts a fixed
  `LUTEAL_PHASE_DAYS` (14) back from the predicted next onset, and is already
  gated on `averageLength > LUTEAL_PHASE_DAYS`. `forecastDayType(date, fertile)`
  returns `'fertile' | 'ovulation' | null` for overlaying on empty future slots.
- **Rendering** (`ui/src/components/cycle/`): `CycleCircle` lays out slots; each
  empty future slot gets a `forecast` from `forecastDayType`. `DayMarker` keys
  styling off `data-daytype` (`none` | `period`) and `data-forecast`
  (`fertile` | `ovulation`) — see `DayMarker.module.scss`. There is **no PMS
  marker today** in either the prediction or the render layer.
- **Preferences** (`ui/src/data/types.ts` `UserSettings`, stored E2EE in
  `users.encSettings`): patched via `useUpdateSettings` (read-merge-write the
  whole blob) and read via `useUserSettings`. This is where marker toggles live —
  E2EE like everything else, no server involvement.

## Design

### 1. PMS prediction (pure, in `prediction.ts`)

Add a luteal-anchored PMS window alongside the fertile-window forecast. PMS sits
in the **last `PMS_DAYS` before the predicted next onset** — i.e. the tail of the
luteal phase, which is exactly where the symptom cluster falls, and which scales
correctly across cycle lengths (unlike "last 5 days of a 28- vs 35-day circle").

New constants:

```ts
/** PMS window: this many days before the predicted next onset (tail of the
 * luteal phase). The symptom cluster is luteal, so we count back from onset, not
 * from an arbitrary cycle end. */
export const PMS_DAYS = 5;
/** Max cycle-length variability (std-dev, days) at which we still trust a PMS
 * forecast. A band wider than the window itself makes the highlight meaningless,
 * so above this we suppress it even when opted in. */
export const PMS_MAX_VARIABILITY = 4;
```

New interface + function:

```ts
export interface PmsPrediction {
  /** Inclusive PMS-window bounds, or null when it can't be predicted reliably. */
  pmsStart: Date | null;
  pmsEnd: Date | null;
}

/** Forecast the PMS window: the PMS_DAYS leading up to the predicted next onset.
 * Returns nulls unless the average is *learned* (>= MIN_CYCLES_TO_LEARN observed
 * cycles) and variability is tight enough to be meaningful — PMS is opt-in and
 * we refuse to show a guess dressed up as a prediction. */
export function predictPmsWindow(lastOnset: Date | null, stats: CycleStats): PmsPrediction
```

Reliability gate, all required:
- `lastOnset` present and `stats.source === 'learned'` (so >=3 real cycles — we
  never PMS-highlight off the onboarding default), and
- `stats.variability <= PMS_MAX_VARIABILITY`, and
- `stats.averageLength > LUTEAL_PHASE_DAYS + PMS_DAYS` (window must fit in the
  luteal phase without colliding with the fertile window).

When the gate fails, return `{ pmsStart: null, pmsEnd: null }` — the circle
simply shows no PMS, no error, no explanation needed inline (the settings copy
explains the "only when reliable" behaviour).

Extend `forecastDayType` (or add a sibling) to return `'pms'` for dates inside
the PMS window. Precedence: `ovulation` > `fertile` > `pms` — they shouldn't
overlap given the gate above, but fix an order so it's deterministic. Mirror the
existing tests in `prediction.test.ts`: gate on/off, boundary dates, and that an
unreliable (`configured` / high-variability) history yields nulls.

### 2. Marker visibility settings (E2EE)

Extend `UserSettings` with a `markers` object:

```ts
export interface UserSettings {
  averageCycleLength: number;
  autoLockMs: number;
  lockOnHidden: boolean;
  /** Which cycle-phase markers to show on the circle/calendar. */
  markers: {
    menstruation: boolean; // default true
    fertile: boolean;      // default true
    ovulation: boolean;    // default true
    pms: boolean;          // default false
  };
}
```

Add the defaults to `DEFAULT_USER_SETTINGS`. Because `decryptSettings` already
merges over `DEFAULT_USER_SETTINGS` for older blobs, existing users get the
defaults (markers all-on-but-PMS) without a migration — confirm the merge is a
deep-enough spread for the nested `markers` object (it currently spreads
shallowly; add a small normalize step in `decryptSettings` so a blob missing
`markers`, or missing a key within it, fills from defaults).

### 3. Settings UI

Add a **"Cycle markers"** card. Home it in `PersonalizationSettings.tsx` (display
preferences) — it's a presentation choice, not health data. Four toggles, read
from `useUserSettings`, written via `useUpdateSettings({ markers: ... })`.

- The PMS toggle gets a one-line helper: *"Only shown once your cycle is regular
  enough to predict it."* (new i18n string) so the opt-in-but-still-hidden
  behaviour isn't mistaken for a bug.
- All strings via i18n (`ui/src/i18n/locales/en/translation.json`).

### 4. Circle render changes

- `CurrentCycle.tsx` (the circle's caller) reads `settings.markers` and passes
  the prediction overlays it computes (`fertile`, and a new `pms` from
  `predictPmsWindow`) **only for enabled markers** — gate at the data source so a
  disabled marker is never even computed into a slot.
- `CycleCircle` accepts the PMS overlay and an enabled-markers set; `DayMarker`
  gains `data-forecast='pms'` styling: same dashed-forecast treatment as
  fertile/ovulation but a distinct, **softer** tint (lower opacity / muted hue) —
  it's a prediction-on-a-prediction and should read as the most tentative marker.
- The **menstruation** toggle controls the period coloring + predicted-period
  overlay on the circle. Note: it hides the *highlight*, not the logged data —
  the underlying `Day`/Flow records are untouched and still tappable. Call this
  out in the helper copy so users don't think toggling it deletes anything.
- **Legend** (addresses #25): render a small legend below the circle mapping each
  *enabled* marker to its color/style. This is also where the "fix the circle"
  polish lands — bump dot size, calm the proximity-scaler animation.

### 5. Calendar

The month calendar colors cells by predicted type too. Apply the same
`settings.markers` gating there for consistency (and feed it the PMS window),
so a marker the user turned off doesn't reappear on the calendar.

## Touch points

- `ui/src/data/prediction.ts` (+ `prediction.test.ts`) — `predictPmsWindow`,
  constants, `forecastDayType` extension.
- `ui/src/data/types.ts` — `UserSettings.markers` + defaults.
- `ui/src/data/mappers.ts` — `decryptSettings` deep-merge/normalize for `markers`.
- `ui/src/routes/settings/PersonalizationSettings.tsx` — the toggles card.
- `ui/src/components/cycle/CycleCircle.tsx`, `DayMarker.tsx`,
  `DayMarker.module.scss` — PMS marker, enabled-markers gating, legend, polish.
- `ui/src/routes/cycle/CurrentCycle.tsx` — compute/pass overlays per settings.
- The month calendar route — same gating.
- `ui/src/i18n/locales/en/translation.json` — marker names, PMS helper, legend.

## Out of scope / future

- PMS prediction stays **calendar-method** here — it does not yet use logged PMS
  *symptoms* (Mood>PMS level, from the symptom-tracking milestone). Once enough
  symptom history exists, an observed-PMS model would beat the predicted band;
  that's a natural follow-up, not part of this pass.
- Predicting markers across the **next 3 cycles** is roadmap #17 — this redesign
  should leave the per-marker gating in a shape #17 can reuse, but not implement
  the multi-cycle forecast.
