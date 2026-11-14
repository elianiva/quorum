import { ForesightManager } from 'js.foresight'
import { loadProse, needsProse } from './content.ts'
import { routeOf } from './main.ts'

/* A click on a wiki link waits for the next page's prose and renderers (main.ts, Navigate). This
   loads them when the reader is heading for the link: the cursor's trajectory, a Tab stop away, a
   touch, or the link scrolling into view. Loading a page twice is free, so a late guess costs
   nothing. Foresight skips readers on a data saver or a slow connection. */

const LINKS = 'a[href^="/"]:not([target])'

const registered = new Map<HTMLAnchorElement, () => void>()

const register = (link: HTMLAnchorElement): void => {
  const target = new URL(link.href, window.location.href)
  if (target.origin !== window.location.origin) return
  const here = routeOf(window.location.pathname)
  const there = routeOf(target.pathname)
  if (there.locale !== here.locale || there.path === here.path) return
  if (!needsProse(there.locale, there.path)) return
  const { unregister } = ForesightManager.instance.register({
    element: link,
    name: there.path,
    callback: () => loadProse(there.locale, there.path).catch(() => undefined),
  })
  registered.set(link, unregister)
}

const sync = (): void => {
  for (const [link, unregister] of registered)
    if (!link.isConnected) {
      unregister()
      registered.delete(link)
    }
  for (const link of document.querySelectorAll<HTMLAnchorElement>(LINKS))
    if (!registered.has(link)) register(link)
}

/** Watches the page, which Foldkit patches on every navigation, so each new link is registered. */
export const startPrefetch = (): void => {
  let queued = false
  new MutationObserver(() => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      sync()
    })
  }).observe(document.body, { childList: true, subtree: true })
  sync()
}
