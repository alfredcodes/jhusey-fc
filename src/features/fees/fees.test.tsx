// Monthly fees screen: the team reads the ledger; admin actions call audited database functions.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../../lib/supabase.ts'
import { nepalToday } from '../../lib/nepal-time.ts'
import { renderWithProviders } from '../../test/render.tsx'
import { sessionFor, type FakeState } from '../../test/supabase-mock.ts'
import FeesPage from './FeesPage.tsx'

const fake = vi.hoisted((): FakeState => ({ session: null, profile: null, rows: {} }))

vi.mock('../../lib/supabase.ts', async () => {
  const { buildFakeSupabase } = await import('../../test/supabase-mock.ts')
  return { supabase: buildFakeSupabase(fake) }
})

const month = nepalToday().slice(0, 7)

function as(role: 'admin' | 'member') {
  fake.session = sessionFor(role === 'admin' ? 'admin-1' : 'm-asha')
  fake.profile = {
    id: role === 'admin' ? 'admin-1' : 'm-asha',
    display_name: role === 'admin' ? 'Babu' : 'Asha',
    role,
    is_active: true,
    fee_plan: 'regular',
  }
}

const fee = (name: string, extra: object) => ({
  member_fee_id: `f-${name}`,
  member_id: `m-${name}`,
  display_name: name,
  is_active: true,
  plan: 'regular',
  amount_npr: 800,
  paid_npr: 0,
  balance_npr: 800,
  status: 'due',
  exempt_reason: null,
  due_on: `${month}-17`,
  last_paid_on: null,
  ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  fake.rows = {
    club_settings: [{ regular_fee_npr: 800, partial_fee_npr: 400 }],
    fee_periods: [{ month: `${month}-01`, opened_on: `${month}-01`, due_on: `${month}-17` }],
    'rpc:fee_ledger': [
      fee('Asha', { paid_npr: 800, balance_npr: 0, status: 'paid', last_paid_on: `${month}-02` }),
      fee('Bikash', {
        plan: 'partial',
        amount_npr: 400,
        paid_npr: 150,
        balance_npr: 250,
        status: 'partial',
      }),
      fee('Chirag', { balance_npr: 0, status: 'exempt', exempt_reason: 'Injured knee' }),
    ],
  }
})

describe('Monthly Fees', () => {
  it('members see the whole ledger, instalments and exemption reasons, read-only', async () => {
    as('member')
    renderWithProviders(<FeesPage />)
    expect(await screen.findByText('Bikash')).toBeInTheDocument()
    const table = screen.getByRole('table', { name: /Monthly fees for/ })
    expect(within(table).getByText('Part paid')).toBeInTheDocument()
    expect(screen.getByText('Injured knee')).toBeInTheDocument()
    expect(screen.getByText('Monthly membership (Partial)')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Open month|Add new members/ }),
    ).not.toBeInTheDocument()
    expect(supabase.rpc).not.toHaveBeenCalledWith('admin_fee_payment_notes', expect.anything())
  })

  it('the admin records an instalment', async () => {
    as('admin')
    renderWithProviders(<FeesPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Record' }))
    const amount = screen.getByLabelText('Amount (NPR)')
    expect(amount).toHaveValue(250) // defaults to the balance
    await user.clear(amount)
    await user.type(amount, '100')
    await user.click(screen.getByRole('button', { name: 'Record Rs. 100' }))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_record_fee_payment', {
      p_member_fee_id: 'f-Bikash',
      p_amount_npr: 100,
      p_method: 'cash',
      p_paid_on: nepalToday(),
      p_note: '',
    })
  })

  it('the admin opens a month that is not open yet', async () => {
    as('admin')
    fake.rows.fee_periods = []
    fake.rows['rpc:fee_ledger'] = []
    renderWithProviders(<FeesPage />)
    expect(await screen.findByText(/is not open yet/)).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Open month' }))
    await user.click(screen.getAllByRole('button', { name: 'Open month' }).at(-1)!)
    expect(supabase.rpc).toHaveBeenCalledWith('admin_open_fee_month', {
      p_month: `${month}-01`,
      p_opened_on: nepalToday(),
    })
  })
})

