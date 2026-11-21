import { describe, expect, it } from 'vitest'
import { findEnvProblem } from './env.ts'

const key = 'sb_publishable_example'

describe('findEnvProblem', () => {
  it('accepts a valid local setup', () => {
    expect(
      findEnvProblem({
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: key,
      }),
    ).toBeNull()
  })

  it.each([
    [undefined, 'missing'],
    ['', 'missing'],
    ['127.0.0.1:54321', 'http://'],
    ['localhost:54321', 'http://'],
    ['VITE_SUPABASE_URL=http://127.0.0.1:54321', 'http://'],
    ['`http://127.0.0.1:54321`', 'http://'],
  ])('reports a bad URL: %s', (url, expected) => {
    expect(
      findEnvProblem({ VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key }),
    ).toContain(expected)
  })

  it('reports a missing key', () => {
    expect(findEnvProblem({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321' })).toContain(
      'PUBLISHABLE_KEY is missing',
    )
  })

  it('refuses a secret key in the browser', () => {
    expect(
      findEnvProblem({
        VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abc',
      }),
    ).toContain('SECRET key')
  })
})
