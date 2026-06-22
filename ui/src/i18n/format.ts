import { enUS } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { useTranslation } from 'react-i18next';

/** Mapping between i18next language codes and date-fns locales. */
const DATE_FNS_LOCALES: Record<string, Locale> = {
  en: enUS,
};

/** Resolve a `date-fns` locale from an i18next language tag (e.g. en-GB > en). */
export function dateFnsLocale(language: string): Locale {
  return DATE_FNS_LOCALES[language.split('-')[0]] ?? enUS;
}

/** Hook returning the `date-fns` locale for the active UI language. Pass the
 * result to `format(...)` as `{ locale }`. Re-renders on language change. */
export function useDateFnsLocale(): Locale {
  const { i18n } = useTranslation();
  return dateFnsLocale(i18n.language);
}
