import { Component, Command, Mount, Router } from '@effect/ui'
import type { View } from '@effect/ui'
import { Html } from '@effect/ui/html'
import type { H } from '@effect/ui/html/Html'
import { Effect } from 'effect'
import { cx, css } from '@quorum/styled-system/css'
import { kbdClass } from '@quorum/ui/primitives/kbd'
import { ACHIEVEMENT_IDS } from '@quorum/simulation/catalog'
import { CHALLENGES } from '@quorum/simulation/challenges'
import { SANDBOX_IDS } from '@quorum/simulation/sandbox'
import { ArrowUpRight, BookOpen, ChevronRight, Coffee, Download, type IconNode } from 'lucide'
import { siGithub } from 'simple-icons'
import { Locale } from '../../i18n/index.ts'
import { copyIn } from '../../i18n/messages.ts'
import { savesOf } from '../../game/saves-machine.ts'
import { DISCLAIMER_URL, SOURCE_URL, WIKI_URL } from '../../platform/analytics.ts'
import * as S from '../../game/title-styles.ts'
import { AppRoute } from '../routes.ts'
import { LoadFounder, LoadPrefs, LoadSandbox, LoadSaves } from './commands.ts'
import { TitleMessage, type MenuPage } from './messages.ts'
import { TitleModel, initialTitle } from './model.ts'
import { WallClock } from './Splash.ts'

const STAGE = css({
  height: '100dvh',
  width: '100%',
  overflow: 'hidden',
  backgroundColor: 'background',
  color: 'foreground',
  userSelect: 'none',
})

const ICON = css({ width: '16px', height: '16px', flexShrink: '0' })

const CTA = css({
  borderRadius: 'lg',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'transparent',
  layerStyle: 'primaryFill',
  color: 'onPrimaryFill',
  boxShadow: 'primary',
  fontSize: 'type.14',
  fontWeight: 'medium',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  outlineStyle: 'none',
  '& svg': { pointerEvents: 'none', flexShrink: '0' },
  _hover: { filter: 'brightness(1.06)' },
  _active: { filter: 'brightness(0.95)' },
  _focusVisible: {
    boxShadow: 'var(--elev-primary), 0 0 0 3px color-mix(in oklab, var(--ring) 50%, transparent)',
  },
})

const svgElement = <Msg>(h: H<Msg>, tag: string, attrs: Readonly<Record<string, unknown>>) => {
  const value = (key: string, fallback = '0') => {
    const raw = attrs[key]
    return typeof raw === 'string' || typeof raw === 'number' ? String(raw) : fallback
  }
  switch (tag) {
    case 'circle':
      return h.circle
        .attr('cx', value('cx'))
        .attr('cy', value('cy'))
        .attr('r', value('r'))
        .children()
    case 'ellipse':
      return h.ellipse
        .attr('cx', value('cx'))
        .attr('cy', value('cy'))
        .attr('rx', value('rx'))
        .attr('ry', value('ry'))
        .children()
    case 'rect':
      return h.rect
        .attr('x', value('x'))
        .attr('y', value('y'))
        .attr('width', value('width'))
        .attr('height', value('height'))
        .attr('rx', attrs['rx'] === undefined ? undefined : value('rx'))
        .children()
    case 'line':
      return h.line
        .attr('x1', value('x1'))
        .attr('y1', value('y1'))
        .attr('x2', value('x2'))
        .attr('y2', value('y2'))
        .children()
    case 'polyline':
      return h.polyline.attr('points', value('points', '')).children()
    case 'polygon':
      return h.polygon.attr('points', value('points', '')).children()
    default:
      return h.path.attr('d', value('d', '')).children()
  }
}

const icon = <Msg>(h: H<Msg>, node: IconNode, className: string) =>
  h.svg
    .class(className)
    .attr('viewBox', '0 0 24 24')
    .attr('fill', 'none')
    .attr('stroke', 'currentColor')
    .attr('stroke-width', '2')
    .attr('stroke-linecap', 'round')
    .attr('stroke-linejoin', 'round')
    .attr('aria-hidden', 'true')
    .children(...node.map(([tag, attrs]) => svgElement(h, tag, attrs)))

const githubMark = <Msg>(h: H<Msg>) =>
  h.svg
    .class(ICON)
    .attr('viewBox', '0 0 24 24')
    .attr('fill', 'currentColor')
    .attr('aria-hidden', 'true')
    .children(h.path.attr('d', siGithub.path).children())

