import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../../lib/supabase.ts'
import { renderWithProviders } from '../../test/render.tsx'
import { sessionFor, type FakeState } from '../../test/supabase-mock.ts'
import AdminReportsPage from './AdminReportsPage.tsx'

const fake = vi.hoisted((): FakeState => ({ session: null, profile: null, rows: {} }))

vi.mock('../../lib/supabase.ts', async () => {
  const { buildFakeSupabase } = await import('../../test/supabase-mock.ts')
  return { supabase: buildFakeSupabase(fake) }
})

const member = (name: string, extra: object) => ({
  member_id: name,
  display_name: name,
  is_active: true,
  sessions: 4,
  on_time: 2,
  late: 1,
  absent: 1,
  attendance_percent: 75,
  fines_npr: 50,
  fines_paid_npr: 0,
  fines_waived_npr: 0,
  fines_outstanding_npr: 50,
  ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  fake.session = sessionFor('admin-1')
  fake.rows = {
    'rpc:admin_attendance_report': [
      member('Asha', { fines_paid_npr: 50, fines_outstanding_npr: 0 }),
      member('=HYPERLINK("http://x")', {}),
    ],
    'rpc:admin_export_payments': [
      { amount_npr: 50, voided_nepal: null },
      { amount_npr: 100, voided_nepal: '2026-11-20 19:00:00' },
    ],
  }
})

describe('AdminReportsPage', () => {
  it('shows team totals; voided payments are not counted as collected', async () => {
    renderWithProviders(<AdminReportsPage />)
    expect(await screen.findByText('75%')).toBeInTheDocument() // 6 of 8
    expect(screen.getByText('6 of 8 member-sessions')).toBeInTheDocument()
    expect(screen.getByText('NPR 100')).toBeInTheDocument() // assigned
    // Collected = 50 (the voided 100 is excluded)
    expect(
      within(screen.getByText('Collected').parentElement!).getByText('NPR 50'),
    ).toBeInTheDocument()
    expect(supabase.rpc).toHaveBeenCalledWith(
      'admin_attendance_report',
      expect.objectContaining({ p_from: expect.stringMatching(/-01$/) }),
    )
  })

  it('downloads a CSV with formulas neutralised', async () => {
    let saved: Blob | undefined
    URL.createObjectURL = vi.fn((blob: Blob) => {
      saved = blob
      return 'blob:test'
    })
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderWithProviders(<AdminReportsPage />)
    const user = userEvent.setup()
    await screen.findByText('Asha')
    await user.click(screen.getByRole('button', { name: 'Report' }))

    expect(click).toHaveBeenCalled()
    const text = await saved!.text()
    expect(text).toContain('Member,Active,Sessions')
    expect(text).toContain('Asha,yes,4,2,1,1,75,50,50,0,0')
    expect(text).toContain(`"'=HYPERLINK(""http://x"")"`)
  })
})
