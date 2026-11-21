import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../../lib/supabase.ts'
import { addDays, nepalToday } from '../../lib/nepal-time.ts'
import { renderWithProviders } from '../../test/render.tsx'
import { sessionFor, type FakeState } from '../../test/supabase-mock.ts'
import AdminSessionsPage from './AdminSessionsPage.tsx'
import AdminVenuesPage from './AdminVenuesPage.tsx'
import NextSessionCard from './NextSessionCard.tsx'

const fake = vi.hoisted((): FakeState => ({ session: null, profile: null, rows: {} }))

vi.mock('../../lib/supabase.ts', async () => {
  const { buildFakeSupabase } = await import('../../test/supabase-mock.ts')
  return { supabase: buildFakeSupabase(fake) }
})

const venue = {
  id: 'v1',
  name: 'Main Court',
  latitude: 27.7172,
  longitude: 85.324,
  geofence_radius_m: 100,
  is_active: true,
  created_at: '',
  updated_at: '',
}

function session(id: string, daysFromToday: number, status: 'scheduled' | 'cancelled') {
  return {
    id,
    session_date: addDays(nepalToday(), daysFromToday),
    status,
    note: null,
    venue: { id: 'v1', name: 'Main Court' },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  fake.session = sessionFor('admin-1')
  fake.rows = {}
})

describe('NextSessionCard', () => {
  it('shows the next scheduled session, skipping cancelled ones', async () => {
    fake.rows.sessions = [session('s1', 0, 'cancelled'), session('s2', 2, 'scheduled')]
    renderWithProviders(<NextSessionCard />)

    expect(await screen.findByText('Next session')).toBeInTheDocument()
    expect(screen.getAllByText('Main Court')[0]).toBeInTheDocument()
    expect(screen.getByText(/Punch in by/)).toHaveTextContent('Punch in by 7:15 PM')
    expect(screen.getByText('Cancelled')).toBeInTheDocument()
  })

  it('says when today has a session', async () => {
    fake.rows.sessions = [session('s1', 0, 'scheduled')]
    renderWithProviders(<NextSessionCard />)
    expect(await screen.findByText('Today’s session')).toBeInTheDocument()
  })

  it('handles an empty calendar', async () => {
    renderWithProviders(<NextSessionCard />)
    expect(await screen.findByText('No sessions scheduled yet.')).toBeInTheDocument()
  })
})

describe('AdminSessionsPage', () => {
  it('asks for a venue first when there is none', async () => {
    renderWithProviders(<AdminSessionsPage />)
    expect(await screen.findByText(/Add a venue before creating sessions/)).toBeInTheDocument()
  })

  it('requires at least one weekday before calling the server', async () => {
    fake.rows.venues = [venue]
    renderWithProviders(<AdminSessionsPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Create sessions' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Choose at least one weekday.')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('sends the chosen weekdays and reports how many were created', async () => {
    fake.rows.venues = [venue]
    vi.mocked(supabase.rpc).mockResolvedValue({ data: 16, error: null } as never)
    renderWithProviders(<AdminSessionsPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('checkbox', { name: 'Fri' }))
    await user.click(screen.getByRole('checkbox', { name: 'Sun' }))
    await user.click(screen.getByRole('button', { name: 'Create sessions' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Created 16 sessions.')
    expect(supabase.rpc).toHaveBeenCalledWith('admin_create_sessions', {
      p_venue_id: 'v1',
      p_from: nepalToday(),
      p_to: addDays(nepalToday(), 55),
      p_weekdays: [0, 5],
    })
  })

  it('shows the server’s explanation when it refuses', async () => {
    fake.rows.venues = [venue]
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: { code: '22023', message: 'Sessions cannot start in the past.' },
    } as never)
    renderWithProviders(<AdminSessionsPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('checkbox', { name: 'Mon' }))
    await user.click(screen.getByRole('button', { name: 'Create sessions' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Sessions cannot start in the past.')
  })
})

describe('AdminVenuesPage', () => {
  it('rejects coordinates it cannot read', async () => {
    renderWithProviders(<AdminVenuesPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Add venue' }))
    await user.type(screen.getByLabelText('Name'), 'Main Court')
    await user.type(screen.getByLabelText('Coordinates'), 'near the temple')
    await user.click(screen.getByRole('button', { name: 'Save venue' }))

    expect(screen.getByRole('alert')).toHaveTextContent('Could not read the coordinates')
    expect(supabase.from).not.toHaveBeenCalledWith('venues', expect.anything())
  })

  it('lists venues with their radius and a map link', async () => {
    fake.rows.venues = [venue]
    renderWithProviders(<AdminVenuesPage />)
    expect(await screen.findByText(/Punch-in radius: 100 m/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Check on map' })).toHaveAttribute(
      'href',
      expect.stringContaining('mlat=27.7172'),
    )
  })
})
