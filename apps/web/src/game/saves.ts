import { Effect, Schema } from 'effect'
import { MutatorId, VentureId } from '@quorum/simulation/state'
import type { Game } from '@quorum/simulation/state'
import { LogoId } from './logos.ts'

export const MAX_COMPANY_NAME = 40

const RoomLink = Schema.Struct({
  code: Schema.String,
  token: Schema.String,
  at: Schema.Finite,
})
export type RoomLink = typeof RoomLink.Type

export const CompanyFile = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  logo: LogoId,
  venture: VentureId,
  mutators: Schema.Array(MutatorId),
  createdAt: Schema.Finite,
  updatedAt: Schema.Finite,
  stage: Schema.Finite,
  users: Schema.Finite,
  time: Schema.Finite,
  online: Schema.NullOr(RoomLink).pipe(Schema.withDecodingDefaultKey(Effect.succeed(null))),
})
export type CompanyFile = typeof CompanyFile.Type

export const SaveIndex = Schema.Struct({
  current: Schema.NullOr(Schema.String),
  companies: Schema.Array(CompanyFile),
})
export type SaveIndex = typeof SaveIndex.Type

export const EMPTY_SAVE_INDEX: SaveIndex = { current: null, companies: [] }

const companyName = (name: string): string => name.trim().slice(0, MAX_COMPANY_NAME)

export const nameOr = (name: string, fallback = 'Untitled company'): string =>
  companyName(name) || fallback

export const newSaveId = (companies: ReadonlyArray<CompanyFile>, seed: number): string => {
  const base = `c${Math.abs(Math.trunc(seed)).toString(36)}`
  const used = new Set(companies.map((file) => file.id))
  if (!used.has(base)) return base
  let suffix = 2
  while (used.has(`${base}-${suffix}`)) suffix += 1
  return `${base}-${suffix}`
}

export const fileFor = (args: {
  id: string
  name: string
  logo: LogoId
  founding: Game['founding']
  game: Game
  now: number
  createdAt?: number
}): CompanyFile => ({
  id: args.id,
  name: args.name,
  logo: args.logo,
  venture: args.founding.venture,
  mutators: args.founding.mutators,
  createdAt: args.createdAt ?? args.now,
  updatedAt: args.now,
  stage: args.game.stage,
  users: args.game.users,
  time: args.game.time,
  online: null,
})

export const refreshed = (file: CompanyFile, game: Game, now: number): CompanyFile => ({
  ...file,
  updatedAt: now,
  stage: game.stage,
  users: game.users,
  time: game.time,
})

export const withFile = (index: SaveIndex, file: CompanyFile): SaveIndex => ({
  ...index,
  companies: [file, ...index.companies.filter((entry) => entry.id !== file.id)],
})

export const withoutFile = (index: SaveIndex, id: string): SaveIndex => ({
  ...index,
  current: index.current === id ? null : index.current,
  companies: index.companies.filter((entry) => entry.id !== id),
})

export const fileOf = (index: SaveIndex, id: string | null): CompanyFile | null =>
  id === null ? null : (index.companies.find((file) => file.id === id) ?? null)

export const savedIndex = (index: SaveIndex, game: Game, now: number): SaveIndex => {
  const file = fileOf(index, index.current)
  return file === null
    ? index
    : {
        ...index,
        companies: index.companies.map((entry) =>
          entry.id === file.id ? refreshed(entry, game, now) : entry,
        ),
      }
}

export const refreshedIndex = (index: SaveIndex, game: Game): SaveIndex => {
  const file = fileOf(index, index.current)
  return file === null ? index : savedIndex(index, game, file.updatedAt)
}

export const recent = (files: ReadonlyArray<CompanyFile>): ReadonlyArray<CompanyFile> =>
  [...files].sort((a, b) => b.updatedAt - a.updatedAt)
