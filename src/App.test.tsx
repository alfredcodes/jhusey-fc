import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { renderWithProviders } from './test/render.tsx'
import { sessionFor, type FakeState } from './test/supabase-mock.ts'

const fake = vi.hoisted((): FakeState => ({ session: null, profile: null, rows: {} }))

vi.mock('./lib/supabase.ts', async () => {
  const { buildFakeSupabase } = await import('./test/supabase-mock.ts')
  return { supabase: buildFakeSupabase(fake) }
})

function signInAs(role: 'admin' | 'member', is_active = true) {
  fake.session = sessionFor('user-1')
  fake.profile = { id: 'user-1', display_name: 'Test Player', role, is_active }
}

const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })

beforeEach(() => {
  fake.session = null
  fake.profile = null
  fake.rows = {}
})

describe('signed out', () => {
  it.each(['/', '/audit', '/settings?tab=rules'])('redirects %s to sign in', async (path) => {
    renderWithProviders(<App />, { path })
    expect(await heading('Sign in')).toBeInTheDocument()
  })

  it('shows the 404 page for unknown routes', async () => {
    renderWithProviders(<App />, { path: '/does-not-exist' })
    expect(await heading('Page not found')).toBeInTheDocument()
  })

  it('forgot password explains the admin reset (no email is sent)', async () => {
    renderWithProviders(<App />, { path: '/forgot-password' })
    expect(await heading('Forgot your password?')).toBeInTheDocument()
    expect(screen.getByText(/Ask the team admin/)).toBeInTheDocument()
  })
})

describe('signed in as a member', () => {
  beforeEach(() => signInAs('member'))

  it('shows the shared dashboard and the same screens as the admin, minus the audit log', async () => {
    renderWithProviders(<App />, { path: '/' })
    expect(await heading('Welcome back, Test Player')).toBeInTheDocument()
    const nav = screen.getAllByRole('navigation', { name: 'Main' })[0]
    for (const name of [
      'Attendance Record',
      'Fines',
      'Payments',
      'Members',
      'Reports',
      'Settings',
    ]) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument()
    }
    expect(within(nav).queryByRole('link', { name: 'Audit Log' })).not.toBeInTheDocument()
  })

  it.each(['/audit', '/admin', '/admin/fines'])('cannot open %s', async (path) => {
    renderWithProviders(<App />, { path })
    expect(await heading('Welcome back, Test Player')).toBeInTheDocument()
  })

  it('settings show only profile and security; Club, Futsal and Rules are hidden', async () => {
    renderWithProviders(<App />, { path: '/settings' })
    expect(await heading('Settings & Preferences')).toBeInTheDocument()
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent)
    expect(tabs).toEqual(['Profile & Account', 'Security & Password'])
  })

  it.each(['rules', 'club', 'futsal'])(
    'typing ?tab=%s still shows only their profile',
    async (tab) => {
      renderWithProviders(<App />, { path: `/settings?tab=${tab}` })
      expect(await heading('Settings & Preferences')).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Profile & Account' })).toHaveAttribute(
        'aria-selected',
        'true',
      )
      expect(screen.queryByText('Pitch validation & disciplinary rules')).not.toBeInTheDocument()
      expect(screen.queryByText('Punch-in area / geofence')).not.toBeInTheDocument()
    },
  )

  it('a deactivated member is stopped at the door', async () => {
    signInAs('member', false)
    renderWithProviders(<App />, { path: '/' })
    expect(await heading('Account deactivated')).toBeInTheDocument()
  })

  it('a member with an admin-set password must change it first', async () => {
    fake.rows.member_private = [{ phone: null, must_change_password: true }]
    renderWithProviders(<App />, { path: '/fines' })
    expect(await heading('Choose your own password')).toBeInTheDocument()
  })
})

describe('signed in as the admin', () => {
  beforeEach(() => signInAs('admin'))

  it('sees the audit log in the navigation and can open it', async () => {
    renderWithProviders(<App />, { path: '/audit' })
    expect(await heading('Audit Log')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Audit Log' }).length).toBeGreaterThan(0)
  })

  it('sees the Club, Futsal and Rules settings', async () => {
    renderWithProviders(<App />, { path: '/settings' })
    expect(await heading('Settings & Preferences')).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Profile & Account',
      'Security & Password',
      'Club',
      'Futsal',
      'Rules',
    ])
  })

  it('old /admin links land on the dashboard', async () => {
    renderWithProviders(<App />, { path: '/admin/attendance' })
    expect(await heading('Welcome back, Test Player')).toBeInTheDocument()
  })
})
