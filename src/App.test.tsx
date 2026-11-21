import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { renderWithProviders } from './test/render.tsx'
import { sessionFor, type FakeState } from './test/supabase-mock.ts'

const fake = vi.hoisted((): FakeState => ({ session: null, profile: null }))

vi.mock('./lib/supabase.ts', async () => {
  const { buildFakeSupabase } = await import('./test/supabase-mock.ts')
  return { supabase: buildFakeSupabase(fake) }
})

function signInAs(role: 'admin' | 'member', is_active = true) {
  fake.session = sessionFor('user-1')
  fake.profile = { id: 'user-1', display_name: 'Test Player', role, is_active }
}

const heading = (name: string) => screen.findByRole('heading', { level: 1, name })

beforeEach(() => {
  fake.session = null
  fake.profile = null
})

describe('signed out', () => {
  it.each(['/', '/admin'])('redirects %s to sign in', async (path) => {
    renderWithProviders(<App />, { path })
    expect(await heading('Sign in')).toBeInTheDocument()
  })

  it('shows the 404 page for unknown routes', async () => {
    renderWithProviders(<App />, { path: '/does-not-exist' })
    expect(await heading('Page not found')).toBeInTheDocument()
  })
})

describe('signed in as a member', () => {
  beforeEach(() => signInAs('member'))

  it('shows the member dashboard with their name', async () => {
    renderWithProviders(<App />, { path: '/' })
    expect(await heading('Member dashboard')).toBeInTheDocument()
    expect(screen.getByText('Test Player')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('cannot open the admin area', async () => {
    renderWithProviders(<App />, { path: '/admin' })
    expect(await heading('Member dashboard')).toBeInTheDocument()
  })

  it('is sent from /login to the dashboard', async () => {
    renderWithProviders(<App />, { path: '/login' })
    expect(await heading('Member dashboard')).toBeInTheDocument()
  })
})

describe('signed in as the admin', () => {
  beforeEach(() => signInAs('admin'))

  it('can open the admin dashboard', async () => {
    renderWithProviders(<App />, { path: '/admin' })
    expect(await heading('Admin dashboard')).toBeInTheDocument()
  })

  it('sees a link to the admin area from the member view', async () => {
    renderWithProviders(<App />, { path: '/' })
    expect(await screen.findByRole('link', { name: 'Admin' })).toBeInTheDocument()
  })
})

describe('deactivated account', () => {
  it('is blocked with an explanation', async () => {
    signInAs('member', false)
    renderWithProviders(<App />, { path: '/' })
    expect(await heading('Account deactivated')).toBeInTheDocument()
  })
})
