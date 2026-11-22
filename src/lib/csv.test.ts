import { describe, expect, it } from 'vitest'
import { csvCell, toCsv } from './csv.ts'

describe('csvCell', () => {
  it.each([
    ['plain', 'plain'],
    ['has, comma', '"has, comma"'],
    ['say "hi"', '"say ""hi"""'],
    ['two\nlines', '"two\nlines"'],
    ['नेपाली नाम', 'नेपाली नाम'],
  ])('escapes %j', (input, expected) => {
    expect(csvCell(input)).toBe(expected)
  })

  it.each([
    ['=HYPERLINK("http://evil","x")', `"'=HYPERLINK(""http://evil"",""x"")"`],
    ['+1+1', "'+1+1"],
    ['-2+3', "'-2+3"],
    ['@SUM(A1)', "'@SUM(A1)"],
  ])('neutralises the formula %j', (input, expected) => {
    expect(csvCell(input)).toBe(expected)
  })

  it('keeps numbers, including negatives, as numbers', () => {
    expect(csvCell(50)).toBe('50')
    expect(csvCell(-27.5)).toBe('-27.5')
    expect(csvCell(Number.NaN)).toBe('')
  })

  it('writes empty cells for missing values', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })
})

describe('toCsv', () => {
  it('writes a header row and one line per row', () => {
    const csv = toCsv(
      [
        { name: 'Asha', fine: 50 },
        { name: 'Bikash, T.', fine: null },
      ],
      [
        { header: 'Member', value: (row) => row.name },
        { header: 'Fine (NPR)', value: (row) => row.fine },
      ],
    )
    expect(csv).toBe('Member,Fine (NPR)\r\nAsha,50\r\n"Bikash, T.",\r\n')
  })
})
