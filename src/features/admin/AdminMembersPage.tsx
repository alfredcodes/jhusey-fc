import { useState, type FormEvent } from 'react'
import {
  FormError,
  FormSuccess,
  inputClass,
  primaryButtonClass,
  smallButtonClass,
} from '../../components/form.tsx'
import { errorMessage } from '../../lib/errors.ts'
import { useProfile } from '../auth/use-profile.ts'
import { useAllMembers, useUpdateMember } from './queries.ts'

type Member = NonNullable<ReturnType<typeof useAllMembers>['data']>[number]

export default function AdminMembersPage() {
  const members = useAllMembers()
  const [editing, setEditing] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Members</h1>
      <p className="text-sm text-slate-600">
        New members are invited from the Supabase dashboard (Authentication → Users → Invite). They
        appear here after accepting. Deactivating keeps all history and blocks sign-in to the app.
      </p>
      <FormSuccess message={saved} />
      {members.isPending && <p className="text-slate-600">Loading members…</p>}
      {members.isError && <FormError message={errorMessage(members.error)} />}

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {members.data?.map((member) => (
          <li key={member.id} className="px-4 py-3">
            {editing === member.id ? (
              <MemberForm
                member={member}
                onDone={(message) => {
                  setEditing(null)
                  setSaved(message)
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={`font-medium ${member.is_active ? '' : 'text-slate-500'}`}>
                    {member.display_name}
                  </p>
                  <p className="text-xs text-slate-600">
                    {member.role === 'admin' ? 'Admin' : 'Member'}
                    {!member.is_active && ' · Deactivated'}
                  </p>
                </div>
                <button
                  type="button"
                  className={smallButtonClass}
                  onClick={() => {
                    setSaved(null)
                    setEditing(member.id)
                  }}
                >
                  Edit
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function MemberForm({
  member,
  onDone,
  onCancel,
}: {
  member: Member
  onDone: (message: string) => void
  onCancel: () => void
}) {
  const update = useUpdateMember()
  const { data: me } = useProfile()
  const [error, setError] = useState<string | null>(null)
  const isMe = me?.id === member.id

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setError(null)
    try {
      await update.mutateAsync({
        id: member.id,
        displayName: String(form.get('name')).trim(),
        isActive: isMe || form.get('active') === 'on',
      })
      onDone(`${String(form.get('name')).trim()} saved.`)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block text-sm font-medium">
        Display name
        <input
          name="name"
          required
          maxLength={60}
          defaultValue={member.display_name}
          className={inputClass}
        />
      </label>
      {!isMe && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input name="active" type="checkbox" defaultChecked={member.is_active} />
          Active
        </label>
      )}
      <FormError message={error} />
      <div className="flex gap-3">
        <button type="submit" disabled={update.isPending} className={primaryButtonClass}>
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className={smallButtonClass}>
          Cancel
        </button>
      </div>
    </form>
  )
}
