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
import * as Catalog from './submodels/catalog.ts'
import * as Spoilers from './submodels/spoilers.ts'

export const Model = Schema.Struct({
  locale: Locale,
  path: Schema.String,
  menu: Schema.Boolean,
  languageMenu: Schema.Boolean,
  navToggled: Schema.Array(Schema.String),
  search: Search.Model,
  spoilers: Spoilers.Model,
  progress: Progress.Model,
  quiz: Quiz.Model,
  project: Project.Model,
  catalog: Catalog.Model,
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
  CatalogChanged: { message: Catalog.Message },
})
export type Message = typeof Message.Type

export const normalize = (pathname: string): string => {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

export const routeOf = (pathname: string): Readonly<{ locale: Locale; path: string }> => {
  const trimmed = normalize(pathname)
  return { locale: localeOfPath(trimmed), path: normalize(stripLocale(trimmed)) }
}

const Navigate = Command.define('Navigate', {
  args: { url: Schema.String },
  messages: [Message.Navigated],
  execute: ({ url }) =>
    Effect.gen(function* () {
      const { locale, path } = routeOf(new URL(url, WIKI_ORIGIN).pathname)
      if (needsProse(locale, path)) yield* Effect.promise(() => loadProse(locale, path))
      yield* pushUrl(url)
      return Message.Navigated()
    }),
})

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

const scroller = (element: Element): Element | null => {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const style = getComputedStyle(node)
    const scrollsX = /auto|scroll/.test(style.overflowX) && node.scrollWidth > node.clientWidth
    const scrollsY = /auto|scroll/.test(style.overflowY) && node.scrollHeight > node.clientHeight
    if (scrollsX || scrollsY) return node
  }
  return null
}

const RevealCurrent = Command.define('RevealCurrent', {
  messages: [Message.Navigated],
  execute: Effect.promise(async () => {
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

const foldCatalog = Update.foldChild({
  update: Catalog.update,
  read: (model: Model) => Option.some(model.catalog),
  write: (model, catalog) => ({ ...model, catalog }),
  toParentMessage: (message) => Message.CatalogChanged({ message }),
})

const paintCatalog = (catalog: Catalog.Model) =>
  Command.mapMessages([Catalog.paint(catalog)], (message) => Message.CatalogChanged({ message }))

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
      project: path === '/' ? { status: 'loading', stats: null } : Project.init,
      catalog: Catalog.init(path === Catalog.CATALOG_PATH ? url.search : Option.none()),
    },
    commands: [
      ...(path === Catalog.CATALOG_PATH ? paintCatalog(Catalog.init(url.search)) : []),
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
      ...(path === Catalog.CATALOG_PATH ? paintCatalog(model.catalog) : []),
    ],
  }
}

export const update = (model: Model, message: Message): Return =>
  Message.match<Return>(message, {
    ClickedLink: ({ request }) =>
      UrlRequest.match<Return>(request, {
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
      if (path === model.path) return hash ? { model, commands: [ScrollTo({ hash })] } : { model }
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
    CatalogChanged: ({ message }) => foldCatalog(model, message),
  })
