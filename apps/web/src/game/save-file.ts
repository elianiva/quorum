import { Option, Result, Schema } from 'effect'
import { decodeText, encodeText } from '@quorum/simulation/codec'
import { Game, NO_ENGINE_CHANGE, NO_RESHARD } from '@quorum/simulation/state'
import type { History } from './history.ts'
import type { SavedInbox } from './inbox.ts'
import type { Reveal } from './model.ts'

export const SAVE_FORMAT = 3
const FIRST_FORMAT = 1
const SECOND_FORMAT = 2

export type SaveFile = Readonly<{
  game: Game
  revealed: ReadonlyArray<Reveal>
  pending: ReadonlyArray<Reveal>
  dashboard: History
  inbox: SavedInbox
}>

export type ReadSave = Readonly<{ game: Game; file: Record<string, unknown> }>

export const saveJson = (save: SaveFile): Record<string, unknown> => ({
  format: SAVE_FORMAT,
  ...save.game,
  disclosure: { revealed: save.revealed, pending: save.pending },
  dashboard: save.dashboard,
  inbox: save.inbox,
})

const PREFIX = 'QSV1:'

const SaveText = Schema.Struct({
  format: Schema.Finite,
  save: Schema.Record(Schema.String, Schema.Unknown),
})
const decodeSaveText = Schema.decodeUnknownOption(SaveText)
const decodeGame = Schema.decodeUnknownOption(Game)

const objectOf = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null

const NOT_JSON = 'The save is not JSON.'
const NOT_COMPANY = 'The save is not a Company file.'

const migrateStudies = (file: Record<string, unknown>): Record<string, unknown> => {
  const studies = file['studies']
  if (!Array.isArray(studies)) return file
  const active = studies.flatMap((entry) => {
    const row = objectOf(entry)
    if (row === null) return []
    const phase = objectOf(row['phase'])
    return phase?.['_tag'] === 'Completed' ? [] : [row]
  })
  return {
    ...file,
    studies:
      active.length === 0
        ? { _tag: 'Empty' }
        : { _tag: 'Working', current: active[0], queued: active.slice(1) },
  }
}

const migrateServices = (file: Record<string, unknown>): Record<string, unknown> => {
  const services = file['services']
  if (!Array.isArray(services)) return file
  return {
    ...file,
    services: services.map((service) => {
      const row = objectOf(service)
      if (row === null) return service
      const migration = row['migration'] === null ? { _tag: 'Idle' } : row['migration']
      const datastore = row['datastore']
      return {
        ...row,
        migration,
        datastore:
          datastore === null || datastore === undefined
            ? { _tag: 'Auto' }
            : typeof datastore === 'string'
              ? { _tag: 'Pinned', id: datastore }
              : datastore,
      }
    }),
  }
}

const migrateQuarter = (file: Record<string, unknown>): Record<string, unknown> => {
  const quarter = file['quarter']
  if (quarter === null) return { ...file, quarter: { _tag: 'NotStarted' } }
  const row = objectOf(quarter)
  if (row === null || row['_tag'] !== undefined) return file
  return { ...file, quarter: { _tag: 'Active', ...row } }
}

const migrateIac = (file: Record<string, unknown>): Record<string, unknown> => {
  const iac = file['iac']
  if (iac === null) return { ...file, iac: { _tag: 'NotChosen' } }
  const row = objectOf(iac)
  if (row === null || row['_tag'] !== undefined) return file
  return {
    ...file,
    iac: {
      _tag: 'Chosen',
      tool: row['tool'],
      until: row['until'],
      sync: row['sync'] ?? null,
    },
  }
}

const migrateHires = (file: Record<string, unknown>): Record<string, unknown> => {
  const hires = file['hires']
  if (!Array.isArray(hires)) return file
  return {
    ...file,
    hires: hires.flatMap((entry) => {
      const row = objectOf(entry)
      if (row === null) return []
      const phase = objectOf(row['phase'])
      if (phase?.['_tag'] === 'Joined') return []
      const readyAt = typeof phase?.['readyAt'] === 'number' ? phase['readyAt'] : row['readyAt']
      return typeof readyAt === 'number'
        ? [{ id: row['id'], team: row['team'], language: row['language'], readyAt }]
        : []
    }),
  }
}

const migrateTraining = (file: Record<string, unknown>): Record<string, unknown> => {
  const training = file['training']
  const engineers = file['engineers']
  if (!Array.isArray(training) || !Array.isArray(engineers)) return file
  const courses = new Map(
    training.flatMap((entry) => {
      const row = objectOf(entry)
      return row === null ? [] : [[row['engineer'], row] as const]
    }),
  )
  const { training: _training, ...rest } = file
  return {
    ...rest,
    engineers: engineers.map((entry) => {
      const row = objectOf(entry)
      if (row === null || row['learning'] !== undefined) return entry
      const course = courses.get(row['id'])
      return course === undefined
        ? entry
        : {
            ...row,
            learning: { language: course['language'], readyAt: course['readyAt'] },
          }
    }),
  }
}

