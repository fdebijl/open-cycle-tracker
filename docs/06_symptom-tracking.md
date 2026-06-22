# Symptom Tracking & Cycle Science - Evidence and Recommendations

What Open Cycle Tracker should let users track, and why - grounded in the largest
published analysis of real menstrual-tracking data and mapped onto our existing schema.

## 1. Source & scope

This document distills **Li, Urteaga, Wiggins, Druet, Shea, Vitzthum & Elhadad (2020),
"Characterizing physiological and symptomatic variation in menstrual cycles using
self-tracked mobile-health data," _npj Digital Medicine_ 3:79**
([DOI 10.1038/s41746-020-0269-8](https://doi.org/10.1038/s41746-020-0269-8)). The study
analyzes **117,014,597 tracking events from 378,694 Clue users** across **4.9M natural
cycles** - the strongest available evidence base for deciding *what to track and why*.

Two caveats frame everything below:

- The tracked symptoms are **self-reported, not validated clinical scales**, and are not
  designed for diagnosis. They reflect both physiology *and* app-engagement behavior - a
  user "not tracking heavy flow" may mean a light period *or* a skipped log.
- The study cohort was deliberately narrow (see §5), so its findings transfer best to the
  same population.

These map directly onto roadmap gap **#6 ("Symptom coverage is thin for the actual use
cases")**, which is still open, and touch **#7, #1/#2, #11, #12**.

## 2. Recommended symptoms to track

Clue exposes **20 tracking categories** (paper Table 3). OCT today seeds only **five**
global categories in
[`api/src/db/globalCategories.ts`](../api/src/db/globalCategories.ts) - Bleeding, Spotting,
Pain, Mood, Energy - modeled as `Category` > `CategoryLevel` > `Factor` in
[`ui/src/data/types.ts`](../ui/src/data/types.ts). The table maps Clue's categories onto
ours. "Tracking %" is the share of all observations in the paper's lower-variability group
(Table 3) - a proxy for how much users actually engage with each category.

| Clue category | Levels | Tracking % | Priority | OCT status / action |
|---|---|---|---|---|
| **Period flow** | spotting, light, medium, heavy | 19.7% | **High** | Overlaps our **Bleeding** + **Spotting** categories and `dayType:'period'` - consolidate into one ordinal flow scale (see below) |
| **Emotion** | happy, sensitive, sad, PMS | 10.2% | **High** | Maps to existing **Mood** category; add a PMS level |
| **Pain** | cramps, tender breasts, headache, ovulation pain | 8.7% | **High** | **Pain** exists (cramps/headache/backache) - add **tender breasts** + **ovulation pain** |
| **Fluid** (cervical mucus) | creamy, egg-white, sticky, atypical | 2.8% | **High** | New category - FAM fertility input (see below) |
| BBT (basal body temp) | numeric °C/°F | - (not in Clue) | **High** | New - needs a **numeric** field, not a discrete level (see §5) |
| **Sex** | unprotected, protected, withdrawal, high/low drive | 5.2% | **High** | New category - core to TTC *and* the post-Roe "am I at risk" use case |
| Energy | low, high, exhausted, energized | 7.5% | Medium | Have **Energy** (energetic/tired/exhausted) - align levels |
| Sleep | 0–3, 3–6, 6–9, >9 hrs | 7.5% | Medium | New |
| Skin | acne, good, oily, dry | 5.3% | Medium | New |
| Mental | calm, distracted, focused, stressed | 5.2% | Medium | New |
| Craving | sweet, salty, carbs, chocolate | 4.3% | Medium | New |
| Digestion | great, bloated, gassy, nauseated | 4.3% | Medium | New |
| Medication | pain, cold/flu, antihistamine, antibiotic + **birth control** + **pregnancy-test result** | 0.5% | Medium | New - birth-control & pregnancy-test logging (roadmap #6, #12) |
| Collection method | pad, tampon, panty liner, cup | 1.8% | Medium | New |
| Hair | good, bad, oily, dry | 2.8% | Low | New |
| Social | sociable, withdrawn, supportive, conflict | 3.7% | Low | New |
| Poop | normal, constipated, great, diarrhea | 3.5% | Low | New |
| Motivation | motivated, unmotivated, (un)productive | 4.9% | Low | New |
| Exercise | running, yoga, biking, swimming | 1.1% | Low | New |
| Party | drinks, cigarettes, big night, hangover | 0.8% | Low | New |
| Ailment | cold/flu, allergy, injury, fever | 0.5% | Low | New |

### High-priority rationale

- **Period flow (ordinal).** Period flow, pain, and emotion are the **three most-tracked
  and most diagnostically informative** categories - together ~38.5% of all events. "Heavy"
  flow has the **strongest symptom↔variability signal** in the study (KS statistic 0.181).
  OCT currently splits this across **Bleeding** (light/medium/heavy) and **Spotting**
  (red/brown), *and* duplicates it in `dayType: 'period'`. This is exactly roadmap **#7**'s
  "one `dayType` per day is too rigid and overlaps with categories." **Recommendation:**
  make a single ordinal flow scale (`spotting < light < medium < heavy`) *the* period
  signal, and treat onset detection off it (see §4) instead of the redundant enum.

- **Cervical mucus ("Fluid") + BBT.** These are the inputs for the
  **Fertility Awareness Method**. OCT's fertility forecast today is the calendar/rhythm
  method only ([`predictFertileWindow`](../ui/src/data/prediction.ts) - fixed 14-day luteal
  phase), which the paper confirms is the weaker approach; BBT + mucus is the validated
  upgrade path and the way to graduate roadmap **#1**'s caveat. **Privacy nuance worth
  noting:** the paper explicitly states Clue **could not include** BBT, cervical mucus,
  ovulation, or pregnancy-test fields because EU GDPR / data-privacy rules made those
  fields too sensitive to retain server-side. OCT's **E2EE model resolves exactly that
  tension** - these fields can be held safely because they never leave the device
  unencrypted. This is a genuine differentiator, not just a feature.

- **Sexual activity.** Central to both the trying-to-conceive use case and the "am I at
  risk" use case that motivates this project post-Roe. Levels: unprotected / protected /
  withdrawal, plus optionally drive.

- **Pain subtypes.** The paper finds tracking **headache** and **tender breasts** is
  significantly associated with high cycle variability (odds ratios **1.663** and **1.715**
  for consistent tracking; Table 6), and cramps + ovulation pain carry KS signal. OCT's
  Pain category already has cramps/headache/backache - add **tender breasts** and
  **ovulation pain**.

- **Emotion / PMS.** Third-most-tracked; significant variability association. Maps onto our
  existing **Mood** category - add a PMS level (and reconsider `dayType:'pms'` per #7).

### Free-text day note (roadmap #6)

Independent of the paper but a real gap: notes today attach only to a **`Factor`**
(`Factor.notes` in [`ui/src/data/types.ts`](../ui/src/data/types.ts)). A day with no
symptom factor has nowhere for a journal entry. **Recommendation:** add an optional
free-text note at the **`Day`** level.

## 3. Other useful features (from the paper)

- **Cycle variability as a first-class signal.** The paper's headline finding: ~**7.7%** of
  users are "consistently highly variable," and **variability - not just average length -
  is the clinically meaningful axis**. It correlates with symptom patterns and with
  conditions like **endometriosis and PCOS**. OCT already computes a std-dev `variability`
  inside [`cycleStats`](../ui/src/data/prediction.ts), but only uses it to widen the
  next-period band. **Recommendation:** surface regularity/variability as a first-class
  **Insight** (roadmap **#11**) - e.g. "your cycles have been regular/irregular over the
  last N months."

- **Symptom↔phase / symptom↔variability correlation** is the natural seed of the Insights
  screen (#11): e.g. surfacing that frequent headache or tender-breast logging co-occurs
  with more irregular cycles - framed as an observation, never a diagnosis (§5).

- **Debunk the "28-day normal" myth.** The paper measures a **median cycle of 29 days
  (mean 29.7)** with a wide, right-skewed range, and explicitly notes that "complete
  regularity is a myth." OCT defaults to `DEFAULT_AVERAGE_CYCLE_LENGTH = 28`
  ([`ui/src/data/types.ts`](../ui/src/data/types.ts)) - fine as a seed, but copy should
  **not** present 28 days (or any single number) as "normal."

## 4. Proven algorithms (from the paper)

- **Cycle Length Difference (CLD)** - the absolute difference between consecutive cycle
  lengths. The **per-user median CLD** is the paper's robust variability metric (robust to
  rare outliers, unlike a mean or raw std-dev). The study's threshold:
  **median CLD > 9 days ⇒ "consistently highly variable,"** chosen at the elbow of the
  cumulative distribution (Fig. 10). **Recommendation:** adopt median CLD as a
  clinically-grounded complement to the sample std-dev currently in `cycleStats`, both for
  the prediction band and the regularity Insight.

- **Period / onset definition (Clue/FIGO-aligned).** A period = sequential bleeding days
  (greater than spotting) within 10 days of the first greater-than-spotting bleeding event,
  unbroken by more than **1** non-bleeding/spotting day. This is the basis for
  **auto-detecting onset from logged flow** rather than the explicit "Start a new period"
  action - directly relevant to roadmap **#3**'s known limitation (onset is set manually
  today).

- **Engagement / artifact filtering (proven preprocessing).**
  - **Exclude cycles > 90 days** as forgot-to-track artifacts, not physiology (the paper
    treats a span > ~3 SD above mean period as an outlier). OCT's
    [`prediction.ts`](../ui/src/data/prediction.ts) already drops onset gaps `< 15` or
    `> 90` days - this **aligns** with the published method.
  - **Flag "atypically long" cycles** where a cycle's max CLD exceeds the user's *median*
    CLD by **>= 10 days** (the diagonal in Fig. 7 / Fig. 9). This is a smarter
    skipped/late-period detector than OCT's current hard 90-day cutoff and is the principled
    way to address roadmap **#12** (graceful late-period handling) instead of silently
    dropping outliers.
  - **Per-category tracking proportion (λ)** - the fraction of a user's cycles in which a
    category was tracked at least once - distinguishes genuine interest from noise, useful
    when deciding which symptoms to weight in any future insight.

- **Calendar/rhythm fertility method.** Already implemented in OCT
  (`predictFertileWindow`: fixed 14-day luteal phase, fertile window = ovulation −5 to +1
  days). The paper confirms this is the baseline and that **BBT + cervical mucus is the
  validated upgrade** (see §2).

## 5. Important considerations & caveats

- **Not clinical scales; no diagnoses.** Self-tracked symptoms conflate physiology with
  engagement behavior and are not validated instruments. Present everything as
  observations, never as medical claims or diagnoses - even though the diagnostic *signal*
  (e.g. for endometriosis/PCOS) is real, OCT is not a diagnostic device.

- **Cohort is narrow - don't over-generalize.** The study restricted to **ages 21–33,
  natural cycles only** (hormonal birth control and IUD users **excluded**), because cycles
  are most stable and ovulatory in that band. Findings may not transfer to adolescents,
  **perimenopause/menopause** (roadmap **#21**), or hormonal-contraception users - predictions
  should degrade gracefully or carry wider uncertainty for these groups rather than assume
  the same regularity.

- **Privacy is an enabler, not only a constraint.** The most valuable fertility fields
  (BBT, cervical mucus, ovulation, pregnancy tests) are precisely the ones Clue had to omit
  for data-protection reasons. OCT's E2EE model can hold them safely. This *strengthens* the
  case for **encrypted export/backup** (roadmap **#5**): the more sensitive data we store,
  the worse "lose your device, lose everything" becomes.

- **Symptom language is ambiguous.** The paper flags real overlap (e.g. "low energy" vs.
  "exhausted"). Keep level sets **small and clearly labelled**, and factor this into i18n
  (roadmap **#16**) so translations don't blur distinctions further.

- **Schema fit - two small model extensions implied.** The current `CategoryLevel` is
  **nominal** (`id`, `name`, `icon`; no value, no order). Two of the high-priority
  recommendations don't fit it cleanly:
  - **BBT** needs a **numeric** measurement, not a discrete level.
  - **Period flow** (and arguably sleep/energy) is **ordinal** - `spotting < light < medium
    < heavy` - but levels carry no order today.

  Both are minor schema additions, called out here so a future **#6 / #7** milestone can
  scope them deliberately rather than discover them mid-implementation.

---

_Source: Li et al., npj Digital Medicine 3:79 (2020),
https://doi.org/10.1038/s41746-020-0269-8. Code references current as of this writing -
see [`_roadmap.md`](./_roadmap.md) for milestone status._
