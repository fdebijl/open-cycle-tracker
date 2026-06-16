/** A locale the UI can switch to. `code` is the i18next/BCP-47 language tag,
 * `label` is the human name shown in the Settings language switcher. */
export interface SupportedLocale {
  code: string;
  label: string;
}

/**
 * The single source of truth for which languages exist. The Settings switcher
 * maps over this, and i18next's `supportedLngs` is derived from it, so adding a
 * language is "append an entry here + drop in a `locales/<code>/translation.json`"
 * with no further code change.
 */
export const SUPPORTED_LOCALES: SupportedLocale[] = [{ code: 'en', label: 'English' }];

export const DEFAULT_LOCALE = 'en';
