import { Effect, Option, Schema } from 'effect'
import { Command, Runtime, Update } from 'foldkit'
import { defineMessageUnion } from 'foldkit/message'
import { UrlRequest, load, pushUrl } from 'foldkit/navigation'
import { Url, toString as urlToString } from 'foldkit/url'
import { isProseLoaded, loadProse, needsProse } from './content.ts'
import { Locale, localeOfPath, stripLocale } from './i18n/locale.ts'
import { WIKI_ORIGIN } from './site.ts'
import * as Progress from './submodels/progress.ts'
import * as Project from './submodels/project.ts'
import * as Quiz from './submodels/quiz.ts'
import * as Search from './submodels/search.ts'
import * as Spoilers from './submodels/spoilers.ts'

export const Model = Schema.Struct({
  /** The language of the page, from the prefix of its URL. */
  locale: Locale,
  /** The page's logical path, without its language prefix or a trailing slash. */
  path: Schema.String,
  /** The navigation drawer is open on a phone. */
  menu: Schema.Boolean,
  /** The language menu in the header is open. */
  languageMenu: Schema.Boolean,
  /** Hubs the reader opened or closed by hand, against whether the current page opens them. */
  navToggled: Schema.Array(Schema.String),
  search: Search.Model,
  spoilers: Spoilers.Model,
  progress: Progress.Model,
  quiz: Quiz.Model,
  /** The repository's public numbers, for the card on the home page. */
  project: Project.Model,
})
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  PageLoaded: { path: Schema.String, hash: Schema.String },
  Navigated: {},
  MenuToggled: {},
  LanguageMenuToggled: {},
  LanguageMenuClosed: {},
  NavToggled: { path: Schema.String },
  SearchChanged: { message: Search.Message },
  SpoilersChanged: { message: Spoilers.Message },
  ProgressChanged: { message: Progress.Message },
  QuizChanged: { message: Quiz.Message },
  ProjectChanged: { message: Project.Message },
})
export type Message = typeof Message.Type

export const normalize = (pathname: string): string => {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

/** The language and the logical path a URL path names: `/ja/glossary/latency` is Japanese at `/glossary/latency`. */
export const routeOf = (pathname: string): Readonly<{ locale: Locale; path: string }> => {
  const trimmed = normalize(pathname)
  return { locale: localeOfPath(trimmed), path: normalize(stripLocale(trimmed)) }
}

const Navigate = Command.define('Navigate', {
  args: { url: Schema.String },
  messages: [Message.Navigated],
  execute: ({ url }) =>
    Effect.gen(function* () {
      // The page renders as soon as the URL changes, so its prose must be here first.
      const { locale, path } = routeOf(new URL(url, WIKI_ORIGIN).pathname)
      if (needsProse(locale, path)) yield* Effect.promise(() => loadProse(locale, path))
      yield* pushUrl(url)
      return Message.Navigated()
    }),
})

/** A page the browser reached without a click, such as Back or Forward. Loads its prose, then
    visits it; the URL has already changed, so the old page stays until the new one is ready. */
const LoadPage = Command.define('LoadPage', {
  args: { locale: Locale, path: Schema.String, hash: Schema.String },
  messages: [Message.PageLoaded],
  execute: ({ locale, path, hash }) =>
    Effect.promise(async () => {
      await loadProse(locale, path)
      return Message.PageLoaded({ path, hash })
    }),
})

const LoadExternal = Command.define('LoadExternal', {
  args: { href: Schema.String },
  messages: [Message.Navigated],
  execute: ({ href }) => load(href).pipe(Effect.as(Message.Navigated())),
})

/** A new page starts at its top, or at the heading its hash names. */
const ScrollTo = Command.define('ScrollTo', {
  args: { hash: Schema.String },
  messages: [Message.Navigated],
  execute: ({ hash }) =>
    Effect.sync(() => {
      requestAnimationFrame(() => {
        const target = hash ? document.getElementById(decodeURIComponent(hash)) : null
        if (target) target.scrollIntoView()
        else window.scrollTo(0, 0)
      })
      return Message.Navigated()
    }),
})

/** The nearest ancestor that scrolls on its own. Without one, `scrollIntoView` moves the page. */
const scroller = (element: Element): Element | null => {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node)
    const scrollsX = /auto|scroll/.test(style.overflowX) && node.scrollWidth > node.clientWidth
    const scrollsY = /auto|scroll/.test(style.overflowY) && node.scrollHeight > node.clientHeight
    if (scrollsX || scrollsY) return node
  }
  return null
}

/** The current tab and the current sidebar row come into view once the page has drawn. */
const RevealCurrent = Command.define('RevealCurrent', {
  messages: [Message.Navigated],
  execute: Effect.promise(async () => {
    // A tab is as wide as its label, so its place settles only after the web font loads.
    await document.fonts.ready
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const current = document.querySelectorAll('nav [aria-current]')
    if (current.length === 0) {
      for (const nav of document.querySelectorAll('nav'))
        if (nav.scrollWidth > nav.clientWidth) nav.scrollLeft = 0
      return Message.Navigated()
    }
    for (const entry of current)
      if (scroller(entry)) entry.scrollIntoView({ block: 'nearest', inline: 'start' })
    return Message.Navigated()
  }),
})

const foldSearch = Update.foldChild({
  update: Search.update,
  read: (model: Model) => Option.some(model.search),
  write: (model, search) => ({ ...model, search }),
  toParentMessage: (message) => Message.SearchChanged({ message }),
})

