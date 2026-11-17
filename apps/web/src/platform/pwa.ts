export type PwaSnapshot = Readonly<{
  installable: boolean
  installed: boolean
  updateReady: boolean
  online: boolean
}>

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

export type BrowserFamily =
  | 'iosSafari'
  | 'iosOther'
  | 'android'
  | 'chromium'
  | 'safariMac'
  | 'other'

export type DisplayMode = 'standalone' | 'browser'

const INSTALLED_QUERY =
  '(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui), (display-mode: window-controls-overlay)'

type InstallPromptEvent = Event &
  Readonly<{
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  }>

type BrowserNavigator = Navigator &
  Readonly<{
    standalone?: boolean
    setAppBadge?: (contents?: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }>

const state = {
  installable: false,
  installed: false,
  updateReady: false,
}

let deferred: InstallPromptEvent | null = null
let started = false
let registration: ServiceWorkerRegistration | null = null
let reloadWanted = false
let reloaded = false
let badge = -1
const listeners = new Set<() => void>()

const emit = (): void => {
  for (const listener of listeners) listener()
}

export const displayModeOf = (standalone: boolean, iosStandalone: boolean): DisplayMode =>
  standalone || iosStandalone ? 'standalone' : 'browser'

export const displayMode = (): DisplayMode => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'browser'
  const standalone =
    typeof window.matchMedia === 'function' ? window.matchMedia(INSTALLED_QUERY).matches : false
  return displayModeOf(standalone, (navigator as BrowserNavigator).standalone === true)
}

export const browserFamily = (
  userAgent: string,
  platform: string,
  touchPoints: number,
): BrowserFamily => {
  const ios = /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && touchPoints > 1)
  if (ios) return /(?:CriOS|FxiOS|EdgiOS|OPiOS)/.test(userAgent) ? 'iosOther' : 'iosSafari'
  if (/Android/.test(userAgent)) return /(?:Chrome|CriOS)/.test(userAgent) ? 'android' : 'other'
  if (/Chrome\/|Chromium\/|Edg\//.test(userAgent)) return 'chromium'
  if (/Safari\//.test(userAgent) && !/Firefox\//.test(userAgent)) return 'safariMac'
  return 'other'
}

export const browserFamilyOf = (): BrowserFamily =>
  typeof navigator === 'undefined'
    ? 'other'
    : browserFamily(navigator.userAgent, navigator.platform, navigator.maxTouchPoints)

export const onIos = (): boolean =>
  browserFamilyOf() === 'iosSafari' || browserFamilyOf() === 'iosOther'

const onlineNow = (): boolean =>
  typeof navigator === 'undefined' ? true : navigator.onLine !== false

export const pwaSnapshot = (): PwaSnapshot => ({
  installable: state.installable,
  installed: state.installed || displayMode() === 'standalone',
  updateReady: state.updateReady,
  online: onlineNow(),
})

const onPrompt = (event: Event): void => {
  event.preventDefault()
  deferred = event as InstallPromptEvent
  state.installable = true
  emit()
}

const onInstalled = (): void => {
  state.installed = true
  state.installable = false
  deferred = null
  emit()
}

const onConnection = (): void => emit()

const watchWorker = (worker: ServiceWorker | null): void => {
  if (worker === null) return
  const check = (): void => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      state.updateReady = true
      emit()
    }
  }
  worker.addEventListener('statechange', check)
  check()
}

const watchRegistration = (found: ServiceWorkerRegistration): void => {
  if (found.waiting && navigator.serviceWorker.controller) {
    state.updateReady = true
    emit()
  }
  watchWorker(found.installing)
  found.addEventListener('updatefound', () => watchWorker(found.installing))
}

const registerWorker = (): void => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  void navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((found) => {
      registration = found
      watchRegistration(found)
      const checkWaiting = (): void => {
        if (!state.updateReady && found.waiting && navigator.serviceWorker.controller) {
          state.updateReady = true
          emit()
        }
      }
      checkWaiting()
      window.setInterval(checkWaiting, 10_000)
      window.setInterval(
        () => {
          void found.update().catch(() => undefined)
        },
        30 * 60 * 1000,
      )
    })
    .catch(() => undefined)
}

export const startPwa = (): void => {
  if (started || typeof window === 'undefined' || typeof navigator === 'undefined') return
  started = true
  state.installed = displayMode() === 'standalone'
  window.addEventListener('beforeinstallprompt', onPrompt)
  window.addEventListener('appinstalled', onInstalled)
  window.addEventListener('online', onConnection)
  window.addEventListener('offline', onConnection)
  if ('serviceWorker' in navigator)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloadWanted || reloaded) return
      reloaded = true
      window.location.reload()
    })
  registerWorker()
}

export const watchPwa = (listener: (snapshot: PwaSnapshot) => void): (() => void) => {
  startPwa()
  const notify = (): void => listener(pwaSnapshot())
  listeners.add(notify)
  notify()
  return () => {
    listeners.delete(notify)
  }
}

export const promptInstall = async (): Promise<InstallOutcome> => {
  const event = deferred
  if (event === null) return 'unavailable'
  deferred = null
  state.installable = false
  emit()
  try {
    await event.prompt()
    const choice = await event.userChoice
    if (choice.outcome === 'accepted') state.installed = true
    return choice.outcome
  } catch {
    return 'unavailable'
  } finally {
    emit()
  }
}

export const requestPwaUpdate = async (): Promise<void> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const found = registration ?? (await navigator.serviceWorker.getRegistration('/'))
  const waiting = found?.waiting
  if (!waiting) return
  reloadWanted = true
  waiting.postMessage({ type: 'SKIP_WAITING' })
}

export const syncAppBadge = (unread: number): void => {
  if (typeof navigator === 'undefined') return
  const api = navigator as BrowserNavigator
  if (typeof api.setAppBadge !== 'function') return
  const count = Math.max(0, Math.trunc(unread))
  if (count === badge) return
  badge = count
  try {
    const result =
      count === 0
        ? typeof api.clearAppBadge === 'function'
          ? api.clearAppBadge()
          : api.setAppBadge(0)
        : api.setAppBadge(count)
    void result?.catch(() => undefined)
  } catch {}
}
