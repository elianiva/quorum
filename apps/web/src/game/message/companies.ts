import { LogoId } from '../logos.ts'
import { Schema } from 'effect'

export const companiesCases = {
  SavesLoaded: {
    index: Schema.NullOr(Schema.String),
    now: Schema.Finite,
  },
  CompanyLoaded: {
    id: Schema.String,
    open: Schema.Boolean,
    json: Schema.NullOr(Schema.String),
  },
  CompanyUnread: { id: Schema.String, open: Schema.Boolean },
  CompanyNameChanged: { name: Schema.String },
  LogoChosen: { logo: LogoId },
  CompanyChosen: { id: Schema.String },
  CompanyClosed: {},
  CompanyOpened: { id: Schema.String },
  CompanyDeleteAsked: {},
  CompanyDeleteCancelled: {},
  CompanyDeleteConfirmed: {},
  CompanyDeleted: { id: Schema.String },
  FounderLoaded: {
    json: Schema.NullOr(Schema.String),
    deviceId: Schema.String,
    today: Schema.String,
  },
  Saved: {},
  SaveFailed: {},
  CompanyFounded: {},
  PreseedStarted: {},
}
