// Role-aware screens: members get read-only views of the same data; admin actions call
// the audited database functions (or the admin-users Edge Function).
import { FunctionsHttpError } from '@supabase/supabase-js'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase.ts'
import { addDays, nepalToday } from '../lib/nepal-time.ts'
import { renderWithProviders } from '../test/render.tsx'
import { sessionFor, type FakeState } from '../test/supabase-mock.ts'
import AttendancePage from './attendance/AttendancePage.tsx'
import FinesPage from './fines/FinesPage.tsx'
import HistoryPage from './history/HistoryPage.tsx'
import MembersPage from './members/MembersPage.tsx'
import FinePayments from './fines/FinePayments.tsx'
import ReportsPage from './reports/ReportsPage.tsx'
import SessionsPage from './sessions/SessionsPage.tsx'
import SettingsPage from './settings/SettingsPage.tsx'

const fake = vi.hoisted((): FakeState => ({ session: null, profile: null, rows: {} }))

vi.mock('../lib/supabase.ts', async () => {
  const { buildFakeSupabase } = await import('../test/supabase-mock.ts')
  return { supabase: buildFakeSupabase(fake) }
})

const today = nepalToday()
const rules = {
  id: true,
  club_name: 'Jhusey FC',
  punch_open: '18:30:00',
  on_time_cutoff: '19:15:00',
  punch_close: '21:00:00',
  late_fine_npr: 50,
  absence_fine_npr: 100,
  absence_fines_from: today,
  regular_fee_npr: 800,
  partial_fee_npr: 400,
  fee_due_days: 16,
  fine_due_days: null,
  updated_at: '',
  updated_by: null,
}

function as(role: 'admin' | 'member') {
  fake.session = sessionFor(role === 'admin' ? 'admin-1' : 'm-asha')
  fake.profile = {
    id: role === 'admin' ? 'admin-1' : 'm-asha',
    display_name: role === 'admin' ? 'Babu' : 'Asha',
    role,
    is_active: true,
  }
}

const rosterRow = (name: string, extra: object) => ({
  member_id: `m-${name.toLowerCase()}`,
  display_name: name,
  is_active: true,
  attendance_id: null,
  punched_in_at: null,
  result: 'absent',
  original_status: null,
  source: null,
  distance_m: null,
  accuracy_m: null,
  excuse_source: null,
  excuse_note: null,
  fine_id: null,
  fine_reason: null,
  fine_amount_npr: null,
  fine_status: null,
  ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  fake.rows = { club_settings: [rules] }
})

// ---------------------------------------------------------------------------
describe('Attendance Record', () => {
  beforeEach(() => {
    fake.rows.sessions = [
      { id: 's1', session_date: addDays(today, -1), status: 'scheduled', venue: { name: 'Court' } },
    ]
    fake.rows['rpc:session_roster'] = [
      rosterRow('Asha', {
        attendance_id: 'a1',
        punched_in_at: `${addDays(today, -1)}T13:35:00Z`, // 7:20 PM Nepal
        result: 'late',
        original_status: 'late',
        source: 'gps',
        distance_m: 40,
        accuracy_m: 12,
        fine_id: 'f1',
        fine_reason: 'late',
        fine_amount_npr: 50,
        fine_status: 'pending',
      }),
      rosterRow('Bikash', {
        fine_id: 'f2',
        fine_reason: 'absence',
        fine_amount_npr: 100,
        fine_status: 'pending',
      }),
      rosterRow('Chandra', { result: 'excused', excuse_source: 'member' }),
    ]
  })

  it('members see everyone’s result and fines but no admin actions', async () => {
    as('member')
    renderWithProviders(<AttendancePage />)
    expect(await screen.findByText('Bikash')).toBeInTheDocument()
    expect(screen.getByText(/7:20 PM \(\+5 min\)/)).toBeInTheDocument()
    expect(screen.getAllByText('Absent fine (Rs. 100)').length).toBeGreaterThan(0)
    expect(
      within(screen.getByText('Chandra').closest('tr')!).getByText('Excused'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Override' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Excuse' })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument()
  })

  it('the admin corrects Late to On time with a reason', async () => {
    as('admin')
    renderWithProviders(<AttendancePage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Override' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Reason/), 'Clock at the court was wrong')
    await user.click(within(dialog).getByRole('button', { name: 'Save correction' }))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_correct_attendance', {
      p_attendance_id: 'a1',
      p_new_status: 'on_time',
      p_reason: 'Clock at the court was wrong',
    })
  })

  it('the admin excuses an absence', async () => {
    as('admin')
    renderWithProviders(<AttendancePage />)
    const user = userEvent.setup()
    const row = (await screen.findByText('Bikash')).closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'Excuse' }))
    await user.type(within(screen.getByRole('dialog')).getByLabelText(/Reason/), 'Was ill')
    await user.click(screen.getByRole('button', { name: 'Excuse absence' }))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_excuse_absence', {
      p_member_id: 'm-bikash',
      p_session_id: 's1',
      p_reason: 'Was ill',
    })
  })
})

