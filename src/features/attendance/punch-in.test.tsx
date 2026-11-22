import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../../lib/supabase.ts'
import { addDays, nepalToday } from '../../lib/nepal-time.ts'
import MemberHomePage from '../../pages/MemberHomePage.tsx'
import { renderWithProviders } from '../../test/render.tsx'
import { sessionFor, type FakeState } from '../../test/supabase-mock.ts'
import PunchInCard from './PunchInCard.tsx'

const fake = vi.hoisted((): FakeState => ({ session: null, profile: null, rows: {} }))

vi.mock('../../lib/supabase.ts', async () => {
  const { buildFakeSupabase } = await import('../../test/supabase-mock.ts')
  return { supabase: buildFakeSupabase(fake) }
})

const getCurrentPosition = vi.fn()

function gpsReturns(latitude: number, longitude: number, accuracy: number) {
  getCurrentPosition.mockImplementation((success: PositionCallback) =>
    success({ coords: { latitude, longitude, accuracy } } as GeolocationPosition),
  )
}

function gpsFails(code: number) {
  getCurrentPosition.mockImplementation((_: PositionCallback, failure: PositionErrorCallback) =>
    failure({ code } as GeolocationPositionError),
  )
}

const lateRecord = {
  id: 'att-1',
  punched_in_at: '2026-11-22T13:32:05Z', // 7:17:05 PM in Kathmandu
  status: 'late',
  distance_m: 38.4,
  accuracy_m: 12.2,
  fine: { amount_npr: 50, status: 'pending' },
}

beforeEach(() => {
  vi.clearAllMocks()
  fake.session = sessionFor('member-1')
  fake.rows = {}
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  })
  Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
})

describe('PunchInCard', () => {
  it('reads the location once and sends only coordinates and accuracy', async () => {
    gpsReturns(27.72, 85.3408, 12.2)
    vi.mocked(supabase.rpc).mockImplementation((async () => {
      fake.rows.attendance = [lateRecord] // what the server stored
      return { data: {}, error: null }
    }) as never)
    renderWithProviders(<PunchInCard sessionId="s1" venueName="Dhanyentari Futsal" />)

    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Punch In' }))

    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(getCurrentPosition.mock.calls[0][2]).toMatchObject({
      enableHighAccuracy: true,
      maximumAge: 0,
    })
    expect(supabase.rpc).toHaveBeenCalledWith('punch_in', {
      p_latitude: 27.72,
      p_longitude: 85.3408,
      p_accuracy_m: 12.2,
    })
    // Result shown is the server's record, including its time and fine.
    expect(await screen.findByText('You’re punched in')).toBeInTheDocument()
    expect(screen.getByText('7:17:05 PM')).toBeInTheDocument()
    expect(screen.getByText('Late')).toBeInTheDocument()
    expect(screen.getByText('NPR 50')).toBeInTheDocument()
  })

  it('explains a blocked location permission and does not call the server', async () => {
    gpsFails(1)
    renderWithProviders(<PunchInCard sessionId="s1" venueName="Dhanyentari Futsal" />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Punch In' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Location permission is blocked')
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Punch In' })).toBeEnabled()
  })

  it('explains a GPS timeout', async () => {
    gpsFails(3)
    renderWithProviders(<PunchInCard sessionId="s1" venueName="Dhanyentari Futsal" />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Punch In' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('took too long')
  })

  it('shows the server’s reason when the punch-in is refused', async () => {
    gpsReturns(27.721, 85.3408, 10)
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: null,
      error: {
        code: '22023',
        message: 'You are 133 m from Dhanyentari Futsal. Punch in within 100 m of the venue.',
      },
    } as never)
    renderWithProviders(<PunchInCard sessionId="s1" venueName="Dhanyentari Futsal" />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Punch In' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('You are 133 m from Dhanyentari')
  })

  it('shows an existing punch-in instead of the button', async () => {
    fake.rows.attendance = [{ ...lateRecord, status: 'on_time', fine: null }]
    renderWithProviders(<PunchInCard sessionId="s1" venueName="Dhanyentari Futsal" />)

    expect(await screen.findByText('On time')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Punch In' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Late fine/)).not.toBeInTheDocument()
  })
})

describe('MemberHomePage', () => {
  const session = (days: number) => ({
    id: `s${days}`,
    session_date: addDays(nepalToday(), days),
    status: 'scheduled',
    note: null,
    venue: { id: 'v1', name: 'Dhanyentari Futsal' },
  })

  it('shows the Punch In card on a session day', async () => {
    fake.rows.sessions = [session(0)]
    renderWithProviders(<MemberHomePage />)
    expect(await screen.findByRole('button', { name: 'Punch In' })).toBeInTheDocument()
  })

  it('hides it when there is no session today', async () => {
    fake.rows.sessions = [session(2)]
    renderWithProviders(<MemberHomePage />)
    expect(await screen.findByText('Next session')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Punch In' })).not.toBeInTheDocument()
  })
})
