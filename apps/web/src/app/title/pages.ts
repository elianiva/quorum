import { Component, Mount } from '@effect/ui'
import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { css, cx } from '@quorum/styled-system/css'
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Download,
  Lock,
  Trash2,
  Upload,
  type IconNode,
} from 'lucide'
import { Effect } from 'effect'
import {
  ACHIEVEMENT_IDS,
  ERAS,
  MUTATORS,
  MUTATOR_IDS,
  PERKS,
  PERK_IDS,
  VENTURES,
  VENTURE_IDS,
} from '@quorum/simulation/catalog'
import { CHALLENGES, dailyDrill } from '@quorum/simulation/challenges'
import { levelOf, perkPrice, foundingOf } from '@quorum/simulation/founder'
import { legacyMultiplier, startEra } from '@quorum/simulation/founding'
import { SANDBOX_IDS, TRACKS, sandboxOpen } from '@quorum/simulation/sandbox'
import { clock, compact, money, ms } from '@quorum/ui/game/format'
import { MAX_COMPANY_NAME, nameOr, recent, fileOf, type CompanyFile } from '../../game/saves.ts'
import { savesOf } from '../../game/saves-machine.ts'
import { LOGOS, logoOf, type LogoId } from '../../game/logos.ts'
import { pwaInstalled, pwaInstallable } from '../../game/pwa-machine.ts'
import { browserFamilyOf, onIos } from '../../platform/pwa.ts'
import { localized, type Messages } from '../../i18n/messages.ts'
import type { Locale } from '../../i18n/index.ts'
import { supportedLocales } from '../../i18n/index.ts'
import * as S from '../../game/title-styles.ts'
import { buttonClass } from '../ui/button-styles.ts'
import { icon } from '../ui/icon.ts'
import { TitleMessage, type MenuChoice, type MenuPage } from './messages.ts'
import type { CurrentCompany, FoundStep, SettingsSection, TitleModel } from './model.ts'

export type Page = MenuPage | 'main' | 'save' | 'setting'

const CTA = buttonClass('default', 'lg', S.CTA)
const OUTLINE = buttonClass('outline', 'lg', S.CTA)

const wordmark = <Msg>(h: H<Msg>): View.Content<Msg> => {
  const glyphs: ReadonlyArray<{ at: number; paths: ReadonlyArray<string> }> = [
    { at: 0, paths: ['M89 11V150', 'M50 11a39 39 0 1 0 0.01 0'] },
    { at: 120, paths: ['M11 0V50a39 39 0 0 0 78 0', 'M89 0V100'] },
    { at: 240, paths: ['M50 11a39 39 0 1 0 0.01 0'] },
    { at: 360, paths: ['M11 0V100', 'M11 50a39 39 0 0 1 39-39H60'] },
    { at: 440, paths: ['M11 0V50a39 39 0 0 0 78 0', 'M89 0V100'] },
    {
      at: 560,
      paths: ['M11 0V100', 'M11 45a34.5 34.5 0 0 1 69 0V100', 'M80 45a34.5 34.5 0 0 1 69 0V100'],
    },
  ]
  return h.svg
    .class(cx(S.MARK, 'is-hero'))
    .attr('viewBox', '0 0 720 194')
    .attr('role', 'img')
    .attr('aria-label', 'Quorum')
    .children(
      ...glyphs.flatMap(({ at, paths }, letter) =>
        paths.map((d) =>
          h.path
            .attr('d', d)
            .attr('transform', `translate(${at} 0)`)
            .attr('pathLength', '1')
            .style({ '--i': `${letter}` })
            .children(),
        ),
      ),
      h.circle.attr('cx', '89').attr('cy', '180').attr('r', '14').children(),
    )
}

const companyMark = (
  logo: LogoId,
  className: string,
  h: H<TitleMessage>,
): View.Content<TitleMessage> => {
  const def = logoOf(logo)
  return h.svg
    .attr('viewBox', '0 0 24 24')
    .attr('aria-hidden', 'true')
    .class(className)
    .style({ color: `oklch(0.8 0.15 ${def.hue})` })
    .children(
      ...def.paths.map((d) =>
        h.path
          .attr('d', d)
          .attr('fill', 'none')
          .attr('stroke', 'currentColor')
          .attr('stroke-width', '1.9')
          .attr('stroke-linecap', 'round')
          .attr('stroke-linejoin', 'round')
          .children(),
      ),
    )
}

const glyph = (node: IconNode, h: H<TitleMessage>): View.Content<TitleMessage> =>
  icon(h, node, S.ICON)

type Line = Readonly<{
  key: string
  label: string
  detail?: string | undefined
  figure?: View.Content<TitleMessage> | string | undefined
  lead?: View.Content<TitleMessage> | undefined
  message: TitleMessage | null
  hotkey?: number | undefined
  first?: boolean | undefined
  danger?: boolean | undefined
  pick?: 'radio' | 'checkbox' | undefined
  checked?: boolean | undefined
  index?: number | undefined
  branch?: boolean | undefined
  open?: boolean | undefined
}>

const line = (h: H<TitleMessage>, r: Line): View.Content<TitleMessage> => {
  const message = r.message
  const button = h.button
    .key(r.key)
    .attr('type', 'button')
    .attr('data-nav', '')
    .attr('data-key', r.key)
    .attr('data-first', r.first ? '' : undefined)
    .attr('data-branch', r.branch ? '' : undefined)
    .attr('data-hotkey', r.hotkey === undefined ? undefined : `${r.hotkey}`)
    .attr('aria-keyshortcuts', r.hotkey === undefined ? undefined : `${r.hotkey}`)
    .attr('role', r.pick)
    .attr('aria-checked', r.pick === undefined ? undefined : r.checked === true ? 'true' : 'false')
    .attr('aria-disabled', message === null ? 'true' : undefined)
    .style({ '--i': `${r.index ?? 0}` })
    .class(
      cx(
        S.LINE,
        r.danger && 'is-danger',
        r.open && 'is-open',
        !r.hotkey && !r.pick && !r.lead && 'is-bare',
      ),
    )
  const clickable = message === null ? button : button.on('click', () => message)
  return clickable.children(
    r.hotkey !== undefined
      ? h.span.class(S.NUM).attr('aria-hidden', 'true').children(`${r.hotkey}`.padStart(2, '0'))
      : r.pick !== undefined
        ? h.span
            .class(cx(S.TICK, `is-${r.pick}`))
            .attr('aria-hidden', 'true')
            .children(r.checked === true ? glyph(Check, h) : null)
        : (r.lead ?? null),
    h.span
      .class(S.TEXT)
      .children(
        h.span.class(S.LABEL).children(r.label),
        r.detail === undefined ? null : h.span.class(S.DETAIL).children(r.detail),
      ),
    r.figure === undefined ? null : h.span.class(S.FIGURE).children(r.figure),
  )
}

const record = (
  h: H<TitleMessage>,
  r: Readonly<{ key: string; label: string; detail: string; figure: string }>,
): View.Content<TitleMessage> =>
  h.li
    .key(r.key)
    .attr('tabindex', '-1')
    .attr('data-nav', '')
    .attr('data-key', r.key)
    .class(cx(S.LINE, 'is-record is-bare'))
    .children(
      h.span
        .class(S.TEXT)
        .children(
          h.span.class(S.LABEL).children(r.label),
          h.span.class(S.DETAIL).children(r.detail),
        ),
      h.span.class(S.FIGURE).children(r.figure),
    )

