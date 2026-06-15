# i18n Wiring — Build Plan

## Context

The frontend (`ui/`, a React 19 + Vite SPA) has ~80–100 user-facing strings
hardcoded inline in JSX across ~18–20 files, with **no i18n infrastructure**.
We want to introduce internationalization now, before the surface area grows
further and the migration cost balloons.

Scope for this pass (clarified with the user):

- **Content:** English only. Extract every string into an `en` resource file
  and wire up the framework. Adding a real second language later becomes "drop
  in a new JSON file" rather than a code change.
- **Plumbing:** Build the full machinery now — language detection, a persisted
  user preference, and a **language switcher in Settings** — driven by a
  configured locale list so it grows automatically when locales are added.

## Library choice: `i18next` + `react-i18next`

This is the de-facto standard for React i18n and the safest "solid, proven"
pick:

- Largest ecosystem and best docs; battle-tested at scale.
- First-class React 19 hooks via `react-i18next` (`useTranslation`, `<Trans>`).
- Built-in **interpolation** (`{{var}}`), **pluralization** (backed by the
  native `Intl.PluralRules`, so it's correct for every locale's plural forms),
  and **custom formatters** we can hook `date-fns` into.
- Works as a plain JSON-resource setup — no build-time extraction step or
  compiler to learn, which suits a small string count and keeps the mental model
  simple.

> New-to-React note: `useTranslation()` returns a `t()` function. You replace
> `"Log in"` with `t('auth.login.submit')`, and the actual English text lives in
> a JSON file. The component re-renders automatically when the language changes —
> same reactive model as any other hook.

Alternatives considered and rejected for this codebase: **Lingui** (great DX but
adds a Babel/SWC macro + extraction build step — overkill here) and
**react-intl/FormatJS** (solid, but heavier ICU-message authoring and a smaller
hook ergonomics edge than react-i18next).

## Dependencies to add (`ui/package.json`)

- `i18next`
- `react-i18next`
- `i18next-browser-languagedetector` — detects browser locale and persists the
  chosen language to `localStorage` (no server round-trip; language is a
  non-sensitive UI preference, so this is preferable to the encrypted
  `useUserSettings` store).

## New files

```
ui/src/i18n/
├── index.ts            # i18next init + config; imported once from main.tsx
├── config.ts           # SUPPORTED_LOCALES list (label + code), DEFAULT_LOCALE
├── format.ts           # date-fns locale bridge (see "Dates" below)
└── locales/
    └── en/
        └── translation.json   # all extracted English strings, nested by feature
```

**Single default namespace (`translation`)** with keys nested by feature area,
e.g.:

```json
{
  "nav": { "tracking": "Tracking", "calendar": "Calendar", "cycle": "Cycle",
           "info": "My Info", "settings": "Settings" },
  "auth": { "login": { "submit": "Log in", "forgot": "Forgot password?" } },
  "info": {
    "avgCycleLength": "Avg cycle length ({{hint}})",
    "learnedFromCycles_one": "learned from {{count}} cycle",
    "learnedFromCycles_other": "learned from {{count}} cycles"
  }
}
```

At ~100 strings a single namespace is simpler than splitting; we can break out
per-feature namespaces later if it grows.

## Init & provider wiring

- `ui/src/i18n/index.ts`: `i18next.use(LanguageDetector).use(initReactI18next).init({...})`
  with `resources: { en: { translation } }`, `fallbackLng: 'en'`,
  `supportedLngs` from `config.ts`, and `interpolation.escapeValue: false`
  (React already escapes).
- `ui/src/main.tsx` (currently lines 1–18): add `import './i18n';` before
  rendering. `react-i18next` reads the global instance, so no extra provider is
  strictly required, but we'll keep the import at the top so init runs first.

## Migration strategy (incremental, low-risk)

Migrate **feature-area by feature-area**, committing per area so the diff stays
reviewable and the app keeps working throughout (untouched strings stay
hardcoded; touched ones move to `t()`).

Suggested order (easy → complex), with representative files:

1. **Navigation & shared components** — `components/NavBar.tsx` (the `ITEMS`
   array's `label` fields), `components/Spinner.tsx` (`label` prop call sites),
   `components/Field.tsx` (`label` prop call sites). These are already
   centralized, so they're the cleanest first wins.
2. **Auth flows** — `routes/auth/{Login,Register,Recover,RecoveryReveal,Onboarding}.tsx`,
   `components/AuthCard.tsx`. Mostly static labels, buttons, and error strings
   held in component state.
3. **Settings** — `routes/Settings.tsx` (labels + error messages on lines ~25–89),
   `components/EmergencyDelete.tsx`.
4. **Cycle & tracking** — `routes/cycle/{CurrentCycle,ShowCycle}.tsx`,
   `routes/Calendar.tsx`, `routes/tracking/{DayTracker,DayNote}.tsx`,
   `components/cycle/{CycleCircle,CycleSetupForm,DayMarker}.tsx`,
   `components/category/{BbtField,CategoryRow}.tsx`. These hold most of the
   dynamic/interpolated strings.
5. **Info / stats** — `routes/Info.tsx` (the trickiest: interpolation +
   pluralization + dates, see below).

**Pattern per file:** add `const { t } = useTranslation();`, replace each literal
with `t('feature.key')`, and add the key to `en/translation.json`. For text with
embedded JSX (e.g. multi-line recovery copy, `<>` fragments), use the `<Trans>`
component instead of `t()`.

### Handling the tricky cases

- **Interpolation** — `` `Day ${n}` `` → `t('tracking.day', { n })` with
  `"day": "Day {{n}}"`. Covers `CycleCircle.tsx`, `DayMarker.tsx`,
  `BbtField.tsx`, etc.
- **Pluralization** — replace the manual ternary in `Info.tsx:41`
  (`` `...${n} cycle${n === 1 ? '' : 's'}` ``) with i18next plural keys
  (`learnedFromCycles_one` / `_other`) called as
  `t('info.learnedFromCycles', { count: stats.sampleSize })`. i18next selects the
  form via `Intl.PluralRules`, which is what makes this correct for future
  locales that have more than two plural forms.
- **Dates** (`date-fns` `format(...)` in `Info.tsx`, `Calendar.tsx`,
  `DayTracker.tsx`) — `date-fns` formatting is locale-sensitive but separate from
  string translation. In `ui/src/i18n/format.ts`, register a date formatter on
  i18next's `interpolation.format` (or expose a tiny `useFormatDate()` hook) that
  picks the matching `date-fns` locale (e.g. `enUS`) from the active
  `i18n.language`. Then `format(d, 'MMM d')` calls pass `{ locale }`. For English
  only this is a no-op, but it puts the seam in the right place so adding a
  locale doesn't require touching every date call again.

## Language switcher + persistence

- `ui/src/i18n/config.ts` exports `SUPPORTED_LOCALES` (e.g.
  `[{ code: 'en', label: 'English' }]`) and `DEFAULT_LOCALE = 'en'`.
- Add a `<select>` (or existing styled control) in `routes/Settings.tsx` that
  maps over `SUPPORTED_LOCALES` and calls `i18n.changeLanguage(code)` on change.
- `i18next-browser-languagedetector` persists the choice to `localStorage` and
  restores it on load, falling back to browser language, then `DEFAULT_LOCALE`.
- With one locale the switcher shows a single option today; it becomes useful the
  moment a second entry is added to `SUPPORTED_LOCALES` — no further code change.

## Critical files to modify

- `ui/package.json` — add the three deps.
- `ui/src/main.tsx` — import `./i18n`.
- `ui/src/components/NavBar.tsx` — translate `ITEMS` labels (resolve `t()` inside
  the component, not in the module-level `const`).
- `ui/src/routes/Info.tsx` — interpolation + plural + date seam (reference case).
- `ui/src/routes/Settings.tsx` — strings **and** the new language switcher.
- ~15 further component/route files per the migration order above.

## Verification

1. `pnpm install` in `ui/`, then `pnpm dev` — app boots, every screen renders
   identical English text (visual no-op proves extraction didn't drop/garble
   strings).
2. Temporarily add a throwaway `fr` resource with a couple of overridden keys (or
   flip `lng: 'cimode'`, which makes i18next render raw keys) to confirm **every**
   visible string actually flows through `t()` — anything still in English is a
   missed extraction.
3. Exercise the dynamic cases: a cycle with `sampleSize === 1` vs `> 1` (plural),
   the fertile-window and calendar/day headers (dates), and a "Day N" marker
   (interpolation).
4. Toggle the Settings switcher and reload — the persisted language survives via
   `localStorage`.
5. `pnpm build` and `pnpm test` (vitest) pass.
6. Remove the throwaway `fr`/`cimode` check before committing.