// ---------------------------------------------------------------------------
describe('Fines', () => {
  const fine = (
    id: string,
    name: string,
    reason: string,
    amount: number,
    status: string,
    due_on: string | null = null,
  ) => ({
    id,
    member_id: `m-${name.toLowerCase()}`,
    reason,
    amount_npr: amount,
    status,
    due_on,
    created_at: '2026-11-20T15:00:00Z',
    payment_id: null,
    member: { display_name: name },
    session: { id: 's1', session_date: '2026-11-20' },
  })

  beforeEach(() => {
    fake.rows.fines = [
      fine('f1', 'Asha', 'late', 50, 'pending'),
      fine('f2', 'Asha', 'absence', 100, 'pending'),
      fine('f3', 'Bikash', 'late', 50, 'paid'),
    ]
  })

  it('an unpaid fine past its due date shows as Overdue; one still in time shows its due date', async () => {
    as('member')
    fake.rows.fines = [
      fine('f1', 'Asha', 'late', 50, 'pending', addDays(today, -1)),
      fine('f2', 'Bikash', 'late', 50, 'pending', addDays(today, 3)),
      fine('f3', 'Chirag', 'late', 50, 'paid', addDays(today, -5)),
    ]
    renderWithProviders(<FinesPage />)
    const table = await screen.findByRole('table')
    expect(within(table).getAllByText('Overdue')).toHaveLength(1)
    expect(within(table).getAllByText(/^Due /)).toHaveLength(2) // both unpaid fines show their due date
    expect(within(table).getByText('Paid')).toBeInTheDocument()
  })

  it('members see the whole team’s fines, read-only', async () => {
    as('member')
    renderWithProviders(<FinesPage />)
    expect(await screen.findByText('Bikash')).toBeInTheDocument()
    expect(screen.getByText('2 pending settlement')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Record payment/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark paid' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Waive' })).not.toBeInTheDocument()
  })

  it('the admin marks a fine paid: one payment for the ticked whole fines', async () => {
    as('admin')
    renderWithProviders(<FinesPage />)
    const user = userEvent.setup()
    const row = (await screen.findAllByText('Asha'))[0].closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'Mark paid' }))
    const dialog = screen.getByRole('dialog')
    // Only the clicked fine is ticked; the total follows the ticks.
    await user.click(await within(dialog).findByRole('button', { name: /Record Rs\. 50 paid/ }))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_record_payment', {
      p_member_id: 'm-asha',
      p_fine_ids: ['f1'],
      p_method: 'cash',
      p_note: '',
    })
  })

  it('waiving needs a reason', async () => {
    as('admin')
    renderWithProviders(<FinesPage />)
    const user = userEvent.setup()
    await user.click((await screen.findAllByRole('button', { name: 'Waive' }))[0])
    await user.click(screen.getByRole('button', { name: 'Waive fine' }))
    expect(supabase.rpc).not.toHaveBeenCalledWith('admin_waive_fine', expect.anything())
    await user.type(screen.getByLabelText(/Reason/), 'First week')
    await user.click(screen.getByRole('button', { name: 'Waive fine' }))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_waive_fine', {
      p_fine_id: 'f1',
      p_reason: 'First week',
    })
  })
})

