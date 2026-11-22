import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../../lib/supabase.ts'
import { renderWithProviders } from '../../test/render.tsx'
import { sessionFor, type FakeState } from '../../test/supabase-mock.ts'
import AdminAttendancePage from './AdminAttendancePage.tsx'
import AdminFinesPage from './AdminFinesPage.tsx'

const fake = vi.hoisted((): FakeState => ({ session: null, profile: null, rows: {} }))

vi.mock('../../lib/supabase.ts', async () => {
  const { buildFakeSupabase } = await import('../../test/supabase-mock.ts')
  return { supabase: buildFakeSupabase(fake) }
})

const rpc = vi.mocked(supabase.rpc)

beforeEach(() => {
  vi.clearAllMocks()
  rpc.mockImplementation((async (name: string) => ({
    data: fake.rows[`rpc:${name}`] ?? null,
    error: null,
  })) as never)
  fake.session = sessionFor('admin-1')
  fake.rows = {}
})

describe('AdminFinesPage', () => {
  beforeEach(() => {
    fake.rows.fines = [
      {
        id: 'f1',
        member_id: 'm1',
        amount_npr: 50,
        reason: 'late',
        created_at: '',
        member: { display_name: 'Asha' },
        attendance: { session: { session_date: '2026-11-17' } },
      },
      {
        id: 'f2',
        member_id: 'm1',
        amount_npr: 50,
        reason: 'late',
        created_at: '',
        member: { display_name: 'Asha' },
        attendance: { session: { session_date: '2026-11-19' } },
      },
    ]
  })

  it('records one payment for the ticked fines, with their total', async () => {
    renderWithProviders(<AdminFinesPage />)
    const user = userEvent.setup()
    expect(await screen.findByRole('button', { name: 'Record NPR 100 paid' })).toBeEnabled()

    await user.click(screen.getByRole('checkbox', { name: /Late, Thu, 19 Nov 2026/ }))
    await user.selectOptions(screen.getByLabelText('Method'), 'wallet')
    await user.type(screen.getByLabelText('Note (optional)'), 'eSewa ref 123')
    await user.click(screen.getByRole('button', { name: 'Record NPR 50 paid' }))

    expect(rpc).toHaveBeenCalledWith('admin_record_payment', {
      p_member_id: 'm1',
      p_fine_ids: ['f1'],
      p_method: 'wallet',
      p_note: 'eSewa ref 123',
    })
    expect(await screen.findByText('Payment of NPR 50 recorded for Asha.')).toBeInTheDocument()
  })

  it('cannot record a payment with no fines ticked', async () => {
    renderWithProviders(<AdminFinesPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('checkbox', { name: /17 Nov/ }))
    await user.click(screen.getByRole('checkbox', { name: /19 Nov/ }))
    expect(screen.getByRole('button', { name: 'Record NPR 0 paid' })).toBeDisabled()
  })

  it('waives a fine only with a reason', async () => {
    renderWithProviders(<AdminFinesPage />)
    const user = userEvent.setup()
    await user.click((await screen.findAllByRole('button', { name: 'Waive' }))[0])
    await user.type(screen.getByLabelText(/Reason/), 'Traffic jam, first time')
    await user.click(screen.getByRole('button', { name: 'Waive fine' }))

    expect(rpc).toHaveBeenCalledWith('admin_waive_fine', {
      p_fine_id: 'f1',
      p_reason: 'Traffic jam, first time',
    })
  })

  it('shows the server’s refusal', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: '22023',
        message: 'Every selected fine must be pending and belong to this member.',
      },
    } as never)
    renderWithProviders(<AdminFinesPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Record NPR 100 paid' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('must be pending')
  })
})

describe('AdminAttendancePage', () => {
  beforeEach(() => {
    fake.rows.sessions = [{ id: 's1', session_date: '2026-11-17' }]
    fake.rows.profiles = [
      { id: 'm1', display_name: 'Asha' },
      { id: 'm2', display_name: 'Bikash' },
    ]
    fake.rows.attendance = [
      {
        id: 'a1',
        member_id: 'm1',
        punched_in_at: '2026-11-17T13:35:00Z',
        status: 'late',
        original_status: 'late',
        source: 'gps',
        manual_reason: null,
        distance_m: 41,
        accuracy_m: 9,
        fine: { id: 'f1', amount_npr: 50, status: 'pending' },
      },
    ]
  })

  it('lists every active member with their result', async () => {
    renderWithProviders(<AdminAttendancePage />)
    const items = await screen.findAllByRole('listitem')
    expect(within(items[0]).getByText('Asha')).toBeInTheDocument()
    expect(within(items[0]).getByText(/7:20:00 PM · 41 m away · GPS ±9 m/)).toBeInTheDocument()
    expect(within(items[1]).getByText('Absent')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 have attendance')).toBeInTheDocument()
  })

  it('corrects Late to On time with a reason', async () => {
    renderWithProviders(<AdminAttendancePage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Change to On time' }))
    expect(screen.getByText(/the pending fine will be waived/)).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Reason/), 'Gate was locked')
    await user.click(screen.getByRole('button', { name: 'Save correction' }))

    expect(rpc).toHaveBeenCalledWith('admin_correct_attendance', {
      p_attendance_id: 'a1',
      p_new_status: 'on_time',
      p_reason: 'Gate was locked',
    })
  })

  it('records attendance without GPS for a member with no record', async () => {
    renderWithProviders(<AdminAttendancePage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Record attendance' }))
    const time = screen.getByLabelText('Arrival time (Nepal)')
    await user.clear(time)
    await user.type(time, '19:05')
    await user.type(screen.getByLabelText(/Reason/), 'Phone battery died')
    await user.click(screen.getByRole('button', { name: 'Record attendance' }))

    expect(rpc).toHaveBeenCalledWith('admin_record_attendance', {
      p_member_id: 'm2',
      p_session_id: 's1',
      p_arrived_at: '19:05',
      p_reason: 'Phone battery died',
    })
  })
})
