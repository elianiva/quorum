/**
 * The browser side of the PWA: install, update, connection state, and the app
 * badge. Nothing here reads the game's Model, and every browser API is
 * guarded, so tests run without a DOM.
 */

export type PwaSnapshot = Readonly<{
  installable: boolean
  installed: boolean
  updateReady: boolean
  online: boolean
}>

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

/** The install instructions a browser needs, which is its own copy in five languages. */
export type BrowserFamily =
  | 'iosSafari'
  | 'iosOther'
  | 'android'
  | 'chromium'
  | 'safariMac'
  | 'other'

export type DisplayMode = 'standalone' | 'browser'

/** An installed app is a standalone window, a fullscreen one, or a minimal-ui one. */
const INSTALLED_QUERY =
  '(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui), (display-mode: window-controls-overlay)'

/** The parts of the install and badge APIs that the DOM lib does not describe. */
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

/** A page in a standalone window, a fullscreen one, or an installed iOS app. */
export const displayModeOf = (standalone: boolean, iosStandalone: boolean): DisplayMode =>
  standalone || iosStandalone ? 'standalone' : 'browser'

export const displayMode = (): DisplayMode => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'browser'
  const standalone =
    typeof window.matchMedia === 'function' ? window.matchMedia(INSTALLED_QUERY).matches : false
  return displayModeOf(standalone, (navigator as BrowserNavigator).standalone === true)
}

/**
 * Which install instructions fit this browser. iPadOS reports a Macintosh user
 * agent, so a Mac with a touch screen counts as iOS.
 */
export const browserFamily = (
  userAgent: string,
  platform: string,
  touchPoints: number,
): BrowserFamily => {
  const ios = /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && touchPoints > 1)
  if (ios) return /(?:CriOS|FxiOS|EdgiOS|OPiOS)/.test(userAgent) ? 'iosOther' : 'iosSafari'
  if (/Android/.test(userAgent)) return /(?:Chrome|CriOS)/.test(userAgent) ? 'android' : 'other'
  if (/Chrome\/|Chromium\/|Edg\//.test(userAgent)) return 'chromium'
  // Safari on macOS adds the site from the File menu, unlike Firefox, which has no install.
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
  // Chromium shows its own mini-infobar without this. The game asks in its own words instead.
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
  // Another tab may have installed the new worker before this one loaded.
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
      // `updatefound` reaches the registration object the page asked for, which is not always the
      // one `register()` returned. A local check of `waiting` catches the worker either way.
      const checkWaiting = (): void => {
        if (!state.updateReady && found.waiting && navigator.serviceWorker.controller) {
          state.updateReady = true
          emit()
        }
      }
      checkWaiting()
      window.setInterval(checkWaiting, 10_000)
      // The browser checks on its own at most once a day. A long game session checks sooner.
      window.setInterval(
        () => {
          void found.update().catch(() => undefined)
        },
        30 * 60 * 1000,
      )
    })
    .catch(() => undefined)
}

/** Starts the listeners once. Registration is production only; dev runs without a worker. */
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
      // A first install also claims the page. Only the player's update reloads it.
      if (!reloadWanted || reloaded) return
      reloaded = true
      window.location.reload()
    })
  registerWorker()
}

/** Calls `listener` with the state now and after every change. */
export const watchPwa = (listener: (snapshot: PwaSnapshot) => void): (() => void) => {
  startPwa()
  const notify = (): void => listener(pwaSnapshot())
  listeners.add(notify)
  notify()
  return () => {
    listeners.delete(notify)
  }
}

/** Opens the browser's install dialog, if it offered one. */
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

/**
 * Asks the waiting worker to activate. The page reloads once on
 * `controllerchange`, and only because the player asked for this update.
 */
export const requestPwaUpdate = async (): Promise<void> => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  const found = registration ?? (await navigator.serviceWorker.getRegistration('/'))
  const waiting = found?.waiting
  if (!waiting) return
  reloadWanted = true
  waiting.postMessage({ type: 'SKIP_WAITING' })
}

/** The unread Inbox letters on the app icon. Clears the badge when there are none. */
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
  } catch {
    // A browser that refuses the badge keeps the count in the Inbox.
  }
}