describe('Monthly payment submission', () => {
  // Asha (the signed-in member) still owes NPR 800 this month.
  const owing = () => {
    fake.rows['rpc:fee_ledger'] = [
      { ...fee('Asha', {}), member_id: 'm-asha', member_fee_id: 'f-asha' },
    ]
  }
  const submission = (status: string, extra: object = {}) => ({
    id: `s-${status}`,
    member_fee_id: 'f-asha',
    member_id: 'm-asha',
    amount_npr: 800,
    method: 'cash',
    proof_path: null,
    status,
    created_at: '2026-11-20T10:00:00Z',
    reviewed_at: status === 'pending' ? null : '2026-11-21T10:00:00Z',
    review_note: null,
    fee: { month: `${month}-01` },
    member: { display_name: 'Asha' },
    ...extra,
  })

  it('a member submits a cash payment for the admin to approve', async () => {
    as('member')
    owing()
    renderWithProviders(<FeesPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Submit payment/ }))
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByLabelText(/^Cash/))
    expect(within(dialog).queryByLabelText(/Screenshot or receipt/)).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Submit Rs. 800' }))
    expect(supabase.storage.from).not.toHaveBeenCalled()
    expect(supabase.rpc).toHaveBeenCalledWith('submit_fee_payment', {
      p_member_fee_id: 'f-asha',
      p_amount_npr: 800,
      p_method: 'cash',
      p_proof_path: null,
    })
  })

  it('an online payment uploads the receipt to the member’s own folder first', async () => {
    as('member')
    owing()
    renderWithProviders(<FeesPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Submit payment/ }))
    const dialog = screen.getByRole('dialog')
    const big = new File([new Uint8Array(3 * 1024 * 1024)], 'big.png', { type: 'image/png' })
    await user.upload(within(dialog).getByLabelText(/Screenshot or receipt/), big)
    await user.click(within(dialog).getByRole('button', { name: 'Submit Rs. 800' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('larger than 2 MB')
    expect(supabase.rpc).not.toHaveBeenCalledWith('submit_fee_payment', expect.anything())

    const receipt = new File(['png'], 'esewa.png', { type: 'image/png' })
    await user.upload(within(dialog).getByLabelText(/Screenshot or receipt/), receipt)
    await user.click(within(dialog).getByRole('button', { name: 'Submit Rs. 800' }))
    const bucket = vi.mocked(supabase.storage.from).mock.results[0].value
    expect(supabase.storage.from).toHaveBeenCalledWith('payment-proofs')
    const path = bucket.upload.mock.calls[0][0] as string
    expect(path).toMatch(/^m-asha\/f-asha-\d+\.png$/)
    expect(supabase.rpc).toHaveBeenCalledWith('submit_fee_payment', {
      p_member_fee_id: 'f-asha',
      p_amount_npr: 800,
      p_method: 'bank_transfer',
      p_proof_path: path,
    })
  })

  it('shows Pending approval and blocks a second submission; shows a rejection reason', async () => {
    as('member')
    owing()
    fake.rows.fee_submissions = [
      submission('pending'),
      submission('rejected', { review_note: 'Wrong amount' }),
    ]
    renderWithProviders(<FeesPage />)
    expect(await screen.findByText('Pending approval')).toBeInTheDocument()
    expect(screen.getByText(/waiting for the admin/)).toBeInTheDocument()
    expect(screen.getByText('Rejected')).toBeInTheDocument()
    expect(screen.getByText(/Wrong amount/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Submit payment/ })).not.toBeInTheDocument()
  })

  it('the admin approves a submission from the queue', async () => {
    as('admin')
    fake.rows.fee_submissions = [submission('pending')]
    renderWithProviders(<FeesPage />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Confirm cash received/ }))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_review_fee_submission', {
      p_submission_id: 's-pending',
      p_approve: true,
      p_note: '',
    })
  })
})
