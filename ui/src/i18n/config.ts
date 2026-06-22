/** A locale the UI can switch to. `code` is the i18next/BCP-47 language tag,
 * `label` is the human name shown in the Settings language switcher. */
export interface SupportedLocale {
  code: string;
  label: string;
}

export const SUPPORTED_LOCALES: SupportedLocale[] = [{ code: 'en', label: 'English' }];

export const DEFAULT_LOCALE = 'en';
