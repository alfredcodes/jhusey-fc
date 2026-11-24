// Installable app (PWA): service worker registration, "new version" and "install app" state.
// The service worker exists only in production builds (`npm run build`), not in `npm run dev`.
import { useSyncExternalStore } from 'react'

type Listener = () => void

/** The browser's install prompt (Chrome/Edge/Android). Not in TypeScript's DOM types yet. */
export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const state = {
  waiting: null as ServiceWorker | null,
  installPrompt: null as InstallPromptEvent | null,
}
const listeners = new Set<Listener>()
const notify = () => listeners.forEach((listener) => listener())
function subscribe(listener: Listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

let updating = false

export function setWaitingWorker(worker: ServiceWorker | null) {
  state.waiting = worker
  notify()
}

/** Switch to the waiting version; the page reloads when it takes over. */
export function applyUpdate() {
  if (!state.waiting) return
  updating = true
  state.waiting.postMessage('SKIP_WAITING')
}

export function setInstallPrompt(event: InstallPromptEvent | null) {
  state.installPrompt = event
  notify()
}

/** Shows the browser's install dialog. Returns true if the member installed the app. */
export async function promptInstall() {
  const event = state.installPrompt
  if (!event) return false
  await event.prompt()
  const { outcome } = await event.userChoice
  setInstallPrompt(null) // the prompt can be used only once
  return outcome === 'accepted'
}

export function useUpdateAvailable() {
  return useSyncExternalStore(subscribe, () => state.waiting !== null)
}

export function useInstallPrompt() {
  return useSyncExternalStore(subscribe, () => state.installPrompt)
}

function subscribeOnline(listener: Listener) {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine)
}

/** Already opened as an installed app (home screen)? */
export function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** iPhone/iPad Safari: no install prompt; the member uses Share → Add to Home Screen. */
export function isIos() {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

export function startPwa() {
  window.addEventListener('beforeinstallprompt', (event) => {
    setInstallPrompt(event as InstallPromptEvent)
  })
  window.addEventListener('appinstalled', () => setInstallPrompt(null))

  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Only after the member tapped Reload: the first install must not reload the page.
    if (updating) window.location.reload()
  })

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none',
      })
      const hasController = () => navigator.serviceWorker.controller !== null
      if (registration.waiting && hasController()) setWaitingWorker(registration.waiting)
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && hasController()) setWaitingWorker(worker)
        })
      })
      // Installed apps can stay open for days: look for a new version when brought back.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {})
      })
    } catch {
      // No service worker (private mode, old browser): the app still works as a website.
    }
  }
  if (document.readyState === 'complete') void register()
  else window.addEventListener('load', () => void register(), { once: true })
}
