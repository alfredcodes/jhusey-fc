// Small dependency-free SVG charts. Colours validated for colour-blind separation
// (dataviz validator): present #2563eb, absent #e11d48, excused #8b5cf6, late #f59e0b.
// Every chart has a legend with numbers and a table elsewhere on the page, so colour is never the only cue.
import { useState } from 'react'
import { chartColors } from './chart-colors.ts'

export type DonutSlice = { label: string; value: number; color: string }

/** Donut with a 2px surface gap between segments and the headline in the middle. */
export function Donut({
  slices,
  centre,
  caption,
  label,
}: {
  slices: DonutSlice[]
  centre: string
  caption: string
  label: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const radius = 62
  const circumference = 2 * Math.PI * radius
  const visible = slices.filter((slice) => slice.value > 0)
  const gap = visible.length > 1 ? 2 : 0
  // Where each segment starts along the ring (cumulative length of the ones before it).
  const starts = slices.map((_, index) =>
    slices
      .slice(0, index)
      .reduce((sum, s) => sum + (total ? (s.value / total) * circumference : 0), 0),
  )

  return (
    <figure className="relative mx-auto flex h-52 w-52 items-center justify-center">
      <svg viewBox="0 0 160 160" className="h-52 w-52 -rotate-90" role="img" aria-label={label}>
        <circle cx="80" cy="80" r={radius} stroke="#F3F4F6" strokeWidth="16" fill="none" />
        {total > 0 &&
          slices.map((slice, index) => {
            const length = (slice.value / total) * circumference
            const dash = Math.max(length - gap, 0)
            const element = (
              <circle
                key={slice.label}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={hover === index ? 18 : 16}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-starts[index]}
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
                className="transition-[stroke-width] duration-150"
              >
                <title>{`${slice.label}: ${slice.value} (${Math.round((100 * slice.value) / total)}%)`}</title>
              </circle>
            )
            return slice.value > 0 ? element : null
          })}
      </svg>
      <figcaption className="absolute flex flex-col items-center text-center">
        <span className="text-3xl font-bold tracking-tight text-gray-900 tabular-nums">
          {hover !== null ? slices[hover].value : centre}
        </span>
        <span className="mt-0.5 text-[11px] font-medium tracking-wider text-gray-400 uppercase">
          {hover !== null ? slices[hover].label : caption}
        </span>
      </figcaption>
    </figure>
  )
}

export type BarDatum = { label: string; value: number; display?: string }

/**
 * Vertical bars, one series, one hue. Value labels sit above each bar; the tooltip
 * (native title) repeats label + value for hover.
 */
export function ColumnChart({
  data,
  label,
  color = chartColors.present,
  max,
}: {
  data: BarDatum[]
  label: string
  color?: string
  max?: number
}) {
  const top = Math.max(max ?? 0, ...data.map((d) => d.value), 1)
  return (
    <div role="img" aria-label={label} className="flex h-44 items-end gap-2">
      {data.map((datum) => (
        <div key={datum.label} className="group flex h-full min-w-0 flex-1 flex-col items-center">
          <div className="flex w-full flex-1 flex-col items-center justify-end">
            <span className="mb-1 text-[10px] font-semibold text-gray-600 tabular-nums">
              {datum.display ?? datum.value}
            </span>
            <div
              title={`${datum.label}: ${datum.display ?? datum.value}`}
              className="w-full max-w-10 rounded-t-[4px] transition-opacity group-hover:opacity-80"
              style={{
                height: `${(datum.value / top) * 100}%`,
                minHeight: datum.value > 0 ? 2 : 0,
                backgroundColor: color,
              }}
            />
          </div>
          <span className="mt-1.5 w-full truncate text-center text-[10px] text-gray-500">
            {datum.label}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Two-part stacked columns (e.g. late + absence fines) with a 2px gap between parts. */
export function StackedColumnChart({
  data,
  label,
  series,
}: {
  data: { label: string; values: [number, number] }[]
  label: string
  series: [{ name: string; color: string }, { name: string; color: string }]
}) {
  const top = Math.max(...data.map((d) => d.values[0] + d.values[1]), 1)
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-gray-600">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <div role="img" aria-label={label} className="flex h-44 items-end gap-2">
        {data.map((datum) => {
          const total = datum.values[0] + datum.values[1]
          return (
            <div
              key={datum.label}
              className="group flex h-full min-w-0 flex-1 flex-col items-center"
            >
              <div
                className="flex w-full flex-1 flex-col items-center justify-end"
                title={`${datum.label}: ${series[0].name} Rs. ${datum.values[0]}, ${series[1].name} Rs. ${datum.values[1]}`}
              >
                <span className="mb-1 text-[10px] font-semibold text-gray-600 tabular-nums">
                  {total > 0 ? total.toLocaleString('en-IN') : ''}
                </span>
                <div
                  className="flex w-full max-w-10 flex-col gap-[2px] group-hover:opacity-80"
                  style={{ height: `${(total / top) * 100}%` }}
                >
                  {datum.values[1] > 0 && (
                    <div
                      className="w-full rounded-t-[4px]"
                      style={{ flex: datum.values[1], backgroundColor: series[1].color }}
                    />
                  )}
                  {datum.values[0] > 0 && (
                    <div
                      className={`w-full ${datum.values[1] > 0 ? '' : 'rounded-t-[4px]'}`}
                      style={{ flex: datum.values[0], backgroundColor: series[0].color }}
                    />
                  )}
                </div>
              </div>
              <span className="mt-1.5 w-full truncate text-center text-[10px] text-gray-500">
                {datum.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** Thin horizontal progress bar for a percentage (member attendance). */
export function PercentBar({ percent, tone }: { percent: number | null; tone?: 'good' | 'bad' }) {
  const color = tone === 'bad' ? 'bg-rose-400' : tone === 'good' ? 'bg-emerald-500' : 'bg-blue-600'
  return (
    <span className="block h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
      <span
        className={`block h-full rounded-full ${color}`}
        style={{ width: `${Math.max(0, Math.min(100, percent ?? 0))}%` }}
      />
    </span>
  )
}