type TileState = 'done' | 'next' | 'open' | 'locked'

const tile = (
  h: H<TitleMessage>,
  t: Messages,
  r: Readonly<{
    key: string
    label: string
    detail?: string | undefined
    figure?: string | undefined
    state?: TileState | undefined
    message?: TitleMessage | undefined
    pick?: 'radio' | 'checkbox' | undefined
    checked?: boolean | undefined
    mark?: View.Content<TitleMessage> | undefined
  }>,
): View.Content<TitleMessage> => {
  const state = r.state ?? 'open'
  const message = r.message
  const button = h.button
    .key(r.key)
    .attr('type', 'button')
    .attr('data-nav', '')
    .attr('data-key', r.key)
    .attr('data-first', state === 'next' ? '' : undefined)
    .attr('aria-disabled', message === undefined ? 'true' : undefined)
    .attr('role', r.pick)
    .attr('aria-checked', r.pick === undefined ? undefined : r.checked === true ? 'true' : 'false')
    .attr(
      'aria-description',
      state === 'done' ? t.title.earned : state === 'locked' ? t.title.notYet : undefined,
    )
    .class(cx(S.TILE, `is-${state}`, r.checked === true && 'is-on'))
  const clickable = message === undefined ? button : button.on('click', () => message)
  return clickable.children(
    h.span.class(S.TILE_HEAD).children(
      r.mark ?? null,
      h.span.class(S.TILE_NAME).children(r.label),
      h.span
        .class(S.TILE_STATE)
        .attr('aria-hidden', 'true')
        .children(
          r.pick !== undefined
            ? h.span
                .class(cx(S.TICK, `is-${r.pick}`))
                .children(r.checked === true ? glyph(Check, h) : null)
            : state === 'done'
              ? glyph(Check, h)
              : state === 'locked'
                ? glyph(Lock, h)
                : state === 'next'
                  ? glyph(ChevronRight, h)
                  : null,
        ),
    ),
    r.detail === undefined ? null : h.span.class(S.TILE_DETAIL).children(r.detail),
    r.figure === undefined ? null : h.span.class(S.TILE_FIGURE).children(r.figure),
  )
}

const section = (
  h: H<TitleMessage>,
  title: string,
  body: ReadonlyArray<View.Content<TitleMessage>>,
  grid = false,
): View.Content<TitleMessage> =>
  h.section
    .key(`section-${title}`)
    .class(S.SECTION)
    .children(
      h.h2.class(S.EYEBROW).children(title),
      h.div
        .class(grid ? S.GRID : S.BUS)
        .attr('data-grid', grid ? '' : undefined)
        .children(...body),
    )

const note = (h: H<TitleMessage>, text: string): View.Content<TitleMessage> =>
  h.p.key(`note-${text}`).class(S.NOTE).children(text)

const clamp = (value: number): number => Math.min(100, Math.max(0, value))

const progressBar = (
  h: H<TitleMessage>,
  value: number,
  label: string,
): View.Content<TitleMessage> => {
  const shown = clamp(value)
  return h.div
    .class(cx(css({ display: 'flex', flexWrap: 'wrap', gap: '3' }), S.FULL))
    .attr('role', 'progressbar')
    .attr('aria-label', label)
    .attr('aria-valuemin', '0')
    .attr('aria-valuemax', '100')
    .attr('aria-valuenow', `${shown}`)
    .children(
      h.span
        .class(css({ fontSize: 'type.14', lineHeight: 'fine', fontWeight: 'medium' }))
        .children(label),
      h.span
        .class(
          css({
            color: 'mutedForeground',
            marginLeft: 'auto',
            fontSize: 'type.14',
            lineHeight: 'fine',
            fontVariantNumeric: 'tabular-nums',
          }),
        )
        .children(`${shown}%`),
      h.div
        .class(
          css({
            backgroundColor: 'well',
            boxShadow: 'well',
            height: '1.5',
            borderRadius: 'full',
            position: 'relative',
            display: 'flex',
            width: '100%',
            alignItems: 'center',
            overflowX: 'hidden',
          }),
        )
        .children(
          h.div
            .class(
              css({
                layerStyle: 'primaryFill',
                borderRadius: 'full',
                boxShadow: 'highlightTop',
                height: '100%',
                width: '100%',
                transitionProperty: 'all',
                transitionDuration: 'fast',
                transitionTimingFunction: 'out',
              }),
            )
            .attr('data-slot', 'progress-indicator')
            .style({ transform: `translateX(-${100 - shown}%)` })
            .children(),
        ),
    )
}

/* ==========================================================================
   Main page
   ========================================================================== */

const lastFile = (model: TitleModel): CompanyFile | null => {
  const index = savesOf(model.saves)
  return fileOf(index, index.lastPlayed)
}

const vital = (h: H<TitleMessage>, label: string, value: string, extra = '') =>
  h.div
    .class(S.VITAL)
    .children(
      h.dt.children(label),
      h.dd.children(value, extra === '' ? null : h.span.class(S.VITAL_OF).children(extra)),
    )

const currentOrFile = (
  model: TitleModel,
  file: CompanyFile,
): Readonly<{
  current: CurrentCompany | null
  stage: number
  eraRaiseAt: number
  apdexTarget: number
}> => {
  const current = model.current?.id === file.id ? model.current : null
  const stage = current?.stage ?? file.stage
  const era = ERAS[Math.min(stage, ERAS.length - 1)]!
  return {
    current,
    stage,
    eraRaiseAt: era.raiseAt,
    apdexTarget: era.apdexTarget,
  }
}

const readout = (
  h: H<TitleMessage>,
  model: TitleModel,
  file: CompanyFile,
  t: Messages,
): View.Content<TitleMessage> => {
  const { current, stage, eraRaiseAt, apdexTarget } = currentOrFile(model, file)
  const eraName = t.catalog.eras[Math.min(stage, t.catalog.eras.length - 1)]?.name ?? ''
  const time = current?.time ?? file.time
  const share = current === null ? 0 : Math.round(Math.min(1, current.users / eraRaiseAt) * 100)
  return h.section
    .class(S.READOUT)
    .attr('aria-label', file.name)
    .children(
      h.div
        .class(S.READOUT_HEAD)
        .children(
          companyMark(file.logo, S.LOGO, h),
          h.div
            .class(S.READOUT_TITLE)
            .children(
              h.span.class(S.READOUT_NAME).children(file.name),
              h.span.class(S.READOUT_ERA).children(`${eraName} · ${clock(time)}`),
            ),
        ),
      current === null ? null : progressBar(h, share, eraName),
      current === null
        ? null
        : h.dl
            .class(S.VITALS)
            .children(
              vital(h, t.hud.cash, money(current.cash)),
              vital(h, t.hud.users, compact(current.users)),
              vital(h, 'Apdex', current.apdex.toFixed(2), ` / ${apdexTarget.toFixed(2)}`),
              vital(h, t.hud.latency, ms(current.latency)),
            ),
      h.button
        .class(CTA)
        .attr('type', 'button')
        .attr('data-nav', '')
        .attr('data-key', 'continue')
        .attr('data-first', '')
        .on('click', () => TitleMessage.Continued())
        .children(h.span.children(t.title.continueText), glyph(ChevronRight, h)),
    )
}

