import { describe, expect, test } from 'vitest'
import { excludedFromCache, precacheOf, type OutputEntry } from './precache.ts'
import { serviceWorkerSource } from './service-worker.ts'

const chunk = (fileName: string, extra: Partial<OutputEntry> = {}): OutputEntry => ({
  fileName,
  kind: 'chunk',
  ...extra,
})

/* The install list is the difference between an offline game and a blank page. */

describe('the service worker install list', () => {
  const outputs: ReadonlyArray<OutputEntry> = [
    chunk('assets/index-abc.js', {
      isEntry: true,
      imports: ['assets/brand-xyz.js', 'assets/plural-xyz.js'],
    }),
    chunk('assets/brand-xyz.js'),
    chunk('assets/plural-xyz.js', { imports: ['assets/brand-xyz.js'] }),
    { fileName: 'assets/index-def.css', kind: 'asset' },
    { fileName: 'assets/compute.worker-ghi.js', kind: 'asset' },
    { fileName: 'assets/solver-yza.wasm', kind: 'asset' },
    chunk('assets/es-jkl.js', { moduleIds: ['/repo/apps/web/src/i18n/es/index.ts'] }),
    chunk('assets/fr-mno.js', { moduleIds: ['/repo/apps/web/src/i18n/fr/index.ts'] }),
    chunk('assets/ja-pqr.js', { moduleIds: ['/repo/apps/web/src/i18n/ja/index.ts'] }),
    chunk('assets/zh-CN-stu.js', { moduleIds: ['/repo/apps/web/src/i18n/zh-CN/index.ts'] }),
    chunk('assets/posthog-vwx.js'),
    { fileName: 'assets/geist-xyz.woff2', kind: 'asset' },
  ]

  const publicFiles = [
    'manifest.webmanifest',
    'favicon.svg',
    'apple-touch-icon.png',
    'icon-192.png',
    'icon-512.png',
    'icon-96.png',
    'icon-maskable-192.png',
    'icon-maskable-512.png',
    'icon-monochrome.png',
    'og.png',
    'harness.html',
    'harness/board.json',
    'art/server.svg',
    'fonts/Geist.woff2',
    'screenshots/title.png',
    'splash/iphone.png',
    'robots.txt',
  ]

  test('keeps the shell, every code chunk, the compute worker, the Solver, the manifest, the icons, and fonts', () => {
    expect(precacheOf(outputs, publicFiles)).toEqual([
      '/',
      '/apple-touch-icon.png',
      '/assets/brand-xyz.js',
      '/assets/compute.worker-ghi.js',
      '/assets/es-jkl.js',
      '/assets/fr-mno.js',
      '/assets/geist-xyz.woff2',
      '/assets/index-abc.js',
      '/assets/index-def.css',
      '/assets/ja-pqr.js',
      '/assets/plural-xyz.js',
      '/assets/posthog-vwx.js',
      '/assets/solver-yza.wasm',
      '/assets/zh-CN-stu.js',
      '/favicon.svg',
      '/fonts/Geist.woff2',
      '/icon-192.png',
      '/icon-512.png',
      '/icon-96.png',
      '/icon-maskable-192.png',
      '/icon-maskable-512.png',
      '/icon-monochrome.png',
      '/manifest.webmanifest',
    ])
  })

  test('leaves art, og.png, the harness, screenshots, and splash out', () => {
    const list = precacheOf(outputs, publicFiles)
    for (const path of list) {
      expect(path).not.toMatch(/^\/(?:art|harness|splash|screenshots)\//)
      expect(path).not.toBe('/og.png')
      expect(path).not.toBe('/harness.html')
    }
  })

  test('the art, og.png, the harness, and the worker itself are never precached', () => {
    expect(excludedFromCache('index.html')).toBe(false)
    expect(excludedFromCache('og.png')).toBe(true)
    expect(excludedFromCache('/harness.html')).toBe(true)
    expect(excludedFromCache('art/server.svg')).toBe(true)
    expect(excludedFromCache('sw.js')).toBe(true)
  })
})

test('the worker carries its build ID and install list', () => {
  const source = serviceWorkerSource('abc123', ['/', '/assets/index-abc.js'])
  expect(source).toContain("const BUILD = 'abc123'")
  expect(source).toContain("const CACHE = 'quorum-' + BUILD")
  expect(source).toContain('["/","/assets/index-abc.js"]')
  expect(source).toContain(
    "if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()",
  )
  expect(source).toContain("url.pathname === '/sw.js'")
  expect(source).toContain("url.pathname === '/harness.html'")
  // A static response can carry Vary: Origin, while the precache was fetched without one.
  expect(source).toContain('{ ignoreVary: true }')
})

test('the worker caches the shell at / and strips redirects from what it stores', async () => {
  const source = serviceWorkerSource('abc123', ['/'])
  expect(source).not.toContain('/index.html')
  const listeners: Record<string, (event: unknown) => void> = {}
  const stored = new Map<string, Response>()
  const redirected = Object.defineProperty(new Response('<html></html>'), 'redirected', {
    value: true,
  })
  const scope = {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners[type] = listener
    },
  }
  const cachesStub = {
    open: async () => ({ put: async (k: string, v: Response) => void stored.set(k, v) }),
  }
  new Function('self', 'caches', 'fetch', source)(scope, cachesStub, async () => redirected)
  let done: Promise<unknown> = Promise.resolve()
  listeners.install({ waitUntil: (p: Promise<unknown>) => (done = p) })
  await done
  const shell = stored.get('/')
  expect(shell?.redirected).toBe(false)
  expect(await shell?.text()).toBe('<html></html>')
})
