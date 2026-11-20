export type PwaSnapshot = Readonly<{
  installable: boolean
  installed: boolean
  online: boolean
  updated: boolean
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

const UPDATE_KEY = 'quorum.pwa.updated'
const UPDATE_CHECK_MS = 30 * 60 * 1000
const UPDATE_CHECK_FLOOR_MS = 5 * 60 * 1000
const UPDATE_RELOAD_MS = 2000

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
  updated: false,
}

let deferred: InstallPromptEvent | null = null
let started = false
let checkedAt = 0
let badge = -1
const listeners = new Set<() => void>()

const emit = (): void => {
  for (const listener of listeners) listener()
}

const session = (): Storage | null => {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

const takeUpdated = (): boolean => {
  const store = session()
  if (store === null) return false
  try {
    const found = store.getItem(UPDATE_KEY) === '1'
    if (found) store.removeItem(UPDATE_KEY)
    return found
  } catch {
    return false
  }
}

const markUpdated = (): void => {
  const store = session()
  if (store === null) return
  try {
    store.setItem(UPDATE_KEY, '1')
  } catch {}
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
  online: onlineNow(),
  updated: state.updated,
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

const registerWorker = (): void => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  void navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((found) => {
      const check = (): void => {
        const now = Date.now()
        if (now - checkedAt < UPDATE_CHECK_FLOOR_MS) return
        checkedAt = now
        void found.update().catch(() => undefined)
      }
      check()
      window.setInterval(check, UPDATE_CHECK_MS)
      window.addEventListener('online', check)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
    })
    .catch(() => undefined)
}

export const startPwa = (): void => {
  if (started || typeof window === 'undefined' || typeof navigator === 'undefined') return
  started = true
  state.installed = displayMode() === 'standalone'
  state.updated = takeUpdated()
  window.addEventListener('beforeinstallprompt', onPrompt)
  window.addEventListener('appinstalled', onInstalled)
  window.addEventListener('online', onConnection)
  window.addEventListener('offline', onConnection)
  if ('serviceWorker' in navigator) {
    const controlled = navigator.serviceWorker.controller !== null
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!controlled) return
      markUpdated()
      window.setTimeout(() => window.location.reload(), UPDATE_RELOAD_MS)
    })
  }
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
