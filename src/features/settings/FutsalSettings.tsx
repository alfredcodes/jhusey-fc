import { useState, type FormEvent } from 'react'
import {
  FormError,
  FormSuccess,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
  smallButtonClass,
} from '../../components/form.tsx'
import { Icon } from '../../components/icons.tsx'
import { Badge, Card, CardHeader, EmptyState, LoadingRows } from '../../components/ui.tsx'
import { osmLink, parseLatLng } from '../../lib/coordinates.ts'
import { errorMessage } from '../../lib/errors.ts'
import { useSaveVenue, useVenues, type Venue } from '../sessions/queries.ts'

/** Venue and geofence settings (admin). The database refuses members' writes. */
export default function FutsalSettings() {
  const venues = useVenues()
  // null = form closed, 'new' = adding, Venue = editing that venue
  const [editing, setEditing] = useState<Venue | 'new' | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  return (
    <div className="max-w-3xl space-y-5">
      <Card className="p-6">
        <CardHeader
          title="Punch-in area / geofence"
          description="Members can punch in only within the radius of the venue, with a precise enough GPS fix."
          actions={
            editing === null && (
              <button
                type="button"
                className={smallButtonClass}
                onClick={() => {
                  setSaved(null)
                  setEditing('new')
                }}
              >
                <Icon name="plus" className="h-3.5 w-3.5" /> Add venue
              </button>
            )
          }
        />
        <div className="mt-4 space-y-4">
          <FormSuccess message={saved} />
          {venues.isPending && <LoadingRows rows={1} />}
          {venues.isError && <FormError message={errorMessage(venues.error)} />}
          {venues.data?.length === 0 && editing === null && (
            <EmptyState icon="pin" title="No venue yet">
              Add the futsal court so sessions and punch-in know where to check.
            </EmptyState>
          )}
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
          <ul className="space-y-3">
            {venues.data?.map((venue) => (
              <li key={venue.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-semibold text-gray-900">
                      {venue.name}
                      {venue.is_active ? (
                        <Badge tone="green">Active</Badge>
                      ) : (
                        <Badge tone="gray">Inactive</Badge>
                      )}
                    </p>
                    <p className="mt-1 font-mono text-xs text-gray-500">
                      {venue.latitude}, {venue.longitude}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      Radius {venue.geofence_radius_m} m · GPS accuracy needed ±
                      {venue.max_accuracy_m} m ·{' '}
                      <a
                        href={osmLink(venue)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-blue-600 hover:underline"
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
        </div>
      </Card>
    </div>
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
        max_accuracy_m: Number(form.get('max_accuracy')),
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
      className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4"
    >
      <p className="font-semibold text-gray-900">{venue ? `Edit ${venue.name}` : 'Add venue'}</p>
      <label className={labelClass}>
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
        <label className={labelClass}>
          Pitch coordinates
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
        <p id="coordinates-help" className="mt-1 text-xs text-gray-500">
          In Google Maps, right-click the court and click the numbers at the top of the menu to copy
          them.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>
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
          <p id="radius-help" className="mt-1 text-xs text-gray-500">
            100 m covers the court and car park. Adjust after testing phones at the venue.
          </p>
        </div>
        <div>
          <label className={labelClass}>
            GPS accuracy needed (metres)
            <input
              name="max_accuracy"
              type="number"
              required
              min={10}
              max={500}
              aria-describedby="accuracy-help"
              defaultValue={venue?.max_accuracy_m ?? 50}
              className={inputClass}
            />
          </label>
          <p id="accuracy-help" className="mt-1 text-xs text-gray-500">
            Punch-in is refused when the phone’s location could be off by more than this.
          </p>
        </div>
      </div>
      {venue && (
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input
            name="is_active"
            type="checkbox"
            defaultChecked={venue.is_active}
            className="h-4 w-4 rounded border-gray-300"
          />
          Active (inactive venues cannot get new sessions)
        </label>
      )}
      <FormError message={error} />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={save.isPending}
          className={`${primaryButtonClass} sm:w-auto`}
        >
          {save.isPending ? 'Saving…' : 'Save venue'}
        </button>
        <button type="button" onClick={onCancel} className={secondaryButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  )
}
