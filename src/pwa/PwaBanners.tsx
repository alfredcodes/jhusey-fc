import { useState } from 'react'
import { Icon } from '../components/icons.tsx'
import { Modal } from '../components/ui.tsx'
import {
  applyUpdate,
  isIos,
  isStandalone,
  promptInstall,
  useInstallPrompt,
  useOnline,
  useUpdateAvailable,
} from './pwa.ts'

/** "No internet" and "New version" notices, shown on every screen. */
export default function PwaBanners() {
  const online = useOnline()
  const update = useUpdateAvailable()
  if (online && !update) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(4.5rem+env(safe-area-inset-top))] z-50 flex flex-col items-center gap-2 px-4 xl:top-24">
      {!online && (
        <div
          role="status"
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 shadow-md"
        >
          <Icon name="warning" className="h-4 w-4 shrink-0" />
          You’re offline. Punch-in and team data need internet.
        </div>
      )}
      {update && (
        <div
          role="status"
          className="pointer-events-auto flex items-center gap-3 rounded-full border border-blue-100 bg-white py-1.5 pr-1.5 pl-4 text-sm font-medium text-gray-700 shadow-lg"
        >
          New version available
          <button
            type="button"
            onClick={applyUpdate}
            className="rounded-full bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Reload
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * "Install app": the browser's install dialog where there is one (Android, desktop Chrome/Edge),
 * otherwise (iPhone) the Add to Home Screen steps. Hidden once the app runs installed.
 */
export function InstallAppButton({
  className,
  children,
  role,
}: {
  className: string
  children?: string
  role?: string
}) {
  const prompt = useInstallPrompt()
  const [steps, setSteps] = useState(false)
  if (isStandalone() || (!prompt && !isIos())) return null
  return (
    <>
      <button
        type="button"
        role={role}
        className={className}
        onClick={() => (prompt ? void promptInstall() : setSteps(true))}
      >
        <Icon name="download" className="h-4 w-4" /> {children ?? 'Install app'}
      </button>
      {steps && (
        <Modal title="Add Jhusey FC to your Home Screen" onClose={() => setSteps(false)}>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-gray-700">
            <li>
              Open this page in <strong>Safari</strong>.
            </li>
            <li>
              Tap the <strong>Share</strong> button (square with an arrow).
            </li>
            <li>
              Choose <strong>Add to Home Screen</strong>, then <strong>Add</strong>.
            </li>
          </ol>
          <p className="mt-3 text-xs text-gray-500">
            The Jhusey FC icon then opens the app full screen, like any other app.
          </p>
        </Modal>
      )}
    </>
  )
}
