import { useState } from 'react';
import type { FormEvent } from 'react';
import { format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Field } from '@/components/Field';
import { Spinner } from '@/components/Spinner';
import { DEFAULT_AVERAGE_CYCLE_LENGTH } from '@/data/types';

export interface CycleSetupValues {
  /** When the user's most recent period started - anchors their first cycle. */
  onset: Date;
  averageCycleLength: number;
}

/**
 * Collects the two things needed to bootstrap tracking: when the last period
 * started (the onset that anchors the first cycle) and the typical cycle length
 * (default 28). Presentational - the parent runs the async writes and owns the
 * busy/error state. Reused by onboarding and the no-cycle fallback.
 */
export function CycleSetupForm({
  onSubmit,
  busy = false,
  error,
  submitLabel,
  defaultAverageLength = DEFAULT_AVERAGE_CYCLE_LENGTH,
}: {
  onSubmit: (values: CycleSetupValues) => void;
  busy?: boolean;
  error?: string | null;
  submitLabel?: string;
  defaultAverageLength?: number;
}) {
  const { t } = useTranslation();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [onsetStr, setOnsetStr] = useState(today);
  const [length, setLength] = useState(String(defaultAverageLength));

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const n = Number.parseInt(length, 10);
    onSubmit({
      onset: parseISO(onsetStr),
      averageCycleLength: Number.isFinite(n) && n > 0 ? n : defaultAverageLength,
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field
        id="onset"
        label={t('cycleSetup.onsetLabel')}
        type="date"
        max={today}
        value={onsetStr}
        onChange={(e) => setOnsetStr(e.target.value)}
        disabled={busy}
        required
      />
      <Field
        id="averageCycleLength"
        label={t('cycleSetup.lengthLabel')}
        type="number"
        min={1}
        max={90}
        step={1}
        value={length}
        onChange={(e) => setLength(e.target.value)}
        disabled={busy}
        required
      />
      {error && <p className="oct-error">{error}</p>}
      <div className="oct-form-actions">
        <button type="submit" className="oct-primary" disabled={busy || !onsetStr || !length}>
          {busy ? <Spinner size="sm" label={t('cycleSetup.settingUp')} /> : (submitLabel ?? t('cycleSetup.startTracking'))}
        </button>
      </div>
    </form>
  );
}
