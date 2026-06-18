import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from './routes/AppRoutes';
import { loadRuntimeConfig } from './config/env';
import './i18n';
import './styles/global.scss';

const queryClient = new QueryClient();

// Resolve the runtime API origin (/config.js) before mounting, so the first
// request can't race an unconfigured API_URL.
async function bootstrap() {
  await loadRuntimeConfig();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void bootstrap();
