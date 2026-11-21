import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../../lib/supabase.ts'
import { renderWithProviders } from '../../test/render.tsx'
import type { FakeState } from '../../test/supabase-mock.ts'
import ForgotPasswordPage from './ForgotPasswordPage.tsx'
import LoginPage from './LoginPage.tsx'
import SetPasswordPage from './SetPasswordPage.tsx'

const fake = vi.hoisted((): FakeState => ({ session: null, profile: null }))

vi.mock('../../lib/supabase.ts', async () => {
  const { buildFakeSupabase } = await import('../../test/supabase-mock.ts')
  return { supabase: buildFakeSupabase(fake) }
})

const auth = vi.mocked(supabase.auth)

function renderSetPassword(query: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/set-password" element={<SetPasswordPage />} />
      <Route path="/" element={<h1>Home</h1>} />
    </Routes>,
    { path: `/set-password${query}` },
  )
}

async function fillPasswords(password: string, confirm = password) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('New password'), password)
  await user.type(screen.getByLabelText('Confirm password'), confirm)
  await user.click(screen.getByRole('button', { name: 'Save password' }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LoginPage', () => {
  it('shows one generic message for wrong email or password', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'invalid_credentials' },
    } as never)
    renderWithProviders(<LoginPage />, { path: '/login' })

    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), 'someone@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.')
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'someone@example.com',
      password: 'wrong-password',
    })
  })
})

describe('ForgotPasswordPage', () => {
  it('gives the same confirmation whether or not the account exists', async () => {
    renderWithProviders(<ForgotPasswordPage />, { path: '/forgot-password' })
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Email'), 'unknown@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByRole('status')).toHaveTextContent('If an account exists')
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('unknown@example.com')
  })
})

describe('SetPasswordPage', () => {
  it('rejects a link without a token', () => {
    renderSetPassword('?type=invite')
    expect(screen.getByRole('heading', { name: 'Link not valid' })).toBeInTheDocument()
  })

  it('rejects an unknown link type', () => {
    renderSetPassword('?token_hash=abc&type=magiclink')
    expect(screen.getByRole('heading', { name: 'Link not valid' })).toBeInTheDocument()
  })

  it('checks the passwords before redeeming the token', async () => {
    renderSetPassword('?token_hash=abc&type=invite')

    await fillPasswords('long-enough-1', 'different-123')
    expect(screen.getByRole('alert')).toHaveTextContent('do not match')
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })

  it('rejects a password shorter than 8 characters', async () => {
    renderSetPassword('?token_hash=abc&type=recovery')

    await fillPasswords('short')
    expect(screen.getByRole('alert')).toHaveTextContent('at least 8')
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })

  it('accepts an invite: redeems the token, saves the password, goes home', async () => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: null } as never)
    auth.updateUser.mockResolvedValue({ data: {}, error: null } as never)
    renderSetPassword('?token_hash=abc&type=invite')

    expect(screen.getByRole('heading', { name: /Welcome/ })).toBeInTheDocument()
    await fillPasswords('a-good-password')

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'abc', type: 'invite' })
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'a-good-password' })
  })

  it('explains an expired invite and does not try to save a password', async () => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: { code: 'otp_expired' } } as never)
    renderSetPassword('?token_hash=abc&type=invite')

    await fillPasswords('a-good-password')
    expect(await screen.findByRole('alert')).toHaveTextContent('Ask the admin to send a new one')
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('does not redeem the token twice when saving the password is retried', async () => {
    auth.verifyOtp.mockResolvedValue({ data: {}, error: null } as never)
    auth.updateUser
      .mockResolvedValueOnce({ data: {}, error: { code: 'weak_password' } } as never)
      .mockResolvedValueOnce({ data: {}, error: null } as never)
    renderSetPassword('?token_hash=abc&type=recovery')

    await fillPasswords('password-one')
    expect(await screen.findByRole('alert')).toHaveTextContent('too weak')

    const user = userEvent.setup()
    await user.clear(screen.getByLabelText('New password'))
    await user.clear(screen.getByLabelText('Confirm password'))
    await fillPasswords('a-much-better-password')

    expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument()
    expect(auth.verifyOtp).toHaveBeenCalledTimes(1)
    expect(auth.updateUser).toHaveBeenCalledTimes(2)
  })
})
