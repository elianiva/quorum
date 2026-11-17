import { ForesightManager } from 'js.foresight'
import { loadProse, needsProse } from './content.ts'
import { routeOf } from './main.ts'

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