const firstRun = (h: H<TitleMessage>, t: Messages, open: boolean) =>
  h.section.class(cx(S.READOUT, 'is-empty')).children(
    h.button
      .class(cx(CTA, open && 'is-open'))
      .attr('type', 'button')
      .attr('data-nav', '')
      .attr('data-key', 'start')
      .attr('data-first', '')
      .attr('data-branch', '')
      .on('click', () => TitleMessage.MenuChosen({ menu: 'found' }))
      .children(h.span.children(t.title.startACompany), glyph(ChevronRight, h)),
  )

const notices = (
  model: TitleModel,
  t: Messages,
  h: H<TitleMessage>,
): ReadonlyArray<View.Content<TitleMessage>> => {
  if (pwaInstalled(model.pwa) || model.prefs.pwaPromptSeen) return []
  if (savesOf(model.saves).companies.length === 0) return []
  const installable = pwaInstallable(model.pwa)
  const rows: Array<View.Content<TitleMessage>> = [
    line(h, {
      key: 'pwa-install',
      label: t.pwa.installQuorum,
      detail: installable ? t.pwa.installPrompt : t.pwa.installHelp[browserFamilyOf()],
      figure: glyph(Download, h),
      message: installable ? TitleMessage.PwaInstallChosen() : null,
    }),
  ]
  if (onIos()) rows.push(note(h, t.pwa.moveNote))
  rows.push(
    line(h, {
      key: 'pwa-not-now',
      label: t.pwa.notNow,
      message: TitleMessage.PwaPromptDismissed(),
    }),
  )
  return [section(h, t.pwa.app, rows)]
}

const mainIndex = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: Messages,
): View.Content<TitleMessage> => {
  const file = lastFile(model)
  const count = savesOf(model.saves).companies.length
  const passed = SANDBOX_IDS.filter((id) => model.passed.includes(id)).length
  const solved = CHALLENGES.filter((entry) => model.founder.completed.includes(entry.id)).length
  let n = 0
  const next = () => ++n
  const to = (menu: MenuPage) => ({
    message: TitleMessage.MenuChosen({ menu }),
    branch: true,
    open: false,
  })
  const company = [
    ...(file === null
      ? []
      : [
          line(h, {
            key: 'new',
            label: t.title.newCompany,
            ...to('found'),
            hotkey: next(),
          }),
        ]),
    line(h, {
      key: 'import',
      label: t.title.importACompany,
      message: TitleMessage.CompanyFileAsked(),
      hotkey: next(),
    }),
    ...(count > 0
      ? [
          line(h, {
            key: 'companies',
            label: t.title.companies,
            figure: `${count}`,
            ...to('companies'),
            hotkey: next(),
          }),
        ]
      : []),
  ]
  const practice = [
    line(h, {
      key: 'sandbox',
      label: t.title.sandbox,
      figure: `${passed}/${SANDBOX_IDS.length}`,
      ...to('sandbox'),
      hotkey: next(),
    }),
    line(h, {
      key: 'challenges',
      label: t.title.challenges,
      figure: `${solved}/${CHALLENGES.length}`,
      ...to('challenges'),
      hotkey: next(),
    }),
  ]
  const founder = [
    line(h, {
      key: 'achievements',
      label: t.title.achievements,
      figure: `${model.founder.achievements.length}/${ACHIEVEMENT_IDS.length}`,
      ...to('achievements'),
      hotkey: next(),
    }),
    line(h, {
      key: 'legacy',
      label: t.title.legacyShop,
      figure: `${model.founder.legacy}`,
      ...to('legacy'),
      hotkey: next(),
    }),
    line(h, {
      key: 'history',
      label: t.title.history,
      figure: `${model.founder.history.length}`,
      ...to('history'),
      hotkey: next(),
    }),
  ]
  const system = [
    line(h, {
      key: 'settings',
      label: t.title.settings,
      ...to('settings'),
      hotkey: next(),
    }),
  ]
  return h.nav
    .class(S.INDEX)
    .attr('aria-label', t.title.mainMenu)
    .children(
      ...notices(model, t, h),
      section(h, t.title.company, company),
      section(h, t.title.practice, practice),
      section(h, t.title.founder, founder),
      section(h, t.title.system, system),
    )
}

export const mainPage = (
  h: H<TitleMessage>,
  model: TitleModel,
  menu: MenuChoice,
  t: Messages,
): View.Content<TitleMessage> => {
  const file = lastFile(model)
  return h.div
    .class(S.MAIN)
    .children(
      h.div
        .class(S.HERO)
        .children(
          h.h1.class(S.HERO_TITLE).children(wordmark(h)),
          file === null ? firstRun(h, t, menu === 'found') : readout(h, model, file, t),
        ),
      mainIndex(h, model, t),
    )
}

/* ==========================================================================
   Companies and their save
   ========================================================================== */

const dateOf = (file: CompanyFile): string =>
  new Date(file.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

const fileLine = (file: CompanyFile, t: Messages): string =>
  `${t.catalog.ventures[file.venture].name} · ${t.title.eraUsersTime(t.catalog.eras[file.stage]?.name ?? '', compact(file.users), clock(file.time))}`

const companiesBody = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: Messages,
): ReadonlyArray<View.Content<TitleMessage>> => {
  const index = savesOf(model.saves)
  const rows: Array<View.Content<TitleMessage>> = []
  if (index.companies.length === 0) rows.push(note(h, t.title.noCompaniesSavedYet))
  rows.push(
    h.div
      .key('company-list')
      .class(S.BUS)
      .children(
        line(h, {
          key: 'import',
          label: t.title.importACompany,
          figure: glyph(ChevronRight, h),
          message: TitleMessage.CompanyFileAsked(),
        }),
        ...recent(index.companies).map((file, at) =>
          line(h, {
            key: file.id,
            lead: companyMark(file.logo, S.LOGO_SMALL, h),
            label: file.name,
            detail: fileLine(file, t),
            figure:
              file.online !== null
                ? `${t.room.onlineMark} · ${file.online.code}`
                : file.id === index.lastPlayed
                  ? t.title.current
                  : dateOf(file),
            message: TitleMessage.CompanyChosen({ id: file.id }),
            branch: true,
            open: model.saveFocus === file.id,
            index: at,
          }),
        ),
      ),
  )
  return rows
}