// ---------------------------------------------------------------------------
describe('Fine payments', () => {
  beforeEach(() => {
    fake.rows['rpc:team_payments'] = [
      {
        payment_id: 'p1',
        member_id: 'm-asha',
        display_name: 'Asha',
        amount_npr: 150,
        method: 'cash',
        created_at: '2026-11-20T15:00:00Z',
        voided: false,
        fines_count: 2,
      },
      {
        payment_id: 'p2',
        member_id: 'm-b',
        display_name: 'Bikash',
        amount_npr: 50,
        method: 'wallet',
        created_at: '2026-11-19T15:00:00Z',
        voided: true,
        fines_count: 0,
      },
    ]
  })

  it('members see who paid what; voided payments are not counted', async () => {
    as('member')
    renderWithProviders(<FinePayments />)
    expect(await screen.findByText('Bikash')).toBeInTheDocument()
    expect(screen.getAllByText('Rs. 150').length).toBeGreaterThan(0)
    expect(screen.getByText('Voided')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Void' })).not.toBeInTheDocument()
    expect(supabase.from).not.toHaveBeenCalledWith('payments') // notes are admin-only
  })

  it('the admin voids a payment with a reason', async () => {
    as('admin')
    renderWithProviders(<FinePayments />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Void' }))
    await user.type(screen.getByLabelText(/Reason/), 'Entered twice')
    await user.click(screen.getByRole('button', { name: 'Void payment' }))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_void_payment', {
      p_payment_id: 'p1',
      p_reason: 'Entered twice',
    })
  })
})