const migrateHeld = (file: Record<string, unknown>): Record<string, unknown> => {
  const backlog = file['backlog']
  if (!Array.isArray(backlog)) return file
  const since = typeof file['time'] === 'number' ? file['time'] : 0
  return {
    ...file,
    backlog: backlog.map((entry) => {
      const row = objectOf(entry)
      if (row === null) return entry
      const { held, ...rest } = row
      if (held === true && rest['block'] === undefined)
        return { ...rest, block: { _tag: 'Held', since } }
      return rest
    }),
  }
}

const migrateLegacy = (file: Record<string, unknown>): Record<string, unknown> => {
  const next: Record<string, unknown> = { ...file, format: SAVE_FORMAT }
  if (next['drill'] === null) next['drill'] = { _tag: 'Idle' }
  if (next['reshard'] === null) next['reshard'] = NO_RESHARD
  if (next['engineChange'] === null) next['engineChange'] = NO_ENGINE_CHANGE
  if (next['mirrors'] === null) next['mirrors'] = []
  return migrateHeld(
    migrateTraining(
      migrateHires(migrateIac(migrateQuarter(migrateServices(migrateStudies(next))))),
    ),
  )
}

const migrateV1 = (file: Record<string, unknown>): Record<string, unknown> => migrateLegacy(file)

const migrateIncident = (file: Record<string, unknown>): Record<string, unknown> => {
  const incident = file['incident']
  if (incident === null) return { ...file, incident: { _tag: 'Quiet' } }
  const row = objectOf(incident)
  if (row === null) return file
  if (row['_tag'] === 'Quiet' || row['_tag'] === 'Active') return file
  const phase = objectOf(row['phase'])
  const quiet = phase === null || phase['_tag'] === 'Quiet'
  return {
    ...file,
    incident: {
      _tag: 'Active',
      incident: {
        ...row,
        phase: quiet ? { _tag: 'Pending' } : row['phase'],
        severity: row['severity'] ?? 3,
        magnitude: row['magnitude'] ?? 3,
        zone: row['zone'] ?? null,
        region: row['region'] ?? null,
        causedBy: row['causedBy'] ?? null,
      },
    },
  }
}

const migrateV2 = (file: Record<string, unknown>): Record<string, unknown> => ({
  ...migrateIncident(migrateLegacy(file)),
  format: SAVE_FORMAT,
})

export const readSaveFile = (json: string): Result.Result<ReadSave, string> => {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return Result.fail(NOT_JSON)
  }
  const file = objectOf(parsed)
  if (file === null) return Result.fail(NOT_COMPANY)
  const version = file['format']
  if (version !== SAVE_FORMAT && version !== SECOND_FORMAT && version !== FIRST_FORMAT)
    return Result.fail(
      `That save is version ${String(version)}; this build reads version ${SAVE_FORMAT}.`,
    )
  const migrated =
    version === FIRST_FORMAT
      ? migrateV2(migrateV1(file))
      : version === SECOND_FORMAT
        ? migrateV2(file)
        : file
  const game = decodeGame(migrated)
  if (Option.isNone(game)) return Result.fail('The save could not be read.')
  return Result.succeed({ game: game.value, file: migrated })
}

export const encodeSave = (save: SaveFile): string =>
  encodeText(PREFIX, { format: SAVE_FORMAT, save: saveJson(save) })

export const saveFileName = (name: string): string => {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
  return `quorum-${slug || 'company'}.txt`
}

export const decodeSave = (text: string): Result.Result<string, string> => {
  const trimmed = text.trim()
  if (!trimmed.startsWith(PREFIX)) {
    const file = readSaveFile(trimmed)
    if (Result.isFailure(file))
      return Result.fail(
        file.failure === NOT_JSON || file.failure === NOT_COMPANY
          ? 'That is not a save.'
          : file.failure,
      )
    return Result.succeed(JSON.stringify(file.success.file))
  }
  const parsed = decodeSaveText(decodeText(PREFIX, trimmed))
  if (Option.isNone(parsed)) return Result.fail('That is not a save.')
  const { format, save } = parsed.value
  if (format !== SAVE_FORMAT && format !== SECOND_FORMAT && format !== FIRST_FORMAT)
    return Result.fail(
      `That save is from another version (${format}; this build reads ${SAVE_FORMAT}).`,
    )
  const read = readSaveFile(
    JSON.stringify(
      format === FIRST_FORMAT
        ? migrateV2(migrateV1(save))
        : format === SECOND_FORMAT
          ? migrateV2(save)
          : save,
    ),
  )
  if (Result.isFailure(read)) return Result.fail('That save could not be read.')
  return Result.succeed(JSON.stringify(read.success.file))
}
