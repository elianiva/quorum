import { Schema } from 'effect'
import { UiSchema } from '@effect/ui'

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

const pwaCases = {
  PwaChanged: {
    installable: Schema.Boolean,
    installed: Schema.Boolean,
    online: Schema.Boolean,
    updated: Schema.Boolean,
  },
  PwaInstallChosen: {},
  PwaInstallOutcome: { outcome: Schema.Literals(['accepted', 'dismissed', 'unavailable']) },
  PwaPromptDismissed: {},
} as const

export const Message = UiSchema.TaggedEnum({
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
