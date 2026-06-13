import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { installAutoLock, useVault } from '@/stores/vault';
import { AppLayout } from '@/components/AppLayout';
import { Login } from './auth/Login';
import { Register } from './auth/Register';
import { Recover } from './auth/Recover';
import { Unlock } from './Unlock';
import { CurrentCycle } from './cycle/CurrentCycle';
import { ShowCycle } from './cycle/ShowCycle';
import { DayTracker } from './tracking/DayTracker';
import { Today } from './Today';
import { Calendar } from './Calendar';
import { Info } from './Info';
import { Settings } from './Settings';

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

      <Route element={<RequireUnlocked><AppLayout /></RequireUnlocked>}>
        <Route path="/" element={<CurrentCycle />} />
        <Route path="/cycles/:id" element={<ShowCycle />} />
        <Route path="/days/:id" element={<DayTracker />} />
        <Route path="/today" element={<Today />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/info" element={<Info />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
