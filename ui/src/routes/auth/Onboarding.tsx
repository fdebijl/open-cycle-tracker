import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthCard } from '@/components/AuthCard';
import { CycleSetupForm } from '@/components/cycle/CycleSetupForm';
import type { CycleSetupValues } from '@/components/cycle/CycleSetupForm';
import { useVault } from '@/stores/vault';
import { useStartCycle, useUpdateSettings } from '@/data/hooks';
import { RecoveryReveal } from './RecoveryReveal';

export function Onboarding() {
  const hasSession = useVault((s) => s.session !== null);
  const location = useLocation();
  const mnemonic = (location.state as { mnemonic?: string } | null)?.mnemonic;
  // Mnemonic is not in router state on reload, so we kick the user back to the home page, which will re-initiate the onboarding
  const shouldFallbackToHome = !mnemonic;

  const [step, setStep] = useState<'recovery' | 'cycle'>('recovery');
  const [error, setError] = useState<string | null>(null);
  const updateSettings = useUpdateSettings();
  const startCycle = useStartCycle();
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!hasSession) return <Navigate to="/login" replace />;
  if (shouldFallbackToHome) return <Navigate to="/" replace />;

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
