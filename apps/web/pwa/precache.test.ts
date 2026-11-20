import { describe, expect, test, vi } from 'vitest'
import { excludedFromCache, precacheOf, type OutputEntry } from './precache.ts'
import { serviceWorkerSource } from './service-worker.ts'

const chunk = (fileName: string, extra: Partial<OutputEntry> = {}): OutputEntry => ({
  fileName,
  kind: 'chunk',
  ...extra,
})

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
  expect(source).toContain('self.skipWaiting()')
  expect(source).toContain("fetch(path, { cache: 'reload' })")
  expect(source).toContain("fetch(request, { cache: 'no-cache' })")
  expect(source).toContain('client.navigate(client.url)')
  expect(source).toContain("url.pathname === '/sw.js'")
  expect(source).toContain("url.pathname === '/harness.html'")
  expect(source).toContain('{ ignoreVary: true }')
})

test('install fetches every file past the HTTP cache and takes over at once', async () => {
  const source = serviceWorkerSource('abc123', ['/', '/assets/index-abc.js'])
  const listeners: Record<string, (event: unknown) => void> = {}
  const stored = new Map<string, Response>()
  const fetched: Array<{ path: string; cache: RequestCache | undefined }> = []
  let skipped = 0
  const scope = {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners[type] = listener
    },
    skipWaiting: async () => {
      skipped += 1
    },
  }
  const cachesStub = {
    open: async () => ({
      put: async (key: string, value: Response) => void stored.set(key, value),
    }),
  }
  const fetchStub = async (path: string, init?: RequestInit) => {
    fetched.push({ path, cache: init?.cache })
    return new Response(`<html>${path}</html>`)
  }
  new Function('self', 'caches', 'fetch', source)(scope, cachesStub, fetchStub)
  let done: Promise<unknown> = Promise.resolve()
  listeners.install({ waitUntil: (promise: Promise<unknown>) => (done = promise) })
  await done
  expect(fetched).toEqual([
    { path: '/', cache: 'reload' },
    { path: '/assets/index-abc.js', cache: 'reload' },
  ])
  expect(skipped).toBe(1)
  expect(await stored.get('/')?.text()).toBe('<html>/</html>')
})

const activate = async (stale: ReadonlyArray<string>) => {
  const source = serviceWorkerSource('new', ['/'])
  const listeners: Record<string, (event: unknown) => void> = {}
  const deleted: Array<string> = []
  const navigated: Array<string> = []
  let claimed = 0
  const scope = {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners[type] = listener
    },
    clients: {
      claim: async () => {
        claimed += 1
      },
      matchAll: async () => [
        {
          url: 'https://play.example/company',
          navigate: async (url: string) => {
            navigated.push(url)
            return null
          },
        },
        {
          url: 'https://play.example/',
          navigate: async (url: string) => {
            navigated.push(url)
            return null
          },
        },
      ],
    },
  }
  const cachesStub = {
    keys: async () => stale,
    delete: async (key: string) => {
      deleted.push(key)
      return true
    },
  }
  new Function('self', 'caches', source)(scope, cachesStub)
  let done: Promise<unknown> = Promise.resolve()
  listeners.activate({ waitUntil: (promise: Promise<unknown>) => (done = promise) })
  await vi.runAllTimersAsync()
  await done
  return { deleted, claimed, navigated }
}

test('activate deletes the old cache and navigates the windows that still run it', async () => {
  vi.useFakeTimers()
  try {
    const result = await activate(['quorum-old', 'quorum-new', 'other'])
    expect(result.deleted).toEqual(['quorum-old'])
    expect(result.claimed).toBe(1)
    expect(result.navigated).toEqual(['https://play.example/company', 'https://play.example/'])
  } finally {
    vi.useRealTimers()
  }
})

test('a first install claims the page without navigating it', async () => {
  vi.useFakeTimers()
  try {
    const result = await activate(['other'])
    expect(result.deleted).toEqual([])
    expect(result.claimed).toBe(1)
    expect(result.navigated).toEqual([])
  } finally {
    vi.useRealTimers()
  }
})

test('a navigation reads the network first and updates the stored shell', async () => {
  const source = serviceWorkerSource('abc123', ['/'])
  const listeners: Record<string, (event: unknown) => void> = {}
  const stored = new Map<string, Response>([['/', new Response('<html>old</html>')]])
  const cachesStub = {
    match: async (key: string) => stored.get(key),
    open: async () => ({
      put: async (key: string, value: Response) => void stored.set(key, value),
    }),
  }
  let asked: { url: string; cache: RequestCache | undefined } | null = null
  const fetchStub = async (request: Request, init?: RequestInit) => {
    asked = { url: request.url, cache: init?.cache }
    return new Response('<html>new</html>')
  }
  const scope = {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners[type] = listener
    },
    location: { origin: 'https://play.example' },
  }
  new Function('self', 'caches', 'fetch', source)(scope, cachesStub, fetchStub)
  let answered: Promise<Response> = Promise.resolve(new Response())
  listeners.fetch({
    request: { method: 'GET', mode: 'navigate', url: 'https://play.example/company' },
    respondWith: (promise: Promise<Response>) => (answered = promise),
  })
  const response = await answered
  expect(await response.text()).toBe('<html>new</html>')
  expect(asked).toEqual({ url: 'https://play.example/company', cache: 'no-cache' })
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(await stored.get('/')?.text()).toBe('<html>new</html>')
})

test('a navigation falls back to the stored shell when the network fails', async () => {
  const source = serviceWorkerSource('abc123', ['/'])
  const listeners: Record<string, (event: unknown) => void> = {}
  const cachesStub = {
    match: async (key: string) => (key === '/' ? new Response('<html>cached</html>') : undefined),
  }
  const fetchStub = async () => {
    throw new Error('offline')
  }
  const scope = {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      listeners[type] = listener
    },
    location: { origin: 'https://play.example' },
  }
  new Function('self', 'caches', 'fetch', source)(scope, cachesStub, fetchStub)
  let answered: Promise<Response> = Promise.resolve(new Response())
  listeners.fetch({
    request: { method: 'GET', mode: 'navigate', url: 'https://play.example/company' },
    respondWith: (promise: Promise<Response>) => (answered = promise),
  })
  expect(await (await answered).text()).toBe('<html>cached</html>')
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
    skipWaiting: async () => undefined,
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
