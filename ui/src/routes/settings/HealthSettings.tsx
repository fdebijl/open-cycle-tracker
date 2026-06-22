import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useCycles, useDays, usePeriodDayIds, useUpdateSettings, useUserSettings } from '@/data/hooks';
import { cycleOnsets } from '@/data/cycles';
import { classifyMenopausalStage } from '@/data/prediction';
import { defaultMarkersForMode } from '@/data/types';
import type { TrackingMode } from '@/data/types';
import styles from './Settings.module.scss';

/** The selectable tracking modes, in display order. */
const MODES: TrackingMode[] = ['standard', 'perimenopause', 'postmenopause'];

export function HealthSettings() {
  const { data: settings } = useUserSettings();
  const updateSettings = useUpdateSettings();
  const mode = settings?.trackingMode ?? 'standard';

  // Switching mode also reseeds the marker defaults for that mode (the user can
  // still re-enable any marker afterwards). Only write when the mode changes.
  const onSelectMode = (next: TrackingMode) => {
    if (next === mode) return;
    updateSettings.mutate({ trackingMode: next, markers: defaultMarkersForMode(next) });
  };

  return (
    <>
      <TrackingModeSection mode={mode} onSelect={onSelectMode} disabled={!settings || updateSettings.isPending} />
      <StagingHint mode={mode} onSwitchToPeri={() => onSelectMode('perimenopause')} />
    </>
  );
}

function TrackingModeSection({
  mode,
  onSelect,
  disabled,
}: {
  mode: TrackingMode;
  onSelect: (mode: TrackingMode) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.card}>
      <h2>{t('settings.health.mode.title')}</h2>
      <p className={styles.muted}>{t('settings.health.mode.intro')}</p>

      {MODES.map((m) => (
        <div key={m}>
          <label className={styles.toggleRow}>
            <input
              type="radio"
              name="trackingMode"
              value={m}
              checked={mode === m}
              onChange={() => onSelect(m)}
              disabled={disabled}
            />
            {t(`settings.health.mode.${m}`)}
          </label>
          <p className={styles.muted}>{t(`settings.health.mode.${m}Hint`)}</p>
        </div>
      ))}

      {mode !== 'standard' && <p className={styles.muted}>{t('settings.health.mode.caveat')}</p>}
    </div>
  );
}

/** A gentle, dismissible-by-switching suggestion to consider perimenopause mode
 * when recent cycles look like the early/late menopausal transition. Suggests only.
 */
function StagingHint({ mode, onSwitchToPeri }: { mode: TrackingMode; onSwitchToPeri: () => void }) {
  const { t } = useTranslation();
  const cyclesQuery = useCycles();
  const daysQuery = useDays();
  const periodDayIds = usePeriodDayIds();

  const onsets = useMemo(
    () =>
      cycleOnsets(cyclesQuery.data ?? [], daysQuery.data ?? [], periodDayIds)
        .map((c) => c.onset)
        .filter((o): o is Date => o != null),
    [cyclesQuery.data, daysQuery.data, periodDayIds],
  );
  const staging = useMemo(() => classifyMenopausalStage(onsets, new Date()), [onsets]);

  // Only nudge users who are still in standard mode and whose history already
  // looks transitional - never for someone who's chosen a mode deliberately.
  const transitional = staging.stage === 'early-transition' || staging.stage === 'late-transition';
  if (mode !== 'standard' || !transitional) return null;

  return (
    <div className={styles.card}>
      <h2>{t('settings.health.suggestion.title')}</h2>
      <p>{t('settings.health.suggestion.body')}</p>
      <p className={styles.muted}>{t('settings.health.suggestion.caveat')}</p>
      <button type="button" onClick={onSwitchToPeri}>
        {t('settings.health.suggestion.action')}
      </button>
    </div>
  );
}
