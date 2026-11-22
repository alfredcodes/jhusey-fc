import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../../lib/supabase.ts'
import { renderWithProviders } from '../../test/render.tsx'
import { sessionFor, type FakeState } from '../../test/supabase-mock.ts'
import HistoryPage from './HistoryPage.tsx'
import type { HistoryRow } from './summary.ts'
import TeamPage from './TeamPage.tsx'

const fake = vi.hoisted((): FakeState => ({ session: null, profile: null, rows: {} }))

vi.mock('../../lib/supabase.ts', async () => {
  const { buildFakeSupabase } = await import('../../test/supabase-mock.ts')
  return { supabase: buildFakeSupabase(fake) }
})

const base = {
  venue_name: 'Dhanyentari Futsal',
  original_status: null,
  source: null,
  punched_in_at: null,
  latitude: null,
  longitude: null,
  accuracy_m: null,
  distance_m: null,
  fine_npr: null,
  fine_status: null,
}

const history: HistoryRow[] = [
  { ...base, session_id: 's3', session_date: '2026-11-20', result: 'absent' },
  {
    ...base,
    session_id: 's2',
    session_date: '2026-11-19',
    result: 'late',
    punched_in_at: '2026-11-19T13:35:00Z', // 7:20:00 PM Nepal
    latitude: 27.72,
    longitude: 85.3408,
    accuracy_m: 9.6,
    distance_m: 41.2,
    fine_npr: 50,
    fine_status: 'pending',
  },
  {
    ...base,
    session_id: 's1',
    session_date: '2026-11-17',
    result: 'on_time',
    punched_in_at: '2026-11-17T13:10:00Z',
    latitude: 27.72,
    longitude: 85.3408,
    accuracy_m: 12,
    distance_m: 30,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  fake.session = sessionFor('member-1')
  fake.rows = {}
})

describe('HistoryPage', () => {
  beforeEach(() => {
    fake.rows['rpc:my_session_history'] = history
    fake.rows.fines = [{ amount_npr: 50, status: 'pending' }]
  })

  it('shows stats calculated from the records', async () => {
    renderWithProviders(<HistoryPage />)
    expect(await screen.findByText('67%')).toBeInTheDocument() // 2 attended of 3
    expect(screen.getByText('2 of 3 sessions')).toBeInTheDocument()
    expect(screen.getByText('1 · 1')).toBeInTheDocument() // late · absent
    expect(screen.getByText('NPR 50')).toBeInTheDocument()
  })

  it('lists each session with its punch-in evidence and fine', async () => {
    renderWithProviders(<HistoryPage />)
    const items = await screen.findAllByRole('listitem')
    expect(items).toHaveLength(3)

    expect(within(items[0]).getByText('Absent')).toBeInTheDocument()
    expect(within(items[0]).queryByText('Punched in')).not.toBeInTheDocument()

    expect(within(items[1]).getByText('Late')).toBeInTheDocument()
    expect(within(items[1]).getByText('7:20:00 PM')).toBeInTheDocument()
    expect(within(items[1]).getByText('41 m')).toBeInTheDocument()
    expect(within(items[1]).getByText('±10 m')).toBeInTheDocument()
    expect(
      within(items[1]).getByRole('link', { name: /Map of punch-in location/ }),
    ).toHaveAttribute('href', expect.stringContaining('mlat=27.72'))
    expect(within(items[1]).getByText(/Late fine NPR 50/)).toBeInTheDocument()

    expect(within(items[2]).getByText('On time')).toBeInTheDocument()
  })
})

describe('TeamPage', () => {
  it('shows names and status for the latest session, and switches sessions', async () => {
    fake.rows.sessions = [
      { id: 's2', session_date: '2026-11-19' },
      { id: 's1', session_date: '2026-11-17' },
    ]
    fake.rows['rpc:team_attendance'] = [
      { display_name: 'Asha', status: 'on_time' },
      { display_name: 'Bikash', status: 'late' },
    ]
    renderWithProviders(<TeamPage />)

    expect(await screen.findByText('Asha')).toBeInTheDocument()
    expect(screen.getByText('2 punched in · 1 on time')).toBeInTheDocument()
    expect(supabase.rpc).toHaveBeenCalledWith('team_attendance', { p_session_id: 's2' })

    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText('Session'), 's1')
    expect(supabase.rpc).toHaveBeenCalledWith('team_attendance', { p_session_id: 's1' })
  })

  it('handles a session nobody punched in for', async () => {
    fake.rows.sessions = [{ id: 's1', session_date: '2026-11-17' }]
    renderWithProviders(<TeamPage />)
    expect(await screen.findByText('Nobody has punched in for this session.')).toBeInTheDocument()
  })
})