const GLYPHS: ReadonlyArray<{ at: number; paths: ReadonlyArray<string> }> = [
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

const wordmark = <Msg>(h: H<Msg>) =>
  h.svg
    .class(cx(S.MARK, 'is-hero'))
    .attr('viewBox', '0 0 720 194')
    .attr('role', 'img')
    .attr('aria-label', 'Quorum')
    .children(
      ...GLYPHS.flatMap(({ at, paths }, letter) =>
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

const toolbar = (h: H<TitleMessage>, t: ReturnType<typeof copyIn>) => {
  const release = import.meta.env.VITE_SENTRY_RELEASE
  const build = release === undefined || release === '' ? 'dev' : release.slice(0, 7)
  return h.header.class(S.BAR).children(
    h.nav
      .class(S.TOOLS)
      .attr('aria-label', t.title.taskbar)
      .children(
        h.a
          .class(cx(S.TOOL, 'is-wide'))
          .attr('href', build === 'dev' ? SOURCE_URL : `${SOURCE_URL}/commit/${release}`)
          .attr('target', '_blank')
          .attr('rel', 'noreferrer noopener')
          .attr('aria-label', `${t.title.build} ${build}`)
          .attr('title', `${t.title.build} ${build}`)
          .children(h.span.class(S.BUILD).children(build)),
        h.a
          .class(cx(S.TOOL, 'is-wide'))
          .attr('href', `${SOURCE_URL}/issues`)
          .attr('target', '_blank')
          .attr('rel', 'noreferrer noopener')
          .attr('aria-label', t.title.feedback)
          .attr('title', t.title.feedback)
          .children(
            h.span.class(S.TOOL_LABEL).children(t.title.feedback),
            icon(h, ArrowUpRight, S.ICON),
          ),
        h.a
          .class(S.TOOL)
          .attr('href', 'https://ko-fi.com/elianiva')
          .attr('target', '_blank')
          .attr('rel', 'noreferrer noopener')
          .attr('aria-label', t.title.supportOnKofi)
          .attr('title', t.title.supportOnKofi)
          .children(icon(h, Coffee, S.ICON)),
        h.a
          .class(S.TOOL)
          .attr('href', SOURCE_URL)
          .attr('target', '_blank')
          .attr('rel', 'noreferrer noopener')
          .attr('aria-label', t.title.openSourceOnGitHub)
          .attr('title', t.title.openSourceOnGitHub)
          .children(githubMark(h)),
      ),
  )
}

const dock = (h: H<TitleMessage>, t: ReturnType<typeof copyIn>, locale: Locale) =>
  h.footer.class(S.DOCK).children(
    h.div
      .class(S.KEYS)
      .attr('aria-hidden', 'true')
      .children(
        h.span
          .class(S.KEY)
          .children(h.kbd.class(kbdClass).children('↑↓'), h.span.children(t.title.select)),
        h.span
          .class(S.KEY)
          .children(h.kbd.class(kbdClass).children(t.title.enter), h.span.children(t.title.open)),
      ),
    h.a
      .class(S.DISCLAIMER)
      .attr('href', DISCLAIMER_URL)
      .attr('target', '_blank')
      .attr('rel', 'noreferrer noopener')
      .children(t.title.quorumIsAGameAndSimplifies),
    h.nav.class(S.DOCK_TOOLS).children(
      h.a
        .class(cx(S.TOOL, 'is-wide'))
        .attr('href', WIKI_URL)
        .attr('target', '_blank')
        .attr('rel', 'noreferrer noopener')
        .attr('aria-label', t.title.wiki)
        .attr('title', t.title.wiki)
        .children(icon(h, BookOpen, S.ICON), h.span.class(S.TOOL_LABEL).children(t.title.wiki)),
      h.span.class(S.CLOCK).onMount(WallClock({ locale })).children('--:--'),
    ),
  )

type Line = Readonly<{
  key: string
  label: string
  detail?: string | undefined
  figure?: string | undefined
  figureMark?: IconNode | undefined
  message: TitleMessage | null
  hotkey?: number | undefined
  first?: boolean
  branch?: boolean
  open?: boolean
}>

const line = (h: H<TitleMessage>, r: Line) => {
  const button = h.button
    .key(r.key)
    .class(cx(S.LINE, r.open && 'is-open', !r.hotkey && !r.figureMark && 'is-bare'))
    .attr('type', 'button')
    .attr('data-nav', '')
    .attr('data-key', r.key)
    .attr('data-first', r.first ? '' : undefined)
    .attr('data-branch', r.branch ? '' : undefined)
    .attr('data-hotkey', r.hotkey === undefined ? undefined : `${r.hotkey}`)
    .attr('aria-keyshortcuts', r.hotkey === undefined ? undefined : `${r.hotkey}`)
    .attr('aria-disabled', r.message === null ? 'true' : undefined)
    .style({ '--i': `${r.hotkey ?? 0}` })
  const message = r.message
  const clickable = message === null ? button : button.on('click', () => message)
  return clickable.children(
    r.hotkey !== undefined
      ? h.span.class(S.NUM).attr('aria-hidden', 'true').children(`${r.hotkey}`.padStart(2, '0'))
      : h.span.children(),
    h.span
      .class(S.TEXT)
      .children(
        h.span.class(S.LABEL).children(r.label),
        r.detail === undefined ? h.span.children() : h.span.class(S.DETAIL).children(r.detail),
      ),
    r.figureMark !== undefined
      ? h.span.class(S.FIGURE).children(icon(h, r.figureMark, S.ICON))
      : r.figure === undefined
        ? h.span.children()
        : h.span.class(S.FIGURE).children(r.figure),
  )
}

const section = (
  h: H<TitleMessage>,
  title: string,
  body: ReadonlyArray<ReturnType<typeof line>>,
  grid = false,
) =>
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

const firstRun = (h: H<TitleMessage>, t: ReturnType<typeof copyIn>) =>
  h.section.class(cx(S.READOUT, 'is-empty')).children(
    h.button
      .class(cx(CTA, S.CTA, 'press'))
      .attr('type', 'button')
      .attr('data-nav', '')
      .attr('data-key', 'start')
      .attr('data-first', '')
      .attr('data-branch', '')
      .on('click', () => TitleMessage.MenuChosen({ menu: 'found' }))
      .children(h.span.children(t.title.startACompany), icon(h, ChevronRight, S.ICON)),
  )

const mainIndex = (h: H<TitleMessage>, model: TitleModel, t: ReturnType<typeof copyIn>) => {
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
    line(h, {
      key: 'import',
      label: t.title.importACompany,
      message: null,
      figureMark: Download,
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
      section(h, t.title.company, company),
      section(h, t.title.practice, practice),
      section(h, t.title.founder, founder),
      section(h, t.title.system, system),
    )
}

const mainPage = (h: H<TitleMessage>, model: TitleModel, t: ReturnType<typeof copyIn>) =>
  h.div
    .class(S.MAIN)
    .children(
      h.div.class(S.HERO).children(h.h1.class(S.HERO_TITLE).children(wordmark(h)), firstRun(h, t)),
      mainIndex(h, model, t),
    )

const screen = (h: H<TitleMessage>, model: TitleModel, t: ReturnType<typeof copyIn>) =>
  h.div.class(S.STAGE).children(
    h.div
      .class(S.WORLD)
      .attr('data-depth', '0')
      .children(
        h.svg.key('wires').class(S.WIRES).attr('aria-hidden', 'true').children(),
        h.div.key('ghosts').class(S.GHOSTS).attr('aria-hidden', 'true').children(),
        h.div
          .key('root')
          .class(cx(S.PAGE, 'is-main', 'is-active'))
          .attr('data-page', 'main')
          .attr('data-memory', 'main')
          .attr('data-depth', '0')
          .onMount(MenuFocus({}))
          .children(mainPage(h, model, t)),
      ),
  )

const MenuFocus = Mount.make('MenuFocus', {}, (node: HTMLElement) =>
  Effect.sync(() => {
    if (node.querySelector('[data-nav]:focus')) return
    const first = node.querySelector<HTMLElement>('[data-nav][data-first]')
    first?.focus({ preventScroll: true })
  }).pipe(Effect.as(Component.noop)),
)

export const TitlePage = Html.component({
  name: 'TitlePage',
  model: TitleModel,
  message: TitleMessage,
}).make({
  init: ($) =>
    $.set(initialTitle()).run(
      LoadSaves.make(),
      LoadFounder.make(),
      LoadPrefs.make(),
      LoadSandbox.make(),
    ),

  update: {
    SavesLoaded: ($, { index }) => $.evolve({ saves: { _tag: 'Ready', index } }),
    FounderLoaded: ($, { founder, today }) => $.evolve({ founder, today }),
    PrefsLoaded: ($, { prefs }) => $.evolve({ prefs }),
    SandboxLoaded: ($, { passed }) => $.evolve({ passed }),
    MenuChosen: ($, { menu }) =>
      $.run(Router.push(AppRoute, AppRoute.Menu({ params: { menu } })).pipe(Command.asNoop)),
  },

  view: (h, model) => {
    const t = copyIn(model.prefs.locale)
    // The toolbar and dock mix anchors, SVG icons, and kbd elements. Effect UI
    // infers `any` for that children union; the view starts no effects, so
    // narrow the result to a view with no requirements.
    return h.div
      .class(STAGE)
      .children(
        h.main
          .class(cx('title-screen', S.ROOT))
          .children(
            h.div
              .class(S.FRAME)
              .children(toolbar(h, t), screen(h, model, t), dock(h, t, model.prefs.locale)),
          ),
      ) as unknown as View.Content<TitleMessage>
  },
})
