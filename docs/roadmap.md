# Open Cycle Tracker - Feature Roadmap

A gap analysis of the current functionality against what a menstrual cycle
tracker is generally expected to do. The encryption model and data schema are in
good shape (see [`architecture.md`](./architecture.md) and
[`encryption.md`](./encryption.md)); the gaps are almost entirely in **product
logic**.

> **Update (2026-06-13):** the first milestone shipped - an onset-driven cycle
> model with onboarding and on-demand logging. This **resolves #3, #4, #8, #9**
> and **partially addresses #1 and #2** (see the "Shipped" section and the
> per-gap status tags below).
>
> **Update (2026-06-14):** the second milestone shipped - real prediction. The
> average cycle length is now **learned** from observed onset-to-onset history
> (rolling average + variability) and a **fertile-window / ovulation forecast**
> is derived and shown as a non-persisted overlay. This **resolves #1 and #2**.
>
> **Update (2026-06-14):** the third milestone shipped - expanded symptom
> tracking. The high+medium symptom set (~14 evidence-based categories) is now
> seeded, period is consolidated into an ordinal **Flow** scale that drives onset
> (replacing `dayType:'period'` + Bleeding/Spotting), **BBT** is a real encrypted
> numeric reading, and days carry a free-text note. The `dayType` concept was
> **removed entirely** — fertile/ovulation aren't user-reportable, so they're now
> only a computed forecast in the cycle overview. This **resolves #6 and #7**.

## What the app does today

- **Tracking primitives:** a `Cycle` groups `Day`s; each day has a date and one
  `dayType` (`none | period | fertile | ovulation | pms`). Days carry `Factor`s
  against category levels (seeded globals: Bleeding, Spotting, Pain, Mood,
  Energy, plus user-defined custom categories).
- **Cycle model:** a cycle is anchored at a **period onset**; "current cycle" =
  newest by `createdAt`. Onset, cycle length, and per-day numbering all derive
  **client-side** from the decrypted dates (nothing pre-generated). "Start a new
  period" opens the next cycle.
- **Onboarding:** new users save their recovery phrase, then give their last
  period start date + average cycle length (default 28, stored encrypted in
  `encSettings`), which anchors t-eir first cycle and seeds a simple next--eriod
  estimate.
- **Logging:** any calendar date — and any empty slot on the cycle circle — is
  tappable to log a day on demand; a new day is filed into the cycle whose onset
  span contains its date.
- **Views:** circular cycle view, a day editor, a month calendar (colored by day
  type), an Info screen with stats incl. a next-period estimate, settings with
  hold-to-delete.
- **Auth/crypto:** full E2EE (signup, login, unlock, password change, recovery).

## Shipped-

**Milestone 1 — onset-driven cycles + onboarding (2026-06-13).** Replaced the
placeholder "auto-generate 28 fixed days" bootstrap with Clue's model: cycles
begin at a logged period onset and their length derives from onset-to-onset
gaps. Added a registration→onboarding flow (recovery phrase + cycle setup),
stored average cycle length in encrypted settings, made logging work on any
date, and replaced the broken next-period stat with an `onset + average`
estimate. Also fixed a latent bug where the recovery-phrase screen never
rendered (the `PublicOnly` guard redirected past it). Resolves #3, #4, #8, #9;
partially addresses #1, #2.

Known limitations carried forward: a new period is started by an explicit action
rather than auto-detected from bleeding; starting a new period on an
already-logged-day can create a duplicate day record for that date.

