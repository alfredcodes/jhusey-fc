export type CsvColumn<T> = { header: string; value: (row: T) => unknown }

/**
 * One CSV cell. Quotes values containing commas, quotes or line breaks, and
 * neutralises spreadsheet formulas: a cell starting with = + - @ (or tab/CR) is
 * prefixed with ' so Excel/Sheets show it as text instead of running it.
 * Numbers are left as numbers, so negative amounts still work.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : ''
  let text = String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [
    columns.map((column) => csvCell(column.header)).join(','),
    ...rows.map((row) => columns.map((column) => csvCell(column.value(row))).join(',')),
  ]
  return lines.join('\r\n') + '\r\n'
}

/** Saves CSV text as a file. The BOM makes Excel read Nepali/Unicode names correctly. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