const saveBody = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: Messages,
): ReadonlyArray<View.Content<TitleMessage>> => {
  const index = savesOf(model.saves)
  const file = index.companies.find((entry) => entry.id === model.saveFocus)
  if (file === undefined) return []
  const isCurrent = file.id === index.lastPlayed
  const started = new Date(file.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return [
    h.div
      .class(S.FILE)
      .children(
        companyMark(file.logo, S.LOGO_LARGE, h),
        h.dl
          .class(cx(S.VITALS, 'is-file'))
          .children(
            h.div
              .class(S.VITAL)
              .children(
                h.dt.children(t.title.venture),
                h.dd.children(t.catalog.ventures[file.venture].name),
              ),
            h.div
              .class(S.VITAL)
              .children(h.dt.children(t.hud.users), h.dd.children(compact(file.users))),
            h.div
              .class(S.VITAL)
              .children(h.dt.children(t.title.mutators), h.dd.children(`${file.mutators.length}`)),
          ),
      ),
    h.div.class(S.BUS).children(
      line(h, {
        key: 'open',
        label: isCurrent ? t.title.continueText : t.title.openCompany,
        detail: `${t.catalog.eras[file.stage]?.name ?? ''} · ${clock(file.time)} · ${t.title.started(started)}`,
        figure: glyph(ChevronRight, h),
        message: TitleMessage.CompanyOpened({ id: file.id }),
        first: true,
      }),
      ...(model.saveConfirm._tag === 'Confirming'
        ? [
            line(h, {
              key: 'delete-yes',
              label: t.title.deleteForever,
              detail: t.title.theCompanyAndItsDesignAre,
              figure: glyph(Trash2, h),
              message: TitleMessage.CompanyDeleteConfirmed(),
              danger: true,
            }),
            line(h, {
              key: 'delete-no',
              label: t.title.keepCompany,
              message: TitleMessage.CompanyDeleteCancelled(),
            }),
          ]
        : [
            line(h, {
              key: 'delete',
              label: t.title.deleteCompany,
              figure: glyph(Trash2, h),
              message: TitleMessage.CompanyDeleteAsked(),
            }),
          ]),
    ),
  ]
}

/* ==========================================================================
   Practice
   ========================================================================== */

const sandboxBody = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: Messages,
): ReadonlyArray<View.Content<TitleMessage>> => {
  const next = SANDBOX_IDS.find((id) => !model.passed.includes(id) && sandboxOpen(id, model.passed))
  return [
    ...TRACKS.map((track) => {
      const passed = track.sandboxes.filter((id) => model.passed.includes(id)).length
      return section(
        h,
        `${t.catalog.eras[track.stage]?.name ?? ''} · ${passed}/${track.sandboxes.length}`,
        track.sandboxes.map((id) => {
          const open = sandboxOpen(id, model.passed)
          return tile(h, t, {
            key: id,
            label: t.catalog.guided[id].name,
            detail: t.catalog.guided[id].objectives[0]?.goal,
            state: model.passed.includes(id)
              ? 'done'
              : id === next
                ? 'next'
                : open
                  ? 'open'
                  : 'locked',
            message: open ? TitleMessage.GuidedStarted({ id }) : undefined,
          })
        }),
        true,
      )
    }),
    h.div
      .key('free')
      .class(S.BUS)
      .children(
        line(h, {
          key: 'free',
          label: t.title.freeSandbox,
          figure: glyph(ChevronRight, h),
          message: TitleMessage.FreeSandboxStarted(),
        }),
      ),
  ]
}

const challengesBody = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: Messages,
): ReadonlyArray<View.Content<TitleMessage>> => {
  const done = model.founder.completed
  const drill = model.today === '' ? null : dailyDrill(model.today)
  const challenge = (id: string, label: string, detail: string, legacy: number) =>
    line(h, {
      key: id,
      label,
      detail,
      figure: done.includes(id) ? glyph(Check, h) : legacy > 0 ? t.title.legacy(legacy) : undefined,
      message: TitleMessage.ChallengeStarted({ id }),
    })
  return [
    ...(drill === null
      ? []
      : [
          section(h, t.title.dailyDrill, [challenge(drill.id, t.title.dailyDrill, drill.brief, 0)]),
        ]),
    ...ERAS.flatMap((era, stage) => {
      const list = CHALLENGES.filter((entry) => entry.era === stage)
      if (list.length === 0) return []
      const solved = list.filter((entry) => done.includes(entry.id)).length
      return [
        section(
          h,
          `${t.catalog.eras[stage]?.name ?? era.name} · ${solved}/${list.length}`,
          list.map((entry) =>
            challenge(
              entry.id,
              t.catalog.challenges[entry.id]!.name,
              t.catalog.challenges[entry.id]!.brief,
              entry.legacy,
            ),
          ),
        ),
      ]
    }),
  ]
}

const legacyBody = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: Messages,
): ReadonlyArray<View.Content<TitleMessage>> => [
  h.div.class(S.BUS).children(
    ...PERK_IDS.map((id) => {
      const def = localized(PERKS[id], t.catalog.perks[id])
      const price = perkPrice(model.founder, id)
      const level = levelOf(model.founder, id)
      return line(h, {
        key: id,
        label: def.name,
        detail: def.effect,
        lead: h.span
          .class(S.PIPS)
          .attr('aria-label', `${level}/${def.costs.length}`)
          .attr('role', 'img')
          .children(
            ...def.costs.map((_, at) => h.span.class(at < level ? 'is-on' : undefined).children()),
          ),
        figure: price === null ? glyph(Check, h) : t.title.legacy(price),
        message:
          price !== null && model.founder.legacy >= price ? TitleMessage.PerkBought({ id }) : null,
      })
    }),
  ),
]

const historyBody = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: Messages,
): ReadonlyArray<View.Content<TitleMessage>> => {
  if (model.founder.history.length === 0) return [note(h, t.title.noExitsYet)]
  return [
    h.ol.class(S.BUS).children(
      ...model.founder.history
        .map((entry, index) => {
          const exit = t.catalog.exits[entry.exit].name
          const venture = t.catalog.ventures[entry.founding.venture].name
          return record(h, {
            key: `h${index}`,
            label: entry.name || `${exit} · ${venture}`,
            detail: `${entry.name ? `${exit} · ` : ''}${venture} · ${t.title.eraUsersTime(t.catalog.eras[entry.stage]?.name ?? '', compact(entry.peak), clock(entry.time))}`,
            figure: `+${entry.legacy}`,
          })
        })
        .toReversed(),
    ),
  ]
}

const achievementsBody = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: Messages,
): ReadonlyArray<View.Content<TitleMessage>> => {
  const earned = model.founder.achievements
  return [
    progressBar(
      h,
      Math.round((earned.length / ACHIEVEMENT_IDS.length) * 100),
      t.title.achievements,
    ),
    h.div
      .class(S.GRID)
      .attr('data-grid', '')
      .children(
        ...[...ACHIEVEMENT_IDS]
          .sort((a, b) => Number(earned.includes(b)) - Number(earned.includes(a)))
          .map((id) => {
            const isEarned = earned.includes(id)
            return h.div
              .key(id)
              .attr('tabindex', '-1')
              .attr('data-nav', '')
              .attr('data-key', id)
              .attr('role', 'group')
              .attr(
                'aria-label',
                `${t.catalog.achievements[id].name}. ${t.catalog.achievements[id].condition}. ${isEarned ? t.title.earned : t.title.notYet}`,
              )
              .class(cx(S.TILE, 'is-badge', isEarned ? 'is-done' : 'is-locked'))
              .children(
                h.span.class(S.TILE_HEAD).children(
                  h.span.class(S.TILE_NAME).children(t.catalog.achievements[id].name),
                  h.span
                    .class(S.TILE_STATE)
                    .attr('aria-hidden', 'true')
                    .children(glyph(isEarned ? Check : Lock, h)),
                ),
                h.span.class(S.TILE_DETAIL).children(t.catalog.achievements[id].condition),
              )
          }),
      ),
  ]
}

/* ==========================================================================
   Settings
   ========================================================================== */

export type SettingRow =
  | Readonly<{ kind: 'volume'; label: string }>
  | Readonly<{ kind: 'toggle'; id: string; label: string; isOn: boolean; message: TitleMessage }>
  | Readonly<{ kind: 'language'; label: string }>
  | Readonly<{
      kind: 'action'
      id: string
      label: string
      glyph: IconNode
      message: TitleMessage
    }>

export type SettingsPart = Readonly<{
  id: SettingsSection
  label: string
  rows: ReadonlyArray<SettingRow>
}>

