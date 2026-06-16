import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { installAutoLock, useVault } from '@/stores/vault';
import { AppLayout } from '@/components/AppLayout';
import { Login } from './auth/Login';
import { Register } from './auth/Register';
import { Onboarding } from './auth/Onboarding';
import { Recover } from './auth/Recover';
import { Unlock } from './Unlock';
import { CurrentCycle } from './cycle/CurrentCycle';
import { ShowCycle } from './cycle/ShowCycle';
import { DayTracker } from './tracking/DayTracker';
import { Today } from './Today';
import { Calendar } from './Calendar';
import { Info } from './Info';
import { SettingsLayout } from './settings/SettingsLayout';
import { ProfileSettings } from './settings/ProfileSettings';
import { HealthSettings } from './settings/HealthSettings';
import { PersonalizationSettings } from './settings/PersonalizationSettings';
import { SecuritySettings } from './settings/SecuritySettings';
import { AboutSettings } from './settings/AboutSettings';

/** Authenticated + unlocked gate: needs a session AND an in-memory DEK. */
function RequireUnlocked({ children }: { children: ReactNode }) {
  const hasSession = useVault((s) => s.session !== null);
  const hasDek = useVault((s) => s.dek !== null);
  if (!hasSession) return <Navigate to="/login" replace />;
  if (!hasDek) return <Navigate to="/unlock" replace />;
  return <>{children}</>;
}

/** The unlock screen requires a session but (by definition) no DEK. */
function RequireSession({ children }: { children: ReactNode }) {
  const hasSession = useVault((s) => s.session !== null);
  const hasDek = useVault((s) => s.dek !== null);
  if (!hasSession) return <Navigate to="/login" replace />;
  if (hasDek) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Public auth screens redirect inward once fully signed in. */
function PublicOnly({ children }: { children: ReactNode }) {
  const hasSession = useVault((s) => s.session !== null);
  const hasDek = useVault((s) => s.dek !== null);
  if (hasSession && hasDek) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function AppRoutes() {
  useEffect(() => installAutoLock(), []);

  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/recover" element={<PublicOnly><Recover /></PublicOnly>} />
      <Route path="/unlock" element={<RequireSession><Unlock /></RequireSession>} />
      {/* Reached right after registration (session + DEK already set); guards
          itself on the in-memory mnemonic, so it sits outside PublicOnly. */}
      <Route path="/onboarding" element={<Onboarding />} />

      <Route element={<RequireUnlocked><AppLayout /></RequireUnlocked>}>
        <Route path="/" element={<CurrentCycle />} />
        <Route path="/cycles/:id" element={<ShowCycle />} />
        <Route path="/days/:id" element={<DayTracker />} />
        <Route path="/today" element={<Today />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/info" element={<Info />} />
        <Route path="/settings" element={<SettingsLayout />}>
          <Route index element={<Navigate to="profile" replace />} />
          <Route path="profile" element={<ProfileSettings />} />
          <Route path="health" element={<HealthSettings />} />
          <Route path="personalization" element={<PersonalizationSettings />} />
          <Route path="security" element={<SecuritySettings />} />
          <Route path="about" element={<AboutSettings />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