// ---------------------------------------------------------------------------
describe('Members', () => {
  beforeEach(() => {
    fake.rows.profiles = [
      {
        id: 'admin-1',
        display_name: 'Babu',
        role: 'admin',
        is_active: true,
        created_at: '2026-11-01T00:00:00Z',
      },
      {
        id: 'm-asha',
        display_name: 'Asha',
        role: 'member',
        is_active: true,
        created_at: '2026-11-01T00:00:00Z',
      },
    ]
    fake.rows['rpc:admin_member_accounts'] = [
      {
        member_id: 'm-asha',
        email: 'asha@example.com',
        phone: '+977 9800000000',
        must_change_password: false,
        last_sign_in_at: null,
      },
    ]
  })

  it('shows the four member counts and filters: All by default, then Active, Partial, Inactive', async () => {
    as('member')
    fake.rows.profiles = [
      ...(fake.rows.profiles as object[]),
      {
        id: 'm-dip',
        display_name: 'Dip',
        role: 'member',
        is_active: true,
        fee_plan: 'partial',
        created_at: '2026-11-01T00:00:00Z',
      },
      {
        id: 'm-old',
        display_name: 'Oldie',
        role: 'member',
        is_active: false,
        fee_plan: 'regular',
        created_at: '2026-11-01T00:00:00Z',
      },
    ]
    renderWithProviders(<MembersPage />)
    const table = await screen.findByRole('table')
    expect(within(table).getByText('Oldie')).toBeInTheDocument() // All shows inactive too
    const card = (label: string) => screen.getByText(label).closest('div')!.parentElement!
    expect(within(card('Total members')).getByText('4')).toBeInTheDocument()
    expect(within(card('Active members')).getByText('3')).toBeInTheDocument()
    expect(within(card('Partial members')).getByText('1')).toBeInTheDocument()
    expect(within(card('Inactive members')).getByText('1')).toBeInTheDocument()

    const user = userEvent.setup()
    const show = screen.getByLabelText('Show')
    await user.selectOptions(show, 'partial')
    expect(within(table).getByText('Dip')).toBeInTheDocument()
    expect(within(table).queryByText('Asha')).not.toBeInTheDocument()
    await user.selectOptions(show, 'inactive')
    expect(within(table).getByText('Oldie')).toBeInTheDocument()
    expect(within(table).queryByText('Dip')).not.toBeInTheDocument()
    await user.selectOptions(show, 'active')
    expect(within(table).queryByText('Oldie')).not.toBeInTheDocument()
  })

  it('members see the roster without emails, phones or account controls', async () => {
    as('member')
    renderWithProviders(<MembersPage />)
    expect(await screen.findByText('Asha')).toBeInTheDocument()
    expect(screen.queryByText('asha@example.com')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add member/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset password' })).not.toBeInTheDocument()
    expect(supabase.rpc).not.toHaveBeenCalledWith('admin_member_accounts')
  })

  it('the admin creates a member and sees the initial password once', async () => {
    as('admin')
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { member_id: 'new-1', email: 'dip@members.jhusey-fc.invalid' },
      error: null,
    } as never)
    renderWithProviders(<MembersPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Add member/ }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Full name'), 'Dip Shrestha')
    await user.type(within(dialog).getByLabelText(/Username/), 'dip')
    const password = within(dialog).getByLabelText('Initial password')
    await user.clear(password)
    await user.type(password, 'Kick-off-2026')
    await user.click(within(dialog).getByRole('button', { name: 'Create member' }))

    expect(supabase.functions.invoke).toHaveBeenCalledWith('admin-users', {
      body: {
        action: 'create',
        display_name: 'Dip Shrestha',
        username: 'dip',
        phone: '',
        password: 'Kick-off-2026',
      },
    })
    expect(await screen.findByText('Share this login with Dip Shrestha')).toBeInTheDocument()
    expect(screen.getByText('Kick-off-2026')).toBeInTheDocument()
    expect(screen.getByText('dip')).toBeInTheDocument() // the username, not the stored email
    expect(screen.getByText(/shown only now/)).toBeInTheDocument()
  })

  it('shows the function’s explanation when creation is refused', async () => {
    as('admin')
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(
        new Response(JSON.stringify({ error: 'That username is already taken.' }), {
          status: 409,
        }),
      ),
    } as never)
    renderWithProviders(<MembersPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Add member/ }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Full name'), 'Asha Again')
    await user.type(within(dialog).getByLabelText(/Username/), 'asha')
    await user.click(within(dialog).getByRole('button', { name: 'Create member' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'That username is already taken.',
    )
  })

  it('the admin sets a temporary password for a member', async () => {
    as('admin')
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { member_id: 'm-asha' },
      error: null,
    } as never)
    renderWithProviders(<MembersPage />)
    const user = userEvent.setup()
    expect(await screen.findByText('asha@example.com')).toBeInTheDocument()
    const row = screen.getByText('asha@example.com').closest('tr')!
    await user.click(within(row).getByRole('button', { name: 'Reset password' }))
    await user.click(screen.getByRole('button', { name: 'Set temporary password' }))
    expect(supabase.functions.invoke).toHaveBeenCalledWith('admin-users', {
      body: { action: 'reset_password', member_id: 'm-asha', password: expect.any(String) },
    })
    expect(await screen.findByText('Temporary password set')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
describe('Reports', () => {
  const member = (name: string, extra: object) => ({
    member_id: name,
    display_name: name,
    is_active: true,
    sessions: 4,
    on_time: 2,
    late: 1,
    absent: 1,
    excused: 0,
    attendance_percent: 75,
    late_fines_npr: 50,
    absence_fines_npr: 100,
    fines_npr: 150,
    fines_paid_npr: 0,
    fines_waived_npr: 0,
    fines_outstanding_npr: 150,
    ...extra,
  })

  beforeEach(() => {
    fake.rows['rpc:team_report'] = [
      member('Asha', { fines_paid_npr: 150, fines_outstanding_npr: 0 }),
      member('=HYPERLINK("x")', {}),
    ]
    fake.rows['rpc:team_payments'] = [
      { payment_id: 'p1', amount_npr: 150, voided: false },
      { payment_id: 'p2', amount_npr: 500, voided: true },
    ]
  })

  it('members read the team totals; voided payments are not collected', async () => {
    as('member')
    renderWithProviders(<ReportsPage />)
    const attendance = (await screen.findByText('Team attendance')).closest('div')!.parentElement!
    expect(await within(attendance).findByText('75%')).toBeInTheDocument()
    expect(screen.getByText('6 of 8 member-sessions')).toBeInTheDocument()
    const collected = screen.getByText('Collected').closest('div')!.parentElement!
    expect(within(collected).getByText('Rs. 150')).toBeInTheDocument()
    expect(supabase.rpc).toHaveBeenCalledWith(
      'team_report',
      expect.objectContaining({ p_from: expect.stringMatching(/-01$/) }),
    )
    // GPS and payment-note backups stay admin-only.
    expect(screen.queryByRole('button', { name: /Attendance \+ GPS/ })).not.toBeInTheDocument()
  })

  it('exports the team report as CSV with formulas neutralised', async () => {
    as('member')
    let saved: Blob | undefined
    URL.createObjectURL = vi.fn((blob: Blob) => {
      saved = blob
      return 'blob:test'
    })
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderWithProviders(<ReportsPage />)
    const user = userEvent.setup()
    await screen.findAllByText('Asha')
    await user.click(screen.getByRole('button', { name: 'Team report' }))
    expect(click).toHaveBeenCalled()
    const text = await saved!.text()
    expect(text).toContain('Member,Active,Sessions,On time,Late,Absent,Excused')
    expect(text).toContain(`"'=HYPERLINK(""x"")"`)
  })

  it('the admin also gets the backup exports', async () => {
    as('admin')
    renderWithProviders(<ReportsPage />)
    expect(await screen.findByRole('button', { name: /Attendance \+ GPS/ })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
describe('Futsal Games', () => {
  beforeEach(() => {
    // Two days ahead, so "Can't come" is open whatever time the tests run (deadline 9 PM the day before).
    fake.rows.sessions = [
      {
        id: 's-next',
        session_date: addDays(today, 2),
        status: 'scheduled',
        note: null,
        venue: { id: 'v1', name: 'Court' },
      },
    ]
    fake.rows.absence_excuses = []
  })

  it('a member tells the team they cannot come', async () => {
    as('member')
    renderWithProviders(<SessionsPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Can’t come' }))
    await user.type(screen.getByLabelText(/Note/), 'Work trip')
    await user.click(screen.getByRole('button', { name: 'Send notice' }))
    expect(supabase.rpc).toHaveBeenCalledWith('notify_absence', {
      p_session_id: 's-next',
      p_note: 'Work trip',
    })
    expect(screen.queryByRole('button', { name: 'Create games' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })

  it('shows an existing notice with a way to withdraw it', async () => {
    as('member')
    fake.rows.absence_excuses = [
      { id: 'e1', session_id: 's-next', source: 'member', created_at: '' },
    ]
    renderWithProviders(<SessionsPage />)
    expect(await screen.findByText('You can’t come'.replace('’', "'"))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'I can come' })).toBeInTheDocument()
  })

  it('shows who is not coming to the next game', async () => {
    as('member')
    fake.rows.absence_excuses = [
      {
        id: 'e1',
        session_id: 's-next',
        member_id: 'm-b',
        source: 'member',
        created_at: '',
        member: { display_name: 'Bikash' },
      },
      {
        id: 'e2',
        session_id: 's-next',
        member_id: 'm-c',
        source: 'admin',
        created_at: '',
        member: { display_name: 'Chirag' },
      },
    ]
    renderWithProviders(<SessionsPage />)
    expect(await screen.findByRole('heading', { name: 'Futsal Games' })).toBeInTheDocument()
    expect(await screen.findByText('2 not coming')).toBeInTheDocument()
    expect(screen.getAllByText('Bikash').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Chirag').length).toBeGreaterThan(0)
    expect(screen.getByText(/before 9 PM on/)).toBeInTheDocument()
  })

  it('the admin must choose a weekday before creating games', async () => {
    as('admin')
    fake.rows.venues = [{ id: 'v1', name: 'Court', is_active: true }]
    renderWithProviders(<SessionsPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Create games/ }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Create games' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Choose at least one weekday.')
    await user.click(within(dialog).getByText('Sun'))
    await user.click(within(dialog).getByRole('button', { name: 'Create games' }))
    expect(supabase.rpc).toHaveBeenCalledWith(
      'admin_create_sessions',
      expect.objectContaining({ p_weekdays: [0] }),
    )
  })
})

// ---------------------------------------------------------------------------
describe('My Record', () => {
  it('shows excused sessions and absence fines', async () => {
    as('member')
    fake.rows['rpc:my_session_history'] = [
      {
        session_id: 'h1',
        session_date: '2026-11-20',
        venue_name: 'Court',
        result: 'absent',
        original_status: null,
        source: null,
        punched_in_at: null,
        latitude: null,
        longitude: null,
        accuracy_m: null,
        distance_m: null,
        fine_npr: 100,
        fine_status: 'pending',
        fine_reason: 'absence',
      },
      {
        session_id: 'h2',
        session_date: '2026-11-18',
        venue_name: 'Court',
        result: 'excused',
        original_status: null,
        source: null,
        punched_in_at: null,
        latitude: null,
        longitude: null,
        accuracy_m: null,
        distance_m: null,
        fine_npr: null,
        fine_status: null,
        fine_reason: null,
      },
    ]
    fake.rows.fines = [{ amount_npr: 100, status: 'pending' }]
    renderWithProviders(<HistoryPage />)
    expect(await screen.findByText('Absent fine (Rs. 100)')).toBeInTheDocument()
    expect(screen.getByText('Excused')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
describe('Settings → Rules (admin)', () => {
  it('saves the rules with whole-second times', async () => {
    as('admin')
    renderWithProviders(<SettingsPage />, { path: '/settings?tab=rules' })
    const user = userEvent.setup()
    const fineInput = await screen.findByLabelText('Late arrival fine (Rs.)')
    await user.clear(fineInput)
    await user.type(fineInput, '75')
    await user.click(screen.getByRole('button', { name: 'Save rules' }))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_update_rules', {
      p_club_name: 'Jhusey FC',
      p_punch_open: '18:30:00',
      p_on_time_cutoff: '19:15:00',
      p_punch_close: '21:00:00',
      p_late_fine_npr: 75,
      p_absence_fine_npr: 100,
      p_absence_fines_from: today,
    })
  })

  it('saves fee amounts and payment deadlines; an empty fine deadline means none', async () => {
    as('admin')
    renderWithProviders(<SettingsPage />, { path: '/settings?tab=rules' })
    const user = userEvent.setup()
    const feeDays = await screen.findByLabelText(/Monthly fee due within/)
    expect(feeDays).toHaveValue(16)
    await user.clear(feeDays)
    await user.type(feeDays, '10')
    expect(screen.getByLabelText(/Pay fines within/)).toHaveValue(null)
    await user.click(screen.getByRole('button', { name: 'Save payment settings' }))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_update_payment_settings', {
      p_regular_npr: 800,
      p_partial_npr: 400,
      p_fee_due_days: 10,
      p_fine_due_days: null,
    })
  })
})
