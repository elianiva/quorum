import { describe, expect, test } from 'vitest'
import { browserFamily, displayModeOf, pwaSnapshot, startPwa } from './pwa.ts'

describe('display mode', () => {
  test('a standalone window or an installed iOS app is installed', () => {
    expect(displayModeOf(true, false)).toBe('standalone')
    expect(displayModeOf(false, true)).toBe('standalone')
    expect(displayModeOf(true, true)).toBe('standalone')
    expect(displayModeOf(false, false)).toBe('browser')
  })

  test('a page with no browser state is a browser page', () => {
    expect(pwaSnapshot()).toEqual({
      installable: false,
      installed: false,
      online: true,
      updated: false,
    })
  })
})

describe('the update marker', () => {
  test('a reload after an update reads the marker once', () => {
    const made = new Map<string, string>([['quorum.pwa.updated', '1']])
    const scope = globalThis as unknown as { window: unknown; sessionStorage: unknown }
    const priorWindow = scope.window
    const priorSession = scope.sessionStorage
    scope.window = {
      matchMedia: () => ({ matches: false }),
      addEventListener: () => undefined,
    }
    scope.sessionStorage = {
      getItem: (key: string) => made.get(key) ?? null,
      setItem: (key: string, value: string) => void made.set(key, value),
      removeItem: (key: string) => void made.delete(key),
    }
    try {
      startPwa()
      expect(pwaSnapshot().updated).toBe(true)
      expect(made.has('quorum.pwa.updated')).toBe(false)
    } finally {
      scope.window = priorWindow
      scope.sessionStorage = priorSession
    }
  })
})

describe('install instructions', () => {
  test('iPhone Safari is told about Share; another iOS browser must open Safari first', () => {
    const iphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
    const chrome =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0 Mobile/15E148 Safari/604.1'
    expect(browserFamily(iphone, 'iPhone', 5)).toBe('iosSafari')
    expect(browserFamily(chrome, 'iPhone', 5)).toBe('iosOther')
    expect(browserFamily('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 'MacIntel', 5)).toBe(
      'iosSafari',
    )
    expect(
      browserFamily(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'MacIntel',
        0,
      ),
    ).toBe('safariMac')
  })

  test('Android Chrome gets the menu, desktop Chromium the address bar, Firefox neither', () => {
    expect(
      browserFamily(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36',
        'Linux armv8l',
        5,
      ),
    ).toBe('android')
    expect(
      browserFamily(
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
        'Linux x86_64',
        0,
      ),
    ).toBe('chromium')
    expect(
      browserFamily(
        'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Linux x86_64',
        0,
      ),
    ).toBe('other')
  })
})
