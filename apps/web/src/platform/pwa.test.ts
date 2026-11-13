import { describe, expect, test } from 'vitest'
import { browserFamily, displayModeOf, pwaSnapshot } from './pwa.ts'

/* The display mode and the install instructions are the two facts every PWA surface reads. */

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
      updateReady: false,
      online: true,
    })
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
    // iPadOS reports a Mac user agent; the touch points are what give it away.
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
