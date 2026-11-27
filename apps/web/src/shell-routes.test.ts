import { expect, test } from 'vitest'
import { urlToAppRoute } from './game/route.ts'
import { isAppPath } from './shell-routes.ts'

const routed = (pathname: string): boolean =>
  urlToAppRoute({ pathname, search: '' })._tag !== 'Title'

test('the Worker serves the shell for the paths the app routes, and no others', () => {
  const real = [
    '/company',
    '/settings',
    '/sandbox',
    '/challenges',
    '/sandbox/hot-key',
    '/sandbox/free',
    '/challenges/x',
    '/room/abc',
  ]
  const fake = ['/menu/settings', '/nope', '/sandbox/nope', '/room', '/settings/x', '/a/b/c']
  for (const path of real) expect([path, isAppPath(path), routed(path)]).toEqual([path, true, true])
  for (const path of fake)
    expect([path, isAppPath(path), routed(path)]).toEqual([path, false, false])
})
