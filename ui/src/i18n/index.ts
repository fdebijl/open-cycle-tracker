import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './config';
import en from './locales/en/translation.json';

/**
 * Single-namespace (`translation`) i18next setup, imported once from `main.tsx`
 * before the app renders. `react-i18next` reads this global instance, so no
 * extra React provider is required.
 *
 * Language is detected from `localStorage` first (the persisted user choice from
 * the Settings switcher), then the browser, then `DEFAULT_LOCALE`. It's a
 * non-sensitive UI preference, so `localStorage` is fine — no server round-trip
 * and nothing to encrypt.
 */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en } },
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES.map((l) => l.code),
    // React already escapes interpolated values, so i18next must not double-escape.
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
