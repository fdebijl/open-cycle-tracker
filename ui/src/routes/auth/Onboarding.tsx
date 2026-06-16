import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthCard } from '@/components/AuthCard';
import { CycleSetupForm } from '@/components/cycle/CycleSetupForm';
import type { CycleSetupValues } from '@/components/cycle/CycleSetupForm';
import { useVault } from '@/stores/vault';
import { useStartCycle, useUpdateSettings } from '@/data/hooks';
import { RecoveryReveal } from './RecoveryReveal';

/**
 * Post-registration onboarding, reached via `navigate('/onboarding', { state:
 * { mnemonic } })` so it sits outside the `PublicOnly` guard (the account is
 * already signed in by this point). We (1) make the user save their one-time
 * recovery phrase, then (2) collect their cycle setup, persist the average
 * length, and anchor their first cycle on the onset they gave.
 *
 * The mnemonic lives in router state (memory) only: a reload loses it, so we
 * redirect to the cycle screen, whose no-cycle fallback offers the same setup
 * form (minus the one-time recovery phrase).
 */
export function Onboarding() {
  const hasSession = useVault((s) => s.session !== null);
  const location = useLocation();
  const mnemonic = (location.state as { mnemonic?: string } | null)?.mnemonic;

  const [step, setStep] = useState<'recovery' | 'cycle'>('recovery');
  const [error, setError] = useState<string | null>(null);
  const updateSettings = useUpdateSettings();
  const startCycle = useStartCycle();
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!hasSession) return <Navigate to="/login" replace />;
  // Reloaded (or arrived without a freshly minted phrase) → fall back to the
  // cycle screen, which prompts for setup if no cycle exists yet.
  if (!mnemonic) return <Navigate to="/" replace />;

  const busy = updateSettings.isPending || startCycle.isPending;

  async function onSetup({ onset, averageCycleLength }: CycleSetupValues) {
    setError(null);
    try {
      await updateSettings.mutateAsync({ averageCycleLength });
      await startCycle.mutateAsync({ onset });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('onboarding.setupFailed'));
    }
  }

  if (step === 'recovery') {
    return (
      <AuthCard title={t('onboarding.recoveryTitle')}>
        <RecoveryReveal mnemonic={mnemonic} onConfirm={() => setStep('cycle')} />
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t('onboarding.cycleTitle')}>
      <p style={{ color: 'var(--oct-muted)', fontSize: 13, marginTop: 0 }}>
        {t('onboarding.intro')}
      </p>
      <CycleSetupForm onSubmit={onSetup} busy={busy} error={error} submitLabel={t('cycleSetup.startTracking')} />
    </AuthCard>
  );
}