export const settingsSections = (model: TitleModel, t: Messages): ReadonlyArray<SettingsPart> => {
  const prefs = model.prefs
  const toggle = (id: string, label: string, isOn: boolean, message: TitleMessage): SettingRow => ({
    kind: 'toggle',
    id,
    label,
    isOn,
    message,
  })
  return [
    {
      id: 'sound',
      label: t.panels.sound,
      rows: [
        { kind: 'volume', label: t.panels.volume },
        toggle('mute', t.panels.muteSoundM, prefs.muted, TitleMessage.MuteToggled()),
      ],
    },
    {
      id: 'play',
      label: t.panels.play,
      rows: [
        toggle('easy-mode', t.panels.easyMode, prefs.easyMode, TitleMessage.EasyModeToggled()),
        ...(prefs.easyMode
          ? [
              toggle(
                'auto-pause',
                t.panels.pauseOnSEV1AndSEV2,
                prefs.autoPause,
                TitleMessage.AutoPauseToggled(),
              ),
            ]
          : []),
        toggle(
          'blur-pause',
          t.panels.pauseOnBlur,
          prefs.blurPause,
          TitleMessage.BlurPauseToggled(),
        ),
      ],
    },
    {
      id: 'display',
      label: t.panels.display,
      rows: [
        toggle(
          'motion',
          t.panels.reduceMotion,
          prefs.motion === 'reduce',
          TitleMessage.MotionToggled(),
        ),
        toggle('text', t.panels.textAt150, prefs.text === 'large', TitleMessage.TextToggled()),
        toggle('theme', t.panels.darkMode, prefs.theme === 'dark', TitleMessage.ThemeToggled()),
        { kind: 'language', label: t.panels.language },
      ],
    },
    {
      id: 'privacy',
      label: t.panels.privacy,
      rows: [
        toggle(
          'agent-access',
          t.panels.agentAccess,
          prefs.agentAccess,
          TitleMessage.AgentAccessToggled(),
        ),
        toggle(
          'analytics',
          t.panels.shareAnonymousUsageData,
          prefs.analytics,
          TitleMessage.AnalyticsToggled(),
        ),
        {
          kind: 'action',
          id: 'privacy-policy',
          label: t.panels.privacyPolicy,
          glyph: ArrowUpRight,
          message: TitleMessage.PrivacyOpened(),
        },
      ],
    },
    {
      id: 'save',
      label: t.panels.save,
      rows: [
        {
          kind: 'action',
          id: 'save-export',
          label: t.panels.copySaveAsText,
          glyph: Copy,
          message: TitleMessage.SaveExported(),
        },
        {
          kind: 'action',
          id: 'save-download',
          label: t.panels.downloadSaveFile,
          glyph: Download,
          message: TitleMessage.SaveDownloaded(),
        },
        {
          kind: 'action',
          id: 'save-file',
          label: t.panels.importSaveFile,
          glyph: Upload,
          message: TitleMessage.SaveFileAsked(),
        },
        {
          kind: 'action',
          id: 'save-paste',
          label: t.panels.pasteASave,
          glyph: ClipboardPaste,
          message: TitleMessage.SaveImportAsked(),
        },
        {
          kind: 'action',
          id: 'copy-state',
          label: t.panels.copyStateAsJSON,
          glyph: Copy,
          message: TitleMessage.StateCopied(),
        },
      ],
    },
  ]
}

const settingLabel = (section: SettingsSection, t: Messages): string =>
  section === 'sound'
    ? t.panels.sound
    : section === 'play'
      ? t.panels.play
      : section === 'display'
        ? t.panels.display
        : section === 'privacy'
          ? t.panels.privacy
          : t.panels.save

const switchClass = cx(
  'peer-control',
  'group-switch',
  S.FOCUS_OUTLINE,
  css({
    flexShrink: '0',
    borderRadius: 'full',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'transparent',
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    outlineStyle: 'none',
    transitionProperty: 'all',
    transitionDuration: 'fast',
    transitionTimingFunction: 'out',
    '&[data-checked]': { layerStyle: 'primaryFill', boxShadow: 'insetTop' },
    '&[data-unchecked]': { backgroundColor: 'well', boxShadow: 'well' },
    '&[data-size="default"]': { height: '5', width: '34px' },
  }),
)

const switchThumbClass = css({
  layerStyle: 'raised',
  boxShadow: 'raised',
  borderRadius: 'full',
  pointerEvents: 'none',
  display: 'block',
  transitionProperty: 'transform',
  transitionDuration: 'fast',
  transitionTimingFunction: 'out',
  '.group-switch[data-size="default"] &': {
    width: '4',
    height: '4',
    '&[data-checked]': { transform: 'translateX(calc(100% - 1px))' },
    '&[data-unchecked]': { transform: 'translateX(1px)' },
  },
})

const switchTextClass = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1',
  flex: '1 1 0%',
  minWidth: '0',
})

const settingLabelClass = css({ fontSize: 'type.13', fontWeight: 'medium', lineHeight: 'snug' })

const settingSwitch = (
  config: Readonly<{ id: string; label: string; isChecked: boolean; message: TitleMessage }>,
  h: H<TitleMessage>,
): View.Content<TitleMessage> =>
  h.div
    .class(
      cx(S.SWITCH_ROW, css({ display: 'flex', alignItems: 'center', gap: '3', width: '100%' })),
    )
    .children(
      h.button
        .attr('type', 'button')
        .attr('role', 'switch')
        .attr('aria-checked', config.isChecked ? 'true' : 'false')
        .attr('aria-labelledby', `${config.id}-label`)
        .attr('data-checked', config.isChecked ? '' : undefined)
        .attr('data-slot', 'switch')
        .attr('data-size', 'default')
        .attr('data-unchecked', config.isChecked ? undefined : '')
        .class(switchClass)
        .on('click', () => config.message)
        .children(
          h.span
            .attr('data-slot', 'switch-thumb')
            .attr(config.isChecked ? 'data-checked' : 'data-unchecked', '')
            .class(switchThumbClass)
            .children(),
        ),
      h.div.class(switchTextClass).children(
        h.label
          .attr('id', `${config.id}-label`)
          .class(settingLabelClass)
          .on('click', () => config.message)
          .children(config.label),
      ),
    )

const sliderRootClass = css({
  position: 'relative',
  display: 'flex',
  width: '100%',
  touchAction: 'none',
  alignItems: 'center',
  userSelect: 'none',
})

const sliderTrackClass = css({
  backgroundColor: 'well',
  boxShadow: 'well',
  borderRadius: 'full',
  height: '1.5',
  width: '100%',
  position: 'relative',
  flexGrow: '1',
  overflow: 'hidden',
  userSelect: 'none',
})

const sliderFilledClass = css({
  layerStyle: 'primaryFill',
  borderRadius: 'full',
  height: '100%',
  userSelect: 'none',
})

const sliderThumbClass = css({
  position: 'relative',
  width: '4',
  height: '4',
  borderRadius: 'full',
  layerStyle: 'raised',
  boxShadow: 'raised',
  transitionProperty: 'color, box-shadow',
  transitionTimingFunction: 'default',
  transitionDuration: 'fast',
  '&::after': { position: 'absolute', inset: '-0.5rem' },
  _hover: { boxShadow: 'selected' },
  _focusVisible: { boxShadow: 'selected', outlineStyle: 'hidden' },
  '&:active': { boxShadow: 'selectedStrong' },
  '&[data-disabled]': { pointerEvents: 'none', opacity: 0.5 },
  display: 'block',
  flexShrink: '0',
  userSelect: 'none',
})

