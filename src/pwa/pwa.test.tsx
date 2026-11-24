import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PwaBanners, { InstallAppButton } from './PwaBanners.tsx'
import { setInstallPrompt, setWaitingWorker, type InstallPromptEvent } from './pwa.ts'

function setOnline(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
  window.dispatchEvent(new Event(value ? 'online' : 'offline'))
}

function setUserAgent(value: string) {
  Object.defineProperty(navigator, 'userAgent', { value, configurable: true })
}

const desktopChrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0 Safari/537.36'
const iphone =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1'

afterEach(() => {
  act(() => {
    setOnline(true)
    setWaitingWorker(null)
    setInstallPrompt(null)
  })
  setUserAgent(desktopChrome)
})

describe('PwaBanners', () => {
  it('shows nothing when online and up to date', () => {
    const { container } = render(<PwaBanners />)
    expect(container).toBeEmptyDOMElement()
  })

  it('tells the member when they are offline, and hides it when back online', () => {
    render(<PwaBanners />)
    act(() => setOnline(false))
    expect(screen.getByRole('status')).toHaveTextContent('You’re offline')
    act(() => setOnline(true))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('offers a new version and switches only when Reload is tapped', async () => {
    const worker = { postMessage: vi.fn() } as unknown as ServiceWorker
    render(<PwaBanners />)
    act(() => setWaitingWorker(worker))
    expect(screen.getByText('New version available')).toBeInTheDocument()
    expect(worker.postMessage).not.toHaveBeenCalled()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reload' }))
    expect(worker.postMessage).toHaveBeenCalledWith('SKIP_WAITING')
  })
})

describe('InstallAppButton', () => {
  it('is hidden when the browser offers no install and it is not an iPhone', () => {
    setUserAgent(desktopChrome)
    const { container } = render(<InstallAppButton className="" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('opens the browser install dialog when the browser offers one', async () => {
    setUserAgent(desktopChrome)
    const event = Object.assign(new Event('beforeinstallprompt'), {
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    }) as InstallPromptEvent
    render(<InstallAppButton className="" />)
    act(() => setInstallPrompt(event))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Install app' }))
    expect(event.prompt).toHaveBeenCalledTimes(1)
    // The prompt can be used once; after installing, the button goes away.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Install app' })).not.toBeInTheDocument(),
    )
  })

  it('shows the Add to Home Screen steps on an iPhone', async () => {
    setUserAgent(iphone)
    render(<InstallAppButton className="">Install the app on this phone</InstallAppButton>)
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Install the app on this phone' }))
    expect(
      screen.getByRole('dialog', { name: 'Add Jhusey FC to your Home Screen' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Add to Home Screen')).toBeInTheDocument()
  })
})