const foldSpoilers = Update.foldChild({
  update: Spoilers.update,
  read: (model: Model) => Option.some(model.spoilers),
  write: (model, spoilers) => ({ ...model, spoilers }),
  toParentMessage: (message) => Message.SpoilersChanged({ message }),
})

const foldProgress = Update.foldChild({
  update: Progress.update,
  read: (model: Model) => Option.some(model.progress),
  write: (model, progress) => ({ ...model, progress }),
  toParentMessage: (message) => Message.ProgressChanged({ message }),
})

const foldQuiz = Update.foldChild({
  update: Quiz.update,
  read: (model: Model) => Option.some(model.quiz),
  write: (model, quiz) => ({ ...model, quiz }),
  toParentMessage: (message) => Message.QuizChanged({ message }),
})

const foldProject = Update.foldChild({
  update: Project.update,
  read: (model: Model) => Option.some(model.project),
  write: (model, project) => ({ ...model, project }),
  toParentMessage: (message) => Message.ProjectChanged({ message }),
})

const loadProject = () =>
  Command.mapMessages([Project.Load()], (message) => Message.ProjectChanged({ message }))

export const init: Runtime.RoutingApplicationInit<Model, Message> = (url) => {
  const { locale, path } = routeOf(url.pathname)
  return {
    model: {
      locale,
      path,
      menu: false,
      languageMenu: false,
      navToggled: [],
      search: Search.init(locale),
      spoilers: Spoilers.init,
      progress: Progress.init,
      quiz: Quiz.init,
      // The home page is the only page with the project card, so it starts the one read.
      project: path === '/' ? { status: 'loading', stats: null } : Project.init,
    },
    commands: [
      RevealCurrent(),
      ...Command.mapMessages([Spoilers.Load()], (message) => Message.SpoilersChanged({ message })),
      ...Command.mapMessages([Progress.Load({ path })], (message) =>
        Message.ProgressChanged({ message }),
      ),
      ...(path === '/' ? loadProject() : []),
    ],
  }
}

type Return = Update.Return<Model, Message>

/** Opens a path in the current language: resets what belongs to the page, records the visit, and
    scrolls to the heading the URL names. */
const visit = (model: Model, path: string, hash: string): Return => {
  const visited = foldProgress(
    {
      ...model,
      path,
      menu: false,
      languageMenu: false,
      navToggled: [],
      search: Search.init(model.locale),
    },
    Progress.Message.Visited({ path }),
  )
  const wantProject = path === '/' && model.project.status === 'idle'
  return {
    model: wantProject
      ? { ...visited.model, project: { status: 'loading', stats: null } }
      : visited.model,
    commands: [
      ScrollTo({ hash }),
      RevealCurrent(),
      ...(visited.commands ?? []),
      ...(wantProject ? loadProject() : []),
    ],
  }
}

export const update = (model: Model, message: Message): Return =>
  Message.match<Return>(message, {
    ClickedLink: ({ request }) =>
      UrlRequest.match<Return>(request, {
        // A page in the other language is a whole page: its copy and prose load with it.
        Internal: ({ url }) =>
          localeOfPath(url.pathname) === model.locale
            ? { model, commands: [Navigate({ url: urlToString(url) })] }
            : { model, commands: [LoadExternal({ href: urlToString(url) })] },
        External: ({ href }) => ({ model, commands: [LoadExternal({ href })] }),
      }),
    ChangedUrl: ({ url }) => {
      if (localeOfPath(url.pathname) !== model.locale)
        return { model, commands: [LoadExternal({ href: urlToString(url) })] }
      const { path } = routeOf(url.pathname)
      const hash = Option.match(url.hash, {
        onNone: () => '',
        onSome: (value) => value.replace(/^#/, ''),
      })
      // A hash on the page you are reading moves to that heading and changes nothing else: the
      // search, the drawer and the open hubs belong to the page, not to the scroll position.
      if (path === model.path) return hash ? { model, commands: [ScrollTo({ hash })] } : { model }
      // Back and Forward change the URL before the page's prose is here; keep the old page until
      // the chunk arrives rather than drawing an empty one.
      if (needsProse(model.locale, path) && !isProseLoaded(model.locale, path))
        return { model, commands: [LoadPage({ locale: model.locale, path, hash })] }
      return visit(model, path, hash)
    },
    PageLoaded: ({ path, hash }) => visit(model, path, hash),
    Navigated: () => ({ model }),
    MenuToggled: () => ({ model: { ...model, menu: !model.menu, languageMenu: false } }),
    LanguageMenuToggled: () => ({
      model: { ...model, languageMenu: !model.languageMenu },
    }),
    LanguageMenuClosed: () => ({ model: { ...model, languageMenu: false } }),
    NavToggled: ({ path }) => ({
      model: {
        ...model,
        navToggled: model.navToggled.includes(path)
          ? model.navToggled.filter((entry) => entry !== path)
          : [...model.navToggled, path],
      },
    }),
    SearchChanged: ({ message }) => foldSearch(model, message),
    SpoilersChanged: ({ message }) => foldSpoilers(model, message),
    ProgressChanged: ({ message }) => foldProgress(model, message),
    QuizChanged: ({ message }) => foldQuiz(model, message),
    ProjectChanged: ({ message }) => foldProject(model, message),
  })
