import './index.css'
import '@fontsource-variable/figtree'
import '@astryxdesign/core/astryx.css'
import '@astryxdesign/charts/charts.css'
import '@astryxdesign/theme-neutral/theme.css'
import { InternationalizationProvider } from '@astryxdesign/core/i18n'
import ptBR from '@astryxdesign/core/locales/pt-BR.generated.js'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './astryx-dashboard.css'
import App from './App.tsx'
import { createDashboardQueryClient } from './config/queryClient.ts'
import { AutenticacaoProvider } from './contexts/AutenticacaoContext.tsx'
import { FiltroProvider } from './contexts/FiltroContext.tsx'
import { PageHeaderProvider } from './contexts/PageHeaderContext.tsx'

const dashboardBuildId = import.meta.env.VITE_DASHBOARD_BUILD_ID ?? 'dev';
document.documentElement.dataset.dashboardBuildId = dashboardBuildId;
document.documentElement.dataset.astryxTheme = 'neutral';

const queryClient = createDashboardQueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InternationalizationProvider locale="pt-BR" messages={{ 'pt-BR': ptBR }}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AutenticacaoProvider>
            <FiltroProvider>
              <PageHeaderProvider>
                <App />
              </PageHeaderProvider>
            </FiltroProvider>
          </AutenticacaoProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
    </InternationalizationProvider>
  </StrictMode>,
)
