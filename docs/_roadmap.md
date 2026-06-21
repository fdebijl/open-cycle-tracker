# Open Cycle Tracker - Feature Roadmap

A gap analysis of the current functionality against what a menstrual cycle
tracker is generally expected to do.

## Features

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

5. ✅ **No data export / backup.** _Done — Settings → Data exports the full
   dataset as either a self-contained **encrypted backup** (sealed with the
   in-memory DEK; unlocked by the account's existing 24-word recovery phrase, so
   it survives a lost password and a vanished server) or, as a warned opt-in, a
   **plaintext JSON** file for portability. Import merges a backup into the
   logged-in account, de-duplicating by date (so re-imports are safe) and
   re-encrypting under the current DEK — which also covers migrating into a fresh
   self-hosted instance. Entirely client-side: export reuses the recovery
   material from `POST /auth/recover/init` and restore reuses the existing CRUD
   endpoints, so the server never sees plaintext and needed no changes. See
   [`05_plan_import_export.md`](./05_plan_import_export.md)._ Caveat: factor refs
   resolve across instances by global-category slug/name, and user-defined
   category levels don't preserve their ordinal `order` (the create endpoint
   doesn't accept it) — neither matters today since no UI creates custom
   categories yet.

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

11. ✅ **Insights & charts** — _Done — the Info screen now carries two charts
    below its stat cards: a **cycle-length history** bar chart with a rolling-
    average **regularity trend** line + ± variability band, and a **symptom-vs-
    phase** heatmap (categories × menstrual/follicular/ovulatory/luteal). All
    derived client-side by a new pure, unit-tested `ui/src/data/insights.ts`
    (`cycleLengthHistory`, `classifyPhase`, `symptomPhaseMatrix`) and rendered as
    hand-rolled SVG / a `<table>` (no charting dependency). See
    [`11_plan_insights_charts.md`](./11_plan_insights_charts.md)._ Caveat: a BBT
    chart is deferred (needs per-day decryption of the encrypted factor values).

12. **TTC / pregnancy / "late period" handling** — a pregnancy mode, logging
    pregnancy-test results, gracefully handling a skipped/late period instead of
    silently breaking averages.

13. **Quick-unlock (PIN/biometric)** — auto-lock-on-tab-hidden plus full
    password re-entry every time will be painful in practice. A PIN that unwraps
    the DEK is a UX win, but a real tradeoff against the threat model and needs a
    deliberate decision.

14. ✅ Duress password
    Add two new passwords to the user: one that destroys all data when entered and one
    that unlocks the app in a "duress mode" that looks normal but doesn't show any sensitive data.

15. Configurable security settings
    Allow users to configure security settings such as auto-lock timeout ✅, number of failed login attempts before data is wiped, and whether to allow biometric authentication.

16. ✅ i18n / localization
    Support multiple languages and regional settings for date formats, units, and text. Start with just putting each string in a separate file for the English strings currently present, we'll do other langs later.

17. Predict further out
    In the calendar view, show the predicted fertile window and period for the next 3 cycles, not just the next one. This would give users a longer-term forecast to plan around.

18. Installation (basic)
    Provide Dockerfiles✅, images✅, compose files✅, install steps and recommended security measures

19. Installation (provenance)
    Ensure provenance is provided for dockerfiles and any binaries we ship

20. Canary
    Add a warrant canary to the readme

21. Menopause/perimenopause mode
    Do some discovery on what's desirable for these modes
    Discovery done + v1 shipped: a `trackingMode` (standard/perimenopause/postmenopause)
    that relaxes/suppresses predictions, surfaces "unknown" and long-gap signals, adds
    vasomotor + somatic symptoms, and gently suggests the mode from a STRAW+10 read of
    cycle history. See [`21_plan_perimenopause_mode.md`](./21_plan_perimenopause_mode.md).

22. GHA
    Add a GHA for running tests (✅) and test-building images on PR's. 

23. DHI
    Use Docker's Hardened Images for the base images of UI and API

24. ✅ Linting + SAST
    Add eslint, csslint and security linters like zizmor and codeql

25. ✅ Fix cycle circle
    Dots are quite small, animations are a bit wonky and it might need a legend

26. Fix tracking tab not highlighting the navbar button when the page is active

27. Add comparisons to other cycle trackers
    Like drip and peri on the FOSS side and Clue/Flo on the commercial side

28. Finish docs

29. ✅ Setup demo website 
    Will need a DEMO_MODE flag

30. Allow account registration to be disabled outright or switched to an approve mode
    Will need a place to approve registration requests - should we add an admin mode/flag?

31. ✅ Cycle circle redesign — toggleable markers + PMS
    Fold the "fix cycle circle" polish (#25) into a redesign where all four cycle-phase
    markers (menstruation, fertile, ovulation, PMS) are individually toggleable.
    Menstruation/fertile/ovulation default on; PMS defaults off. Bring back the PMS
    highlight from the legacy design, but anchored to the predicted next onset (luteal
    phase) rather than a flat "last 5 days" offset, and shown only when the cycle can be
    predicted with some reliability. See [`31_plan_cycle_circle_redesign.md`](./31_plan_cycle_circle_redesign.md).

32. Add defaults robots.txt
    Should obviously discourage crawling

33. Favicon, logo and keyart

34. Add age field on users
    Users can add their birthdate (or just birth year) to their health settings, might aid in perimenopause suggestions

35. Add birth control field on users
    Allow users to set which birth control method they use. Hormonal birth control should probably feed into cycle predictions, but we should do more research on what the implications are on this.

36. Allow custom categories + factors to be added

37. Perimenopause staging UI (STRAW+10)
    Build on the `classifyMenopausalStage` helper shipped in #21 to surface the detected
    stage (early/late menopausal transition, postmenopause) with its signals and the
    exclusion caveats (pregnancy / hormonal contraception; FSH is suggestive, not
    diagnostic) on the Info screen. v1 only uses the helper for a gentle mode suggestion.
    Overlaps #6 (anovulation / ovulation-trend detection needs BBT / cervical-fluid input).

38. Tutorial/usage onboarding
    Add a screen or guided tour of the app to onboard new users

39. In-app help center

40. Fix onboarding button styling

41. Cleanup (verbose) comments

42. Add custom styles for toggle- and radio buttons