const volumeSlider = (
  model: TitleModel,
  t: Messages,
  h: H<TitleMessage>,
): View.Content<TitleMessage> => {
  const value = model.prefs.volume
  const isDisabled = model.prefs.muted
  const id = 'volume'
  const fraction = Math.max(0, Math.min(1, value / 100))
  return h.div
    .class(css({ display: 'flex', flexDirection: 'column', gap: '2', width: '100%' }))
    .children(
      h.div
        .class(css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }))
        .children(
          h.label.attr('id', `${id}-label`).class(settingLabelClass).children(t.panels.volume),
          h.span
            .class(
              css({
                fontSize: 'type.14',
                lineHeight: 'fine',
                fontVariantNumeric: 'tabular-nums',
                color: 'mutedForeground',
              }),
            )
            .children(`${value}%`),
        ),
      h.div
        .attr('data-slider-id', id)
        .attr('data-orientation', 'horizontal')
        .attr('data-horizontal', '')
        .attr('data-disabled', isDisabled ? '' : undefined)
        .attr('data-slot', 'slider')
        .class(sliderRootClass)
        .children(
          h.div
            .attr('data-slider-track-id', id)
            .attr('data-orientation', 'horizontal')
            .attr('data-horizontal', '')
            .attr('data-disabled', isDisabled ? '' : undefined)
            .style({ position: 'relative', touchAction: 'none' })
            .attr('data-slot', 'slider-track')
            .class(sliderTrackClass)
            .children(
              h.div
                .style({
                  position: 'absolute',
                  left: '0',
                  top: '0',
                  bottom: '0',
                  width: `calc((100% - 0.75rem) * ${fraction} + 0.375rem)`,
                  pointerEvents: 'none',
                })
                .attr('data-disabled', isDisabled ? '' : undefined)
                .attr('data-slot', 'slider-range')
                .class(sliderFilledClass)
                .children(),
            ),
          h.div
            .attr('id', `${id}-thumb`)
            .attr('role', 'slider')
            .attr('tabindex', '0')
            .attr('aria-orientation', 'horizontal')
            .attr('aria-valuemin', '0')
            .attr('aria-valuemax', '100')
            .attr('aria-valuenow', String(value))
            .attr('aria-valuetext', `${value}%`)
            .attr('aria-labelledby', `${id}-label`)
            .attr('aria-disabled', isDisabled ? 'true' : undefined)
            .attr('data-disabled', isDisabled ? '' : undefined)
            .style({
              position: 'absolute',
              left: `calc((100% - 0.75rem) * ${fraction})`,
              touchAction: 'none',
            })
            .attr('data-slot', 'slider-thumb')
            .class(cx(sliderThumbClass, S.THUMB_FOCUS))
            .on(
              'keydown',
              ({ key }) => {
                if (isDisabled) return undefined
                const next =
                  key === 'ArrowRight' || key === 'ArrowUp'
                    ? Math.min(100, value + 5)
                    : key === 'ArrowLeft' || key === 'ArrowDown'
                      ? Math.max(0, value - 5)
                      : key === 'Home'
                        ? 0
                        : key === 'End'
                          ? 100
                          : null
                return next === null ? undefined : TitleMessage.VolumeChanged({ volume: next })
              },
              { preventDefault: true },
            )
            .children(),
          h.input
            .attr('type', 'range')
            .attr('min', '0')
            .attr('max', '100')
            .attr('step', '5')
            .value(String(value))
            .disabled(isDisabled)
            .attr('aria-label', t.panels.volume)
            .style({
              position: 'absolute',
              left: '0',
              right: '0',
              top: '-0.5rem',
              height: 'calc(100% + 1rem)',
              opacity: '0',
              cursor: 'pointer',
            })
            .class(css({ margin: '0' }))
            .on('input', ({ value: next }) => TitleMessage.VolumeChanged({ volume: Number(next) })),
        ),
    )
}

const languagePicker = (
  locale: Locale,
  label: string,
  h: H<TitleMessage>,
): View.Content<TitleMessage> =>
  h.div.attr('data-language-picker', '').children(
    h.div
      .class(css({ position: 'relative', display: 'inline-flex', alignItems: 'center' }))
      .children(
        h.select
          .value(locale)
          .attr('lang', locale)
          .attr('aria-label', label)
          .class(
            css({
              display: 'flex',
              height: '8',
              minWidth: '32',
              cursor: 'pointer',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '3',
              borderRadius: 'lg',
              backgroundColor: 'well',
              paddingInline: '2.5',
              paddingRight: '8',
              fontSize: 'type.14',
              lineHeight: 'fine',
              color: 'foreground',
              boxShadow: 'well',
              outlineStyle: 'none',
              appearance: 'none',
              _hover: { backgroundColor: 'muted' },
              _focusVisible: {
                boxShadow:
                  'var(--elev-well), 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
              },
            }),
          )
          .on('change', ({ value }) => TitleMessage.LocaleChosen({ locale: value as Locale }))
          .children(
            ...supportedLocales.map((choice) =>
              h.option
                .attr('value', choice.value)
                .attr('lang', choice.value)
                .selected(choice.value === locale)
                .children(choice.label),
            ),
          ),
        icon(
          h,
          ChevronDown,
          css({
            position: 'absolute',
            right: '2.5',
            width: '4',
            height: '4',
            pointerEvents: 'none',
            color: 'mutedForeground',
          }),
        ),
      ),
  )

const settingRow = (
  setting: SettingRow,
  model: TitleModel,
  t: Messages,
  h: H<TitleMessage>,
): View.Content<TitleMessage> => {
  switch (setting.kind) {
    case 'volume':
      return h.div
        .key('volume')
        .class(cx(S.SETTING, 'is-volume'))
        .children(volumeSlider(model, t, h))
    case 'toggle':
      return h.div
        .key(setting.id)
        .class(S.SETTING)
        .children(
          settingSwitch(
            {
              id: setting.id,
              label: setting.label,
              isChecked: setting.isOn,
              message: setting.message,
            },
            h,
          ),
        )
    case 'language':
      return h.div
        .key('language')
        .class(cx(S.SETTING, 'is-split'))
        .children(
          h.span.class(S.LABEL).children(t.panels.language),
          languagePicker(model.prefs.locale, t.panels.language, h),
        )
    case 'action':
      return line(h, {
        key: setting.id,
        label: setting.label,
        figure: glyph(setting.glyph, h),
        message: setting.message,
      })
  }
}

const pwaSection = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: Messages,
): ReadonlyArray<View.Content<TitleMessage>> => {
  if (pwaInstalled(model.pwa)) return []
  const installable = pwaInstallable(model.pwa)
  const rows: Array<View.Content<TitleMessage>> = [
    line(h, {
      key: 'pwa-install-setting',
      label: t.pwa.installQuorum,
      detail: installable ? t.pwa.installDetail : t.pwa.installHelp[browserFamilyOf()],
      figure: glyph(Download, h),
      message: installable ? TitleMessage.PwaInstallChosen() : null,
    }),
  ]
  if (onIos()) rows.push(note(h, t.pwa.moveNote))
  return [section(h, t.pwa.app, rows)]
}