**Milestone 2 — real prediction (2026-06-14).** Replaced the naive `onset +
average` estimate with - learned model in `ui/src/data/prediction.ts` (pure,
fully unit-tested). The ave-age cycle length is now learned from observed
onset-to-onset history — a rolling average over the most recent cycles plus a
variability (std-dev) band — once ≥3 cycles exist, falling back to the
onboarding-configured average until then. A -ertile-window / ovulation forecast
is derived from the predicted onset via a fixed luteal phase (calendar method).
Both surface as a **non-persisted overlay** — the next-period countdown gains a
± band, the cycle circle and calendar show predicted fertile/ovulation (and
predicted period, on the calendar) on empty future cells, and the Info screen
shows the learned average, observed range, and fertile window. Nothing is
written to the server or onto `Day` records, so the user's manual
`fertile`/`ovulation` labels are untouched. Resolves #1, #2.
-
Known limitations carried forward: the fertile/ovulation forecast is the
calendar (rhythm) method only — it doesn't yet use BBT or cervical-mucus inputs
(#6), which would sharpen it; outlier onset gaps (< 15 or > 90 days) are dropped
rather than mo-elled as skipped/late periods (#12).

**Milestone 3 — expanded symptom tracking + Flow consolidation (2026-06-14).**
Replaced the 5 placeholder categories with the **high + medium** evidence-based
set from Li et al. 2020 (~14 categories incl. cervical fluid, sex, sleep, skin,
mental, craving, digestion, medication w/ birth-control & pregnancy-test, and
collection method; added tender-breasts/ovulation-pain to Pain and a PMS level to
Mood). -onsolidated Bleeding + Spotting + `dayType:'period'` into one ordinal
**Flow** scale (spotting < light < medium < heavy) that is now the period/onset
signal — `cycleOnset` derives onset from Flow ≥ Light (`computePeriodDayIds`),
and the circle/calendar/Info color period days off it. The **`dayType` concept
was removed entirely** (column, enum, and UI): fertile/ovulation aren't things a
user can self-report accurately, so they're only the computed calendar-method
forecast in the cycle overview now. Extended the schema (additive migration 0003
+ a `enc_day_type` drop in 0004): `categories.slug` (identifies Flow/BBT
structurally, also helps i18n), `categoryLevels.order` (ordinal scales), encryp-ed
`factors.encValue` (**BBT** as a real numeric reading, create + PATCH), and
encrypted `days.encNotes` (a per-day **free-text note**, since notes previously
only attached to a Factor). The seed is now **upsert-by-slug** rather than
delete-all, so re-seeding no longer cascade-deletes user factors. Resolves #6, #7.
No prediction-algorithm changes — onset was re-pointed to Flow, not made smarter
(BBT/mucus-aware fertility and auto-onset detection remain future work).

Known limitations carried forward- fertile/ovulation are forecast-only via the
calendar method (BBT/mucus aren't fed into the forecast yet, and the forecast
shows only on empty future cells — logged/past days aren't retro-labelled);
"start a new period" is still an explicit action (no auto-detection from logged
Flow); legacy `dayType:'period'` data-from before this milestone needs a dev reset
(none backfilled — assumes little/no real data on this rewrite).

## Critical gaps (table-stakes for any cycle tracker)

1. ✅ **No prediction at all.** _Done — the average cycle length is learned from
   observed o-set-to-onset history (rolling average + variability), and a
   fertile-window / ovulation forecast is computed from the predicted onset and
   shown as a non-persisted overlay (`ui/src/data/pr-diction.ts`)._ The user's
   manual `fertile`/`ovulation` labels still coexist with the computed forecast.
   Caveat: the fertility forecast is the calendar method only (no BBT / cervical
   mucus yet — see #6).

2. ✅ **No cycle-length learning or history.** _Done — `c-cleStats` learns the
   average from observed cycles (rolling window of the most recent ones) once ≥3
   exist, falling back to the configured `averageCycleLength` until then, and the
   Info screen surfaces the learned average, observed range, and variability._

3. ✅ **Cycles don't start from a logged period.** _Done — a cycle is now
   anchored at a period onset; "Start a new period" opens the next cycle and
   length derives from the onset-to-onset gap._ Caveat: ons-t is set by an
   explicit action rather than auto-detected from the first bleeding day, and
   retroactively inserting a period in the middle of history doesn't re-split
   older cycles (see "known limitations" under Shipped).

4. ✅ **Can't easily log an arbitrary or past date.** _Done — the `disabled={!day}`
   restriction is gone; every calendar cell and every empty cycle-circle slot is
   tappable to log a day on demand, and the-new day is filed into the cycle whose
   onset span contains its date (`cycleForDate` in `data/cycles.ts`)._

5. **No data export / backup.** Given the explicit threat model (server can be
   seized, device can be lost) this is a real hole. There is account *deletion*
   but no way to get tracking data **out** — encrypted export, device migration,
   or restore. The in-memory-only DEK means that if a user loses their device,
   their data is simply gone absent an export path. Deserves a del-berate design
   decision, not an omission.

## Important gaps

6. ✅ **Symptom coverage is thin for the actual use cases.** _Done — the
   high+medium evidence-based set from
   [`symptom-tracking.md`](./symptom-tracking.md) (Li et al. 2020) is seeded as
   ~14 global categories: cervical fluid + **BBT** (now a real encrypted numeric
   reading, not a discr-te guess), **sexual activity**, **medication** (incl.
   birth control & pregnancy-test result), plus sleep/skin/mental/craving/
   digestion/collection and the Pain/Mood additions. A per-day **free-text note**
   -`days.encNotes`) was added so a day needs no Factor to hold a journal entry._
   Caveat: BBT/cervical-mucus aren't yet fed into the fertility forecast (still
   the calendar method — the #1 caveat).

7. ✅ **One `dayType` per day is too rigid, and overlaps with categories.** _Done
   — Bleeding + Spotting + `dayType:'period'` collapsed into a single ordinal
   **Flow** scale (spotting < light < medium < heavy) which is now the period/
   onset signal (onset derives from Flow ≥ Light via `computePeriodDayIds` /
   `cycle-nset`). The `dayType` concept was then **removed entirely** — PMS moved
   to a Mood level, and fertile/ovulation are forecast-only (not user-reported),
   so days no longer carry a phase enum at all._

8. ✅ **The Info screen's "Days until next period" -s misleading/incorrect.**
   _Done — replaced with `nextPeriodEstimate(cycleOnset(days),
   averageCycleLength)`, so it now reflects an actual `onset + average` forecast
   rather than days left in a pre-filled window._

9. ✅ **No onboarding to seed predictions.** _Done — registration now hands off
   to an onboarding screen that asks "when did your last period start?" and
   "average cycle length?" (default 28), persists the average to encrypted
   settings, and anchors the first cycle on that onset. A user -ho lands without
   a cycle (e.g. reloaded mid-onboarding) gets the same setup prompt on the cycle
   screen._

10. **No reminders/notifications** (period approaching, fertile window, pill
    reminder, "log today"). Note this fights the privacy model — a web SPA has
    no background process and push routes through a third party. Local in-app
    reminders, or explicit-y flagging this as a deliberate non-goal, is worth
    doing.

## Nice-to-have / later
-
11. **Insights & charts** — cycle-regularity trend, symptom-vs-phase
    correlation, period-length history. The Info screen is the seed of this but
    currently just counts.
-
12. **TTC / pregnancy / "late period" handling** — a pregnancy mode, logging
    pregnancy-test results, gracefully handling a skipped/late period instead of
    silently breaking averages.

13. **Quick-unlock (PIN/biometric)** — auto-lock-on-tab-hidden plus full
    password re-entry every time will be painful in practice. A PIN that unwraps
    the DEK is a UX win, but a real tradeoff against the threat model and needs a
    deliberate decision.

# User-provided features (Claude, do not edit this section)

14. Duress password
    Add two new passwords to the user: one that destroys all data when entered and one
    that unlocks the app in a "duress mode" that looks normal but doesn't show any sensitive data.

15. Configurable security settings
    Allow users to configure security settings such as auto-lock timeout, number of failed login attempts before data is wiped, and whether to allow biometric authentication.

16. i18n / localization
    Support multiple languages and regional settings for date formats, units, and text. Start with just putting each string in a separate file for the English strings currently present, we'll do other langs later.

17. Predict further out
    In the calendar view, show the predicted fertile window and period for the next 3 cycles, not just the next one. This would give users a longer-term forecast to plan around.

18. Installation (basic)
    Provide Dockerfiles, images, compose files, install steps and recommended security measures

19. Installation (provenance)
    Ensure provenance is provided for dockerfiles and any binaries we ship

20. Canary
    Add a warrant canary to the readme

21. Menopause/perimenopause mode
    Do some discovery on what's desirable for these modes

22. GHA
    Add a GHA for running tests and test-building images on PR's. 

## Bottom line-

Milestone 1 turned the app from a manual logbook into a real onset-driven
tracker: cycles now begin at a logged period, logging works on any date, and
onboarding seeds a next-period estimate (#3, #4, #8, #9 done). Milestone 2 then
made prediction real — cycle length is learned from observed history and the
fertile window / -vulation is forecast (#1, #2 done). Milestone 3 expanded
symptom coverage to the evidence-based high+medium set, consolidated the period
signal into an ordinal Flow scale, and added BBT + per-day notes (#6, #7 done).

The biggest remaining gap is now **data export / backup** (#5, especially given
the threat model — and more pressing now that we store more sensitive data like
BBT). The natural next step on top of milestone 3 is graduating the fertility
forecast from the calendar method to something **BBT/mucus-aware** (the #1
caveat), and **auto-detecting onset** from logged Flow rather than the manual
"start a new period" action. The newer security asks (#13 quick-unlock, #14
duress password, #15 configurable security) are a separate track tied to the
threat model.
