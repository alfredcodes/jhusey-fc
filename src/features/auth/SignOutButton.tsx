import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { secondaryButtonClass } from '../../components/form.tsx'
import { supabase } from '../../lib/supabase.ts'

export default function SignOutButton() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  async function signOut() {
    await supabase.auth.signOut()
    // Drop cached data so the next person on this device never sees it.
    queryClient.clear()
    navigate('/login', { replace: true })
  }

  return (
    <button type="button" onClick={signOut} className={secondaryButtonClass}>
      Sign out
    </button>
  )
}
