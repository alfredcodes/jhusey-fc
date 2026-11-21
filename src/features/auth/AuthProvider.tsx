import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase.ts'
import { AuthContext, type AuthState } from './auth-context.ts'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true })

  useEffect(() => {
    // Fires INITIAL_SESSION straight away (restored from storage), then on every
    // sign-in, sign-out and token refresh. Keep the callback synchronous: awaiting
    // other Supabase calls inside it can deadlock the auth client.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, loading: false })
    })
    return () => subscription.unsubscribe()
  }, [])

  // React 19: a context object can be rendered directly as its provider.
  return <AuthContext value={state}>{children}</AuthContext>
}
