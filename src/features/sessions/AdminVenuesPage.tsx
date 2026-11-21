import { useState, type FormEvent } from 'react'
import { errorMessage } from '../../lib/errors.ts'
import {
  FormError,
  FormSuccess,
  inputClass,
  primaryButtonClass,
  smallButtonClass,
} from '../../components/form.tsx'
import { osmLink, parseLatLng } from '../../lib/coordinates.ts'
import { useSaveVenue, useVenues, type Venue } from './queries.ts'

export default function AdminVenuesPage() {
  const venues = useVenues()
  // null = form closed, 'new' = adding, Venue = editing that venue
  const [editing, setEditing] = useState<Venue | 'new' | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Venues</h1>
        {editing === null && (
          <button
            type="button"
            className={smallButtonClass}
            onClick={() => {
              setSaved(null)
              setEditing('new')
            }}
          >
            Add venue
          </button>
        )}
      </div>

      <FormSuccess message={saved} />

      {editing !== null && (
        <VenueForm
          key={editing === 'new' ? 'new' : editing.id}
          venue={editing === 'new' ? null : editing}
          onDone={(message) => {
            setEditing(null)
            setSaved(message)
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {venues.isPending && <p className="text-slate-600">Loading venues…</p>}
      {venues.isError && <FormError message={errorMessage(venues.error)} />}
      {venues.data?.length === 0 && editing === null && (
        <p className="rounded-md border border-dashed border-slate-300 p-4 text-slate-600">
          No venue yet. Add the futsal court so sessions and punch-in know where to check.
        </p>
      )}

      <ul className="space-y-3">
        {venues.data?.map((venue) => (
          <li key={venue.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  {venue.name}{' '}
                  {!venue.is_active && (
                    <span className="ml-1 rounded bg-slate-200 px-2 py-0.5 text-xs">Inactive</span>
                  )}
                </p>
                <p className="mt-1 font-mono text-sm text-slate-600">
                  {venue.latitude}, {venue.longitude}
                </p>
                <p className="text-sm text-slate-600">
                  Punch-in radius: {venue.geofence_radius_m} m ·{' '}
                  <a
                    href={osmLink(venue)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-800 underline"
                  >
                    Check on map
                  </a>
                </p>
              </div>
              <button
                type="button"
                className={smallButtonClass}
                onClick={() => {
                  setSaved(null)
                  setEditing(venue)
                }}
              >
                Edit
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function VenueForm({
  venue,
  onDone,
  onCancel,
}: {
  venue: Venue | null
  onDone: (message: string) => void
  onCancel: () => void
}) {
  const save = useSaveVenue()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const point = parseLatLng(String(form.get('coordinates')))
    if (!point) {
      setError('Could not read the coordinates. Paste them like: 27.717245, 85.323960')
      return
    }
    setError(null)
    try {
      await save.mutateAsync({
        id: venue?.id,
        name: String(form.get('name')).trim(),
        ...point,
        geofence_radius_m: Number(form.get('radius')),
        is_active: venue ? form.get('is_active') === 'on' : true,
      })
      onDone(venue ? 'Venue updated.' : 'Venue added.')
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4"
    >
      <h2 className="font-semibold">{venue ? `Edit ${venue.name}` : 'Add venue'}</h2>
      <label className="block text-sm font-medium">
        Name
        <input
          name="name"
          required
          maxLength={80}
          defaultValue={venue?.name}
          className={inputClass}
        />
      </label>
      <div>
        <label className="block text-sm font-medium">
          Coordinates
          <input
            name="coordinates"
            required
            inputMode="decimal"
            placeholder="27.717245, 85.323960"
            aria-describedby="coordinates-help"
            defaultValue={venue ? `${venue.latitude}, ${venue.longitude}` : ''}
            className={`${inputClass} font-mono`}
          />
        </label>
        <p id="coordinates-help" className="mt-1 text-sm text-slate-600">
          In Google Maps, right-click the court and click the numbers at the top of the menu to copy
          them, then paste here.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium">
          Punch-in radius (metres)
          <input
            name="radius"
            type="number"
            required
            min={20}
            max={1000}
            aria-describedby="radius-help"
            defaultValue={venue?.geofence_radius_m ?? 100}
            className={inputClass}
          />
        </label>
        <p id="radius-help" className="mt-1 text-sm text-slate-600">
          100 m is the starting value. Adjust after testing phones at the venue.
        </p>
      </div>
      {venue && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input name="is_active" type="checkbox" defaultChecked={venue.is_active} />
          Active (inactive venues cannot get new sessions)
        </label>
      )}
      <FormError message={error} />
      <div className="flex gap-3">
        <button type="submit" disabled={save.isPending} className={primaryButtonClass}>
          {save.isPending ? 'Saving…' : 'Save venue'}
        </button>
        <button type="button" onClick={onCancel} className={smallButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  )
}
