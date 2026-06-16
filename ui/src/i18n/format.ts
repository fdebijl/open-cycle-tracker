import { enUS } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { useTranslation } from 'react-i18next';

/**
 * Bridges i18next's active language to a `date-fns` locale. `date-fns`
 * formatting (`format(d, 'MMM d', { locale })`) is locale-sensitive but separate
 * from string translation, so this keeps the seam in one place: adding a UI
 * language means adding its `date-fns` locale here, not touching every date call.
 */
const DATE_FNS_LOCALES: Record<string, Locale> = {
  en: enUS,
};

/** Resolve a `date-fns` locale from an i18next language tag (e.g. `en-GB` → en). */
export function dateFnsLocale(language: string): Locale {
  return DATE_FNS_LOCALES[language.split('-')[0]] ?? enUS;
}

/** Hook returning the `date-fns` locale for the active UI language. Pass the
 * result to `format(...)` as `{ locale }`. Re-renders on language change. */
export function useDateFnsLocale(): Locale {
  const { i18n } = useTranslation();
  return dateFnsLocale(i18n.language);
}