const settingsBody = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: Messages,
): ReadonlyArray<View.Content<TitleMessage>> => [
  h.div
    .key('sections')
    .class(S.BUS)
    .children(
      ...settingsSections(model, t).map((part) =>
        line(h, {
          key: `section-${part.id}`,
          label: part.label,
          message: TitleMessage.SettingsSectionChosen({ section: part.id }),
          branch: true,
          open: model.settingsOpen && part.id === model.settingsSection,
        }),
      ),
    ),
  ...pwaSection(h, model, t),
]

const settingBody = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: Messages,
): ReadonlyArray<View.Content<TitleMessage>> => {
  const sections = settingsSections(model, t)
  const open = sections.find((part) => part.id === model.settingsSection) ?? sections[0]!
  return [
    h.div
      .key(`rows-${open.id}`)
      .class(S.BUS)
      .children(...open.rows.map((setting) => settingRow(setting, model, t, h))),
  ]
}

/* ==========================================================================
   New company
   ========================================================================== */

const FOUND_STEPS: ReadonlyArray<FoundStep> = ['company', 'venture', 'mutators']

const inputClass = css({
  backgroundColor: 'well',
  boxShadow: 'well',
  borderColor: 'transparent',
  height: '8',
  borderRadius: 'lg',
  borderWidth: '1px',
  paddingInline: '2.5',
  paddingBlock: '1',
  fontSize: 'type.16',
  lineHeight: 'normal',
  transitionProperty: 'color, background-color, border-color, text-decoration-color, fill, stroke',
  transitionTimingFunction: 'default',
  transitionDuration: 'fast',
  width: '100%',
  minWidth: '0',
  outlineStyle: 'none',
  '&::placeholder': { color: 'mutedForeground' },
  '&:focus-visible': { borderColor: 'ring', boxShadow: 'focusWell' },
})

const companyStep = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: Messages,
): ReadonlyArray<View.Content<TitleMessage>> => [
  h.label
    .key('name')
    .class(S.FIELD)
    .children(
      h.span.class(S.EYEBROW).children(t.title.companyName),
      h.input
        .class(cx(inputClass, S.NAME_INPUT))
        .attr('type', 'text')
        .value(model.draft.name)
        .attr('placeholder', t.title.nameYourCompany)
        .attr('maxlength', `${MAX_COMPANY_NAME}`)
        .attr('autocomplete', 'off')
        .attr('spellcheck', 'false')
        .attr('data-nav', '')
        .attr('data-key', 'name')
        .attr('data-first', '')
        .on('input', ({ value }) => TitleMessage.CompanyNameChanged({ name: value })),
    ),
  section(
    h,
    t.title.logo,
    LOGOS.map((logo) =>
      tile(h, t, {
        key: `logo-${logo.id}`,
        label: t.logos[logo.id],
        mark: companyMark(logo.id, S.LOGO_SMALL, h),
        pick: 'radio',
        checked: model.draft.logo === logo.id,
        message: TitleMessage.LogoChosen({ logo: logo.id }),
      }),
    ),
    true,
  ),
]

const ventureStep = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: Messages,
): ReadonlyArray<View.Content<TitleMessage>> => {
  const founding = foundingOf(model.founder)
  return [
    h.div
      .class(S.GRID)
      .attr('data-grid', '')
      .children(
        ...VENTURE_IDS.map((id) => {
          const def = localized(VENTURES[id], t.catalog.ventures[id])
          return tile(h, t, {
            key: id,
            label: def.name,
            detail: def.summary,
            figure: `×${def.legacy.toFixed(1)}`,
            pick: 'radio',
            checked: id === founding.venture,
            message: TitleMessage.VentureChosen({ id }),
          })
        }),
      ),
  ]
}

const mutatorStep = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: Messages,
): ReadonlyArray<View.Content<TitleMessage>> => {
  const founding = foundingOf(model.founder)
  return [
    h.div
      .class(S.GRID)
      .attr('data-grid', '')
      .children(
        ...MUTATOR_IDS.map((id) =>
          tile(h, t, {
            key: id,
            label: t.catalog.mutators[id].name,
            detail: t.catalog.mutators[id].rule,
            figure: `+${Math.round(MUTATORS[id].legacy * 100)}%`,
            pick: 'checkbox',
            checked: founding.mutators.includes(id),
            message: TitleMessage.MutatorToggled({ id }),
          }),
        ),
      ),
  ]
}

const stageBody = (
  h: H<TitleMessage>,
  model: TitleModel,
  step: FoundStep,
  t: Messages,
): ReadonlyArray<View.Content<TitleMessage>> =>
  step === 'company'
    ? companyStep(h, model, t)
    : step === 'venture'
      ? ventureStep(h, model, t)
      : mutatorStep(h, model, t)

const foundStages = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: Messages,
): View.Content<TitleMessage> => {
  const at = FOUND_STEPS.indexOf(model.foundStep)
  const founding = foundingOf(model.founder)
  const venture = localized(VENTURES[founding.venture], t.catalog.ventures[founding.venture])
  const picked = founding.mutators.map((id) => t.catalog.mutators[id].name)
  const label: Record<FoundStep, string> = {
    company: t.title.company,
    venture: t.title.venture,
    mutators: t.title.mutators,
  }
  const value: Record<FoundStep, string | null> = {
    company: nameOr(model.draft.name),
    venture: `${venture.name} ×${venture.legacy.toFixed(1)}`,
    mutators:
      picked.length === 0
        ? null
        : `${picked.slice(0, 2).join(' · ')}${picked.length > 2 ? ` +${picked.length - 2}` : ''}`,
  }
  return h.ol
    .key('stages')
    .class(S.PHASES)
    .attr('aria-label', t.title.newCompany)
    .children(
      ...FOUND_STEPS.map((step, index) => {
        const open = index === at
        const done = index < at
        const head = [
          h.span
            .class(S.PHASE_NODE)
            .attr('aria-hidden', 'true')
            .children(done ? glyph(Check, h) : `${index + 1}`),
          h.span.class(S.PHASE_LABEL).children(label[step]),
          done && value[step] ? h.span.class(S.PHASE_VALUE).children(value[step]!) : null,
          open
            ? null
            : h.span.class(S.PHASE_GO).attr('aria-hidden', 'true').children(glyph(ChevronRight, h)),
        ]
        return h.li
          .key(step)
          .class(cx(S.PHASE, open && 'is-open', done && 'is-done'))
          .children(
            open
              ? h.div
                  .class(S.PHASE_HEAD)
                  .attr('aria-current', 'step')
                  .children(...head)
              : h.button
                  .attr('type', 'button')
                  .attr('data-nav', '')
                  .attr('data-key', `step-${step}`)
                  .class(S.PHASE_HEAD)
                  .on('click', () => TitleMessage.FoundStepChosen({ step }))
                  .children(...head),
            open
              ? h.div
                  .class(S.PHASE_BODY)
                  .onMount(FocusFirst({}))
                  .children(...stageBody(h, model, step, t))
              : null,
          )
      }),
    )
}

export const foundBody = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: Messages,
): ReadonlyArray<View.Content<TitleMessage>> => [foundStages(h, model, t)]

