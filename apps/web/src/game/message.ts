import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { accessCases } from './message/access.ts'
import { canvasCases } from './message/canvas.ts'
import { clockCases } from './message/clock.ts'
import { companiesCases } from './message/companies.ts'
import { exitCases } from './message/exit.ts'
import { incidentsCases } from './message/incidents.ts'
import { keysCases } from './message/keys.ts'
import { mirrorsCases } from './message/mirrors.ts'
import { optionsCases } from './message/options.ts'
import { paletteCases } from './message/palette.ts'
import { panelsCases } from './message/panels.ts'
import { roomCases } from './message/room.ts'
import { saveCases } from './message/save.ts'
import { sessionCases } from './message/session.ts'
import { shellCases } from './message/shell.ts'
import { teamCases } from './message/team.ts'
import { tradeoffCases } from './message/tradeoff.ts'

/** The browser's PWA state, kept inline because `platform/pwa.ts` owns the reading. */
const pwaCases = {
  /** Install, update, and connection state after a browser event. */
  PwaChanged: {
    installable: Schema.Boolean,
    installed: Schema.Boolean,
    updateReady: Schema.Boolean,
    online: Schema.Boolean,
  },
  /** The player asked to install from Settings or the title screen. */
  PwaInstallChosen: {},
  /** The browser's install dialog answered, or never opened. */
  PwaInstallOutcome: { outcome: Schema.Literals(['accepted', 'dismissed', 'unavailable']) },
  /** The player takes the waiting update. The worker activates, then the page reloads once. */
  PwaUpdateChosen: {},
  /** The title's one install prompt is done. */
  PwaPromptDismissed: {},
} as const

export const Message = defineMessageUnion({
  ...accessCases,
  ...canvasCases,
  ...clockCases,
  ...companiesCases,
  ...exitCases,
  ...incidentsCases,
  ...keysCases,
  ...mirrorsCases,
  ...optionsCases,
  ...paletteCases,
  ...panelsCases,
  ...pwaCases,
  ...roomCases,
  ...saveCases,
  ...sessionCases,
  ...shellCases,
  ...teamCases,
  ...tradeoffCases,
})

export type Message = typeof Message.Type
