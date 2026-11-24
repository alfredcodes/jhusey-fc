import { describe, expect, it } from 'vitest'
import { loginName, toLoginEmail, USERNAME_PATTERN } from './login-name.ts'

describe('login names', () => {
  it('turns a username or phone number into the sign-in email and back', () => {
    expect(toLoginEmail(' Kamal ')).toBe('kamal@members.jhusey-fc.invalid')
    expect(toLoginEmail('98 4123 4567')).toBe('9841234567@members.jhusey-fc.invalid')
    expect(loginName('kamal@members.jhusey-fc.invalid')).toBe('kamal')
  })

  it('leaves real email addresses alone', () => {
    expect(toLoginEmail('Admin@Example.com')).toBe('admin@example.com')
    expect(loginName('admin@example.com')).toBe('admin@example.com')
  })

  it('accepts sensible usernames only', () => {
    for (const ok of ['rk', 'kamal', 'sandip.shaha', '9841234567']) {
      expect(USERNAME_PATTERN.test(ok)).toBe(true)
    }
    for (const bad of ['k', '-kamal', 'Kamal', 'kamal thapa', 'a@b']) {
      expect(USERNAME_PATTERN.test(bad)).toBe(false)
    }
  })
})
