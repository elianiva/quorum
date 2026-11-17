import { commands } from 'vitest/browser'
import { expect, test } from 'vitest'
import { solverReady } from '../host/browser.ts'
import { report, type Report } from './report.ts'

test('every engine ends the golden Company and every reference replay where Node does', async () => {
  await solverReady
  const node = (await (commands as unknown as { node: () => Promise<Report> }).node()) as Report
  expect(report()).toEqual(node)
}, 600_000)
