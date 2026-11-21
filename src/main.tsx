import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import StatusScreen from './components/StatusScreen.tsx'
import { findEnvProblem } from './lib/env.ts'
import './index.css'

const root = createRoot(document.getElementById('root')!)
const envProblem = findEnvProblem(import.meta.env)

if (envProblem) {
  // The Supabase client cannot be created, so do not load the app at all.
  root.render(
    <StatusScreen title="App setup problem" message={envProblem}>
      <p className="text-sm text-slate-600">
        Fix <code>.env.local</code> (see <code>.env.example</code>), then restart{' '}
        <code>npm run dev</code>.
      </p>
    </StatusScreen>,
  )
} else {
  // Loaded only after the check above, because importing the app creates the Supabase client.
  const [{ default: App }, { default: AuthProvider }] = await Promise.all([
    import('./App.tsx'),
    import('./features/auth/AuthProvider.tsx'),
  ])

  const queryClient = new QueryClient({
    defaultOptions: {
      // Data changes rarely for a 24-member team; avoid refetching on every tab focus.
      queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
    },
  })

  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}