const foundFoot = (
  h: H<TitleMessage>,
  model: TitleModel,
  t: Messages,
): View.Content<TitleMessage> => {
  const founding = foundingOf(model.founder)
  const ahead: Record<FoundStep, Readonly<{ label: string; step: FoundStep }> | null> = {
    company: { label: t.title.venture, step: 'venture' },
    venture: { label: t.title.mutators, step: 'mutators' },
    mutators: null,
  }
  const next = ahead[model.foundStep]
  return h.footer.class(S.FOOT).children(
    h.div
      .class(S.PREVIEW)
      .attr('aria-live', 'polite')
      .children(
        companyMark(model.draft.logo, S.LOGO, h),
        h.span
          .class(S.TEXT)
          .children(
            h.span.class(S.LABEL).children(nameOr(model.draft.name)),
            h.span
              .class(S.DETAIL)
              .children(t.title.legacy2(startEra(founding), legacyMultiplier(founding).toFixed(2))),
          ),
      ),
    h.div.class(S.FOOT_ACTIONS).children(
      ...(next === null
        ? [
            h.button
              .class(OUTLINE)
              .attr('type', 'button')
              .attr('data-nav', '')
              .attr('data-key', 'preseed')
              .attr('aria-description', t.title.skipsGarage)
              .attr('title', t.title.skipsGarage)
              .on('click', () => TitleMessage.PreseedStarted())
              .children(t.title.startInPreSeed),
            h.button
              .class(CTA)
              .attr('type', 'button')
              .attr('data-nav', '')
              .attr('data-key', 'found')
              .on('click', () => TitleMessage.CompanyFounded())
              .children(
                h.span.children(t.title.found(nameOr(model.draft.name))),
                glyph(ChevronRight, h),
              ),
          ]
        : [
            h.button
              .class(CTA)
              .attr('type', 'button')
              .attr('data-nav', '')
              .attr('data-key', 'next')
              .on('click', () => TitleMessage.FoundStepChosen({ step: next.step }))
              .children(h.span.children(`${t.title.next}: ${next.label}`), glyph(ChevronRight, h)),
          ]),
    ),
  )
}

/* ==========================================================================
   Pages
   ========================================================================== */

export const pageOf = (model: TitleModel, menu: MenuChoice): Page =>
  menu === 'companies' && model.saveFocus !== null
    ? 'save'
    : menu === 'settings' && model.settingsOpen
      ? 'setting'
      : menu

export const trailOf = (page: Page): ReadonlyArray<Page> =>
  page === 'main'
    ? ['main']
    : page === 'save'
      ? ['main', 'companies', 'save']
      : page === 'setting'
        ? ['main', 'settings', 'setting']
        : ['main', page]

export const memoryOf = (model: TitleModel, page: Page): string =>
  page === 'save'
    ? `save-${model.saveFocus}`
    : page === 'setting'
      ? `setting-${model.settingsSection}`
      : page === 'found'
        ? 'found'
        : page

export const fromOf = (model: TitleModel, page: Page): string | null =>
  page === 'main'
    ? null
    : page === 'save'
      ? model.saveFocus
      : page === 'setting'
        ? `section-${model.settingsSection}`
        : page === 'found'
          ? lastFile(model) === null
            ? 'start'
            : 'new'
          : page

export const pageTitle = (t: Messages, page: Page, model: TitleModel): string => {
  switch (page) {
    case 'main':
      return ''
    case 'save':
      return (
        savesOf(model.saves).companies.find((file) => file.id === model.saveFocus)?.name ??
        t.title.company
      )
    case 'setting':
      return settingLabel(model.settingsSection, t)
    case 'achievements':
      return t.title.achievements
    case 'challenges':
      return t.title.challenges
    case 'companies':
      return t.title.companies
    case 'found':
      return t.title.newCompany
    case 'history':
      return t.title.history
    case 'legacy':
      return t.title.legacyShop
    case 'sandbox':
      return t.title.sandbox
    case 'settings':
      return t.title.settings
  }
}

export const pageFigure = (model: TitleModel, page: Page, t: Messages): string | undefined => {
  const legacy = t.title.legacy(model.founder.legacy)
  switch (page) {
    case 'achievements':
      return `${model.founder.achievements.length}/${ACHIEVEMENT_IDS.length}`
    case 'challenges':
    case 'found':
    case 'legacy':
      return legacy
    case 'companies':
      return `${savesOf(model.saves).companies.length}`
    case 'history':
      return `${model.founder.history.length}`
    case 'sandbox':
      return `${SANDBOX_IDS.filter((id) => model.passed.includes(id)).length}/${SANDBOX_IDS.length}`
    case 'main':
    case 'save':
    case 'setting':
    case 'settings':
      return undefined
  }
}

const pageBody = (
  h: H<TitleMessage>,
  model: TitleModel,
  page: Exclude<Page, 'main'>,
  t: Messages,
): ReadonlyArray<View.Content<TitleMessage>> => {
  switch (page) {
    case 'companies':
      return companiesBody(h, model, t)
    case 'save':
      return saveBody(h, model, t)
    case 'sandbox':
      return sandboxBody(h, model, t)
    case 'challenges':
      return challengesBody(h, model, t)
    case 'legacy':
      return legacyBody(h, model, t)
    case 'history':
      return historyBody(h, model, t)
    case 'achievements':
      return achievementsBody(h, model, t)
    case 'settings':
      return settingsBody(h, model, t)
    case 'setting':
      return settingBody(h, model, t)
    case 'found':
      return foundBody(h, model, t)
  }
}

export const subPage = (
  h: H<TitleMessage>,
  model: TitleModel,
  page: Exclude<Page, 'main'>,
  t: Messages,
): View.Content<TitleMessage> => {
  const figure = pageFigure(model, page, t)
  const back =
    page === 'save' ? t.title.companies : page === 'setting' ? t.title.settings : t.title.back
  return h.div.class(S.SUB).children(
    h.header.class(S.SUB_HEAD).children(
      h.button
        .class(buttonClass('ghost', 'lg', S.BACK))
        .attr('type', 'button')
        .attr('data-back', '')
        .attr('aria-keyshortcuts', 'Escape')
        .on('click', () =>
          page === 'save'
            ? TitleMessage.CompanyClosed()
            : page === 'setting'
              ? TitleMessage.SettingsSectionClosed()
              : TitleMessage.MenuChosen({ menu: 'main' }),
        )
        .children(glyph(ChevronLeft, h), h.span.children(back)),
      h.h1.class(S.SUB_TITLE).children(pageTitle(t, page, model)),
      figure === undefined ? null : h.span.class(S.SUB_FIGURE).children(figure),
    ),
    h.div.class(S.SUB_BODY).children(...pageBody(h, model, page, t)),
    page === 'found' ? foundFoot(h, model, t) : null,
    model.notice === null ? null : note(h, model.notice),
  )
}

/* The focus lands on the first choice of a column when it appears, or on the
   open founding station's first field. */
export const FocusFirst = Mount.make('TitleFocusFirst', {}, (node: HTMLElement) =>
  Effect.sync(() => {
    if (node.querySelector('[data-nav]:focus')) return
    const stops = [
      ...node.querySelectorAll<HTMLElement>(
        '[data-nav], .qm-setting :is([role="switch"], [role="slider"], button)',
      ),
    ].filter((stop) => stop.getClientRects().length > 0)
    const target =
      stops.find((stop) => stop.hasAttribute('data-first')) ??
      stops.find((stop) => stop.getAttribute('aria-checked') === 'true') ??
      stops[0]
    target?.focus({ preventScroll: true })
  }).pipe(Effect.as(Component.noop)),
)
