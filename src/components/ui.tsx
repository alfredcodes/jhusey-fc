// Building blocks of the Stitch design: cards, badges, avatars, stat tiles, tables, dialogs.
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from './icons.tsx'

export type Tone = 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'gray'

const badgeTones: Record<Tone, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  red: 'bg-rose-50 text-rose-600 border-rose-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-100',
  gray: 'bg-gray-50 text-gray-600 border-gray-200',
}

const dotTones: Record<Tone, string> = {
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-rose-500',
  purple: 'bg-purple-500',
  gray: 'bg-gray-400',
}

const iconTones: Record<Tone, string> = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-rose-50 text-rose-500',
  purple: 'bg-purple-50 text-purple-600',
  gray: 'bg-gray-50 text-gray-500',
}

export function Badge({
  tone = 'gray',
  dot = false,
  children,
  className = '',
}: {
  tone?: Tone
  dot?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${badgeTones[tone]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotTones[tone]}`} />}
      {children}
    </span>
  )
}

export function Card({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article'
}) {
  return (
    <Tag className={`rounded-2xl border border-gray-100 bg-white shadow-sm ${className}`}>
      {children}
    </Tag>
  )
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-base font-bold tracking-tight text-gray-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-gray-400">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function PageHeader({
  title,
  badges,
  description,
  actions,
}: {
  title: string
  badges?: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
          {badges}
        </div>
        {description && <p className="text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

const avatarTones = [
  'bg-blue-50 text-blue-600 border-blue-100',
  'bg-emerald-50 text-emerald-600 border-emerald-100',
  'bg-purple-50 text-purple-600 border-purple-100',
  'bg-amber-50 text-amber-600 border-amber-100',
  'bg-rose-50 text-rose-600 border-rose-100',
  'bg-cyan-50 text-cyan-600 border-cyan-100',
  'bg-gray-50 text-gray-600 border-gray-200',
]

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/** Initials avatar with a stable colour per name. */
export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  const sizes = { sm: 'h-8 w-8 text-[11px]', md: 'h-9 w-9 text-xs', lg: 'h-11 w-11 text-sm' }
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full border font-bold ${sizes[size]} ${avatarTones[hash % avatarTones.length]}`}
    >
      {initials(name)}
    </span>
  )
}

export function StatCard({
  label,
  value,
  unit,
  icon,
  tone = 'blue',
  footer,
  footerNote,
}: {
  label: string
  value: ReactNode
  unit?: string
  icon: IconName
  tone?: Tone
  footer?: ReactNode
  footerNote?: ReactNode
}) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs leading-tight font-semibold tracking-wide text-gray-500 uppercase">
          {label}
        </span>
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconTones[tone]}`}
        >
          <Icon name={icon} />
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-gray-900 tabular-nums">
          {value}
        </span>
        {unit && <span className="text-xs text-gray-400">{unit}</span>}
      </div>
      {(footer || footerNote) && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-50 pt-3 text-[11px]">
          <span>{footer}</span>
          <span className="text-right text-gray-400">{footerNote}</span>
        </div>
      )}
    </Card>
  )
}

export function EmptyState({
  icon = 'info',
  title,
  children,
}: {
  icon?: IconName
  title: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 text-gray-400">
        <Icon name={icon} />
      </span>
      <p className="text-sm font-semibold text-gray-700">{title}</p>
      {children && <div className="max-w-sm text-xs text-gray-500">{children}</div>}
    </div>
  )
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-10 animate-pulse rounded-xl bg-gray-100" />
      ))}
    </div>
  )
}

/** Uppercase column header cell. */
export function Th({
  children,
  align = 'left',
  className = '',
}: {
  children?: ReactNode
  align?: 'left' | 'right'
  className?: string
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-[11px] font-semibold tracking-wider whitespace-nowrap text-gray-500 uppercase ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  align = 'left',
  className = '',
}: {
  children?: ReactNode
  align?: 'left' | 'right'
  className?: string
}) {
  return (
    <td className={`px-4 py-3 align-middle ${align === 'right' ? 'text-right' : ''} ${className}`}>
      {children}
    </td>
  )
}

/** Table frame: scrolls sideways on small screens instead of squashing columns. */
export function TableFrame({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  )
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
}) {
  return (
    <label className="relative block w-full sm:max-w-sm">
      <span className="sr-only">{label}</span>
      <Icon
        name="search"
        className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-xl border border-gray-200 bg-gray-50/60 py-2 pr-3 pl-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
      />
    </label>
  )
}

export function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="block w-full rounded-xl border border-gray-200 bg-white py-2 pr-8 pl-3 text-sm text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Accessible modal dialog. Escape and the backdrop close it; focus moves inside. */
export function Modal({
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  title: string
  description?: ReactNode
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panel.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])

  // Portal: dialogs can be opened from inside table rows without breaking the table markup.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px]"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`relative max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-gray-900">
              {title}
            </h2>
            {description && <div className="mt-1 text-sm text-gray-500">{description}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close dialog"
          >
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** Segmented control (e.g. "This month / This week"). */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center rounded-xl border border-gray-100 bg-gray-50 p-1 text-xs font-medium text-gray-500"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-2.5 py-1 transition-colors ${value === option.value ? 'bg-white font-semibold text-blue-600 shadow-sm' : 'hover:text-gray-900'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
