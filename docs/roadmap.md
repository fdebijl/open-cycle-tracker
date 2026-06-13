# Open Cycle Tracker — Feature Roadmap

A gap analysis of the current functionality against what a menstrual cycle
tracker is generally expected to do. The encryption model and data schema are in
good shape (see [`architecture.md`](./architecture.md) and
[`encryption.md`](./encryption.md)); the gaps are almost entirely in **product
logic**. Today the app is effectively a *manual logbook* — it stores what the
user types but derives almost nothing from it.

## What the app does today

- **Tracking primitives:** a `Cycle` groups `Day`s; each day has a date and one
  `dayType` (`none | period | fertile | ovulation | pms`). Days carry `Factor`s
  against category levels (seeded globals: Bleeding, Spotting, Pain, Mood,
  Energy, plus user-defined custom categories).
- **Cycle creation:** on first load the app auto-generates a fixed **28-day**
  cycle starting *today*. "Current cycle" = newest by `createdAt`.
- **Views:** circular cycle view, a day editor, a month calendar (colored by day
  type), an Info screen with three stats, settings with hold-to-delete.
- **Auth/crypto:** full E2EE (signup, login, unlock, password change, recovery).

## Critical gaps (table-stakes for any cycle tracker)

1. **No prediction at all.** The primary reason people use a cycle tracker.
   There is no forecast of next period, fertile window, or ovulation. The model
   treats `fertile`/`ovulation` as *manual labels* the user sets by hand, rather
   than values *computed* from history. A real tracker learns average cycle
   length + period length and projects forward.

2. **No cycle-length learning or history.** Every cycle is hardcoded to 28 days.
   There is no concept of average cycle length, period length, or variability
   across past cycles — which is both the input to prediction *and* the thing
   users most want to see ("your cycles average 30 days, range 27–33"). The raw
   data exists (cycles have `createdAt`, days have dates) but nothing computes
   it.

3. **Cycles don't start from a logged period.** The standard model is: user logs
   the first day of bleeding → app closes the previous cycle and opens a new one
   → cycle length = onset-to-onset gap. Here cycles are created
   manually/automatically with no link to period onset, so length can never be
   derived correctly.

4. **Can't easily log an arbitrary or past date.** The flow pre-generates 28
   days from today, and the calendar **disables any date that isn't already a
   generated day** (`disabled={!day}` in `Calendar.tsx`). So "I started my
   period today" on a real-world date outside that window, or backfilling an
   untracked past period, isn't possible. Ad-hoc "log today / log a past day" is
   fundamental.

5. **No data export / backup.** Given the explicit threat model (server can be
   seized, device can be lost) this is a real hole. There is account *deletion*
   but no way to get tracking data **out** — encrypted export, device migration,
   or restore. The in-memory-only DEK means that if a user loses their device,
   their data is simply gone absent an export path. Deserves a deliberate design
   decision, not an omission.

## Important gaps

6. **Symptom coverage is thin for the actual use cases.** Missing categories
   most trackers treat as core:
   - **Cervical mucus / discharge** and **basal body temperature (BBT)** — the
     inputs for fertility-awareness method; without them the `fertile`/
     `ovulation` types are guesses.
   - **Sexual activity (protected/unprotected)** — central to both TTC and the
     "am I at risk" use case that motivated this project post-Roe.
   - **Medication / birth control / pregnancy-test result.**
   - There is also **no free-text note per day** — notes only attach to a
     `Factor`, so a day with no symptom factor has nowhere for a journal entry.

7. **One `dayType` per day is too rigid, and overlaps with categories.** A day
   can realistically be both "period" and "PMS"-adjacent, and `dayType:
   'period'` duplicates the seeded "Bleeding" category. Consider flow-intensity
   as the period signal and dropping the redundant enum, or allowing multiple
   phase tags.

8. **The Info screen's "Days until next period" is misleading/incorrect.** It
   computes `differenceInCalendarDays(last_tracked_date, today)` — days relative
   to the last *generated* day, not a prediction. Since days are generated 28
   ahead from signup, this is essentially "days left in the pre-filled window,"
   mislabeled as a forecast. Reads as a real prediction and is wrong. Quick bug
   fix regardless of the larger prediction work.

9. **No onboarding to seed predictions.** Even once prediction exists it needs a
   starting point: ask "when did your last period start?" and "typical cycle
   length?" at signup so the app is useful on day one instead of after months of
   data.

10. **No reminders/notifications** (period approaching, fertile window, pill
    reminder, "log today"). Note this fights the privacy model — a web SPA has
    no background process and push routes through a third party. Local in-app
    reminders, or explicitly flagging this as a deliberate non-goal, is worth
    doing.

## Nice-to-have / later

11. **Insights & charts** — cycle-regularity trend, symptom-vs-phase
    correlation, period-length history. The Info screen is the seed of this but
    currently just counts.

12. **TTC / pregnancy / "late period" handling** — a pregnancy mode, logging
    pregnancy-test results, gracefully handling a skipped/late period instead of
    silently breaking averages.

13. **Quick-unlock (PIN/biometric)** — auto-lock-on-tab-hidden plus full
    password re-entry every time will be painful in practice. A PIN that unwraps
    the DEK is a UX win, but a real tradeoff against the threat model and needs a
    deliberate decision.

# User insights

14. Duress password
    Add two new passwords to the user: one that destroys all data when entered and one
    that unlocks the app in a "duress mode" that looks normal but doesn't show any sensitive data.

15. Configurable security settings
    Allow users to configure security settings such as auto-lock timeout, number of failed login attempts before data is wiped, and whether to allow biometric authentication.

## Bottom line

The encryption and data model are solid, but the app is currently a *manual
logbook* missing the three things that make a cycle tracker a cycle tracker:
**prediction, cycle-length learning, and period-onset-driven cycle boundaries**
(gaps 1–3). Right behind those: **arbitrary/past-date logging** (#4) and **data
export** (#5, especially given the threat model). Gap #8 (the wrong stat) is a
quick fix worth doing regardless.

Implementing the prediction + cycle-length model would also resolve #2, #3, and
#8 together — a natural first milestone.
