const DRAWER_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
const MORPH_MS = 320
const FLIP_MS = 260
const EXIT_FALLBACK_MS = 600

type Box = Readonly<{
  top: number
  left: number
  width: number
  bottom: number
  inFlow: boolean
}>
type Size = Readonly<{ width: number; height: number }>

const media = matchMedia('(prefers-reduced-motion: reduce)')
const reduced = {
  get matches() {
    return media.matches || document.documentElement.dataset['motion'] === 'reduce'
  },
}
const keyboardDriven = (element: HTMLElement, attribute: 'morph' | 'exit' | 'flip'): boolean =>
  element.dataset[attribute] === 'gesture' &&
  document.documentElement.dataset['input'] === 'keyboard'

const sizes = new WeakMap<HTMLElement, Size>()
const morphs = new WeakMap<HTMLElement, Animation>()

const sizeOf = (element: HTMLElement): Size => ({
  width: element.offsetWidth,
  height: element.offsetHeight,
})

const morph = (element: HTMLElement): void => {
  const running = morphs.get(element)
  const animating = running?.playState === 'running'
  const from = animating ? sizeOf(element) : sizes.get(element)
  running?.cancel()
  const to = sizeOf(element)
  sizes.set(element, to)
  if (!from || reduced.matches || keyboardDriven(element, 'morph')) return
  const width = Math.abs(from.width - to.width) >= 1
  const height = Math.abs(from.height - to.height) >= 1
  if (!width && !height) return
  const frame = (size: Size): Keyframe => ({
    ...(width ? { width: `${size.width}px` } : {}),
    ...(height ? { height: `${size.height}px` } : {}),
  })
  morphs.set(
    element,
    element.animate([frame(from), frame(to)], { duration: MORPH_MS, easing: DRAWER_EASE }),
  )
}

const places = new WeakMap<HTMLElement, Readonly<{ top: number; left: number }>>()

const flip = (container: HTMLElement): void => {
  for (const child of container.children) {
    if (!(child instanceof HTMLElement) || 'exiting' in child.dataset) continue
    const old = places.get(child)
    const now = { top: child.offsetTop, left: child.offsetLeft }
    if (!old || reduced.matches || keyboardDriven(container, 'flip')) continue
    const dx = old.left - now.left
    const dy = old.top - now.top
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
    child.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], {
      duration: FLIP_MS,
      easing: DRAWER_EASE,
      composite: 'add',
    })
  }
}

const boxes = new WeakMap<HTMLElement, Box>()

const remember = (): void => {
  for (const element of document.querySelectorAll<HTMLElement>('[data-morph]'))
    if (morphs.get(element)?.playState !== 'running') sizes.set(element, sizeOf(element))
  for (const child of document.querySelectorAll<HTMLElement>('[data-flip] > *'))
    if (!('exiting' in child.dataset))
      places.set(child, { top: child.offsetTop, left: child.offsetLeft })
  for (const element of document.querySelectorAll<HTMLElement>('[data-exit]')) {
    if ('exiting' in element.dataset) continue
    const inFlow =
      boxes.get(element)?.inFlow ?? !/absolute|fixed/.test(getComputedStyle(element).position)
    const parent = element.offsetParent
    boxes.set(element, {
      top: element.offsetTop,
      left: element.offsetLeft,
      width: element.offsetWidth,
      bottom: parent ? parent.clientHeight - element.offsetTop - element.offsetHeight : 0,
      inFlow,
    })
  }
}

const exit = (element: HTMLElement, record: MutationRecord): void => {
  const box = boxes.get(element)
  const parent = record.target
  if (!box || element.isConnected || !parent.isConnected || 'exiting' in element.dataset) return
  if (keyboardDriven(element, 'exit')) return
  element.dataset['exiting'] = ''
  element.inert = true
  element.setAttribute('aria-hidden', 'true')
  if (box.inFlow)
    Object.assign(element.style, {
      position: 'absolute',
      margin: '0',
      left: `${box.left}px`,
      width: `${box.width}px`,
      ...('bottom' === element.dataset['exitAnchor']
        ? { bottom: `${box.bottom}px`, top: 'auto' }
        : { top: `${box.top}px` }),
    })
  const next = record.nextSibling?.parentNode === parent ? record.nextSibling : null
  parent.insertBefore(element, next)
  const done = () => element.remove()
  element.addEventListener('animationend', (event) => event.target === element && done())
  setTimeout(done, EXIT_FALLBACK_MS)
}

const closestElement = (node: Node, selector: string): HTMLElement | null =>
  (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>(selector) ?? null

const settle = (records: ReadonlyArray<MutationRecord>): void => {
  const morphing = new Set<HTMLElement>()
  const flipping = new Set<HTMLElement>()
  for (const record of records) {
    for (const node of record.removedNodes)
      if (node instanceof HTMLElement && 'exit' in node.dataset) exit(node, record)
    const box = closestElement(record.target, '[data-morph]')
    if (box) morphing.add(box)
    const list = closestElement(record.target, '[data-flip]')
    if (list) flipping.add(list)
  }
  for (const element of morphing) if (element.isConnected) morph(element)
  for (const element of flipping) if (element.isConnected) flip(element)
  remember()
}

export const startMotion = (root: HTMLElement): void => {
  new MutationObserver(settle).observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['class', 'style'],
  })
  addEventListener('pointerdown', remember, true)
  addEventListener('keydown', remember, true)
}
