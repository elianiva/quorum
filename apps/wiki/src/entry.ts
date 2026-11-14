import { startAnalytics } from './platform/analytics.ts'
import { startTheme } from './theme.ts'
import './styles.css'

/* Every page is prerendered (ADR 0009). A page with a live island starts the app at once. The home
   page is copy and links, so it starts the app on the reader's first interaction with the header:
   a reader who only reads downloads none of the app's JavaScript. */

startTheme()
startAnalytics()

const start = (() => {
  let started: Promise<void> | null = null
  return (): Promise<void> => {
    started ??= import('./app.ts').then(({ start }) => start())
    return started
  }
})()

const NEEDS_HYDRATION = '[data-needs-hydration]'
const LAZY_ISLAND = '[data-lazy-island]'

/** Starts the app on the first interaction with a control that has no server-side handler. The
    interaction waits for hydration, then replays on the control the reader touched. */
const startOnIntent = (load: () => Promise<void>): void => {
  let hydrated = false
  let loading = false
  let replay: (() => void) | null = null
  let typedValue = ''

  const controlOf = (target: EventTarget | null): HTMLElement | null =>
    target instanceof Element ? target.closest<HTMLElement>(NEEDS_HYDRATION) : null

  const find = (control: HTMLElement): HTMLElement | null => {
    if (control.isConnected) return control
    const name = control.dataset['needsHydration']
    return name === undefined
      ? null
      : document.querySelector<HTMLElement>(`[data-needs-hydration="${name}"]`)
  }

  const remember = (control: HTMLElement): void => {
    if (control instanceof HTMLInputElement) typedValue = control.value
  }

  const restoreTyped = (): void => {
    if (typedValue === '') return
    const input = document.getElementById('search')
    if (!(input instanceof HTMLInputElement)) return
    requestAnimationFrame(() => {
      input.value = typedValue
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  const finish = (): void => {
    hydrated = true
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('pointerdown', onPointerDown, true)
    document.removeEventListener('focusin', onFocusIn, true)
    document.removeEventListener('input', onInput, true)
    document.removeEventListener('keydown', onKeyDown, true)
    const pending = replay
    replay = null
    pending?.()
    restoreTyped()
  }

  const begin = (): void => {
    if (hydrated || loading) return
    loading = true
    void load()
      .then(finish)
      .catch((error: unknown) => {
        loading = false
        console.error('The wiki could not start.', error)
      })
  }

  const onClick = (event: MouseEvent): void => {
    const control = controlOf(event.target)
    if (control === null || hydrated) return
    // The server-rendered control has no Foldkit handler yet. Let hydration draw first, then
    // replay the click on the same control.
    event.preventDefault()
    event.stopImmediatePropagation()
    replay =
      control instanceof HTMLInputElement
        ? () => find(control)?.focus()
        : () => find(control)?.click()
    begin()
  }

  const onPointerDown = (event: PointerEvent): void => {
    const control = controlOf(event.target)
    if (control !== null) {
      remember(control)
      begin()
      return
    }
    if (event.target instanceof Element && event.target.closest(LAZY_ISLAND) !== null) begin()
  }

  const onFocusIn = (event: FocusEvent): void => {
    const control = controlOf(event.target)
    if (control === null) return
    remember(control)
    begin()
  }

  const onInput = (event: Event): void => {
    const control = controlOf(event.target)
    if (control === null) return
    remember(control)
    begin()
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target
    const typing =
      target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
    const shortcut = event.key === 'k' && (event.metaKey || event.ctrlKey)
    if (!shortcut && (event.key !== '/' || typing || event.metaKey || event.ctrlKey)) return
    event.preventDefault()
    replay = () =>
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          bubbles: true,
        }),
      )
    begin()
  }

  document.addEventListener('click', onClick, true)
  document.addEventListener('pointerdown', onPointerDown, true)
  document.addEventListener('focusin', onFocusIn, true)
  document.addEventListener('input', onInput, true)
  document.addEventListener('keydown', onKeyDown, true)
}

/** Starts the app when a live figure nears the viewport. A reading page's figures are below the
    fold on a phone, so a reader who never scrolls to one never pays for the Solver or the board. */
const startWhenVisible = (load: () => Promise<void>): void => {
  const islands = document.querySelectorAll(LAZY_ISLAND)
  if (islands.length === 0) return
  if (!('IntersectionObserver' in window)) {
    void load()
    return
  }
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      observer.disconnect()
      void load()
    },
    {
      threshold: 0.25,
    },
  )
  for (const island of islands) observer.observe(island)
}

const hydration = document.querySelector('[data-hydration]')?.getAttribute('data-hydration')
if (hydration === 'now' || hydration === null) void start()
else {
  startOnIntent(start)
  if (hydration === 'visible') startWhenVisible(start)
}
