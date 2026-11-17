import { Effect, Option, Schema } from 'effect'
import { Command, Mount, type Update } from 'foldkit'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { defineMessageUnion } from 'foldkit/message'
import { replaceUrl } from 'foldkit/navigation'
import { defineView } from 'foldkit/submodel'
import {
  Copy,
  Frame,
  LayoutGrid,
  Link,
  Maximize,
  Pause,
  Play,
  RotateCcw,
  Square,
  ZoomIn,
  ZoomOut,
} from 'lucide'
import { BUILD_GROUPS } from '@quorum/simulation/catalog'
import { button } from '@quorum/ui/primitives/button'
import { icon } from '@quorum/ui/primitives/icon'
import { nativeSelect, nativeSelectOption } from '@quorum/ui/primitives/native-select'
import { switch_ } from '@quorum/ui/primitives/switch'
import { css, cx } from '@quorum/styled-system/css'
import {
  DEFAULT_STORY,
  STORIES,
  decodeArgs,
  encodeArgs,
  initialArgs,
  stateArgs,
  storyOf,
  type ArgType,
  type Args,
  type Story,
} from '../catalog/stories.ts'
import { solverReadyForBoard } from '../solver.ts'

export const CATALOG_PATH = '/catalog'

const Value = Schema.Union([Schema.String, Schema.Finite, Schema.Boolean])

export const MODES = ['single', 'grid'] as const
export const BACKGROUNDS = ['surface', 'checker', 'light', 'dark'] as const
export const VIEWPORTS = ['fill', '320', '480', '768'] as const

export const Model = Schema.Struct({
  story: Schema.String,
  args: Schema.Record(Schema.String, Value),
  mode: Schema.Literals(MODES),
  background: Schema.Literals(BACKGROUNDS),
  viewport: Schema.Literals(VIEWPORTS),
  animate: Schema.Boolean,
  outline: Schema.Boolean,
})
export type Model = typeof Model.Type

export const Message = defineMessageUnion({
  PickedStory: { id: Schema.String },
  ChangedArg: { key: Schema.String, value: Value },
  PickedState: { name: Schema.String },
  ResetArgs: {},
  PickedMode: { mode: Schema.Literals(MODES) },
  PickedBackground: { background: Schema.Literals(BACKGROUNDS) },
  PickedViewport: { viewport: Schema.Literals(VIEWPORTS) },
  ToggledAnimate: {},
  ToggledOutline: {},
  Zoomed: { direction: Schema.Literals([1, -1] as const) },
  Fitted: {},
  Copied: { what: Schema.Literals(['link', 'args'] as const) },
  Done: {},
})
export type Message = typeof Message.Type

const firstStory = (): Story => storyOf(DEFAULT_STORY) ?? (STORIES[0] as Story)

const oneOf = <T extends string>(
  options: ReadonlyArray<T>,
  text: string | undefined,
  fallback: T,
): T => options.find((option) => option === text) ?? fallback

export const init = (search: Option.Option<string>): Model => {
  const query = new URLSearchParams(Option.getOrElse(search, () => ''))
  const story = storyOf(query.get('story') ?? '') ?? firstStory()
  return {
    story: story.id,
    args: decodeArgs(story, query.get('args') ?? ''),
    mode: oneOf(MODES, query.get('mode') ?? undefined, 'single'),
    background: oneOf(BACKGROUNDS, query.get('bg') ?? undefined, 'surface'),
    viewport: oneOf(VIEWPORTS, query.get('width') ?? undefined, 'fill'),
    animate: query.get('animate') === 'on',
    outline: query.get('outline') === 'on',
  }
}

const storyOfModel = (model: Model): Story => storyOf(model.story) ?? firstStory()

export const queryOf = (model: Model): string => {
  const story = storyOfModel(model)
  const query = new URLSearchParams()
  query.set('story', story.id)
  const args = encodeArgs(story, model.args)
  if (args !== '') query.set('args', args)
  if (model.mode !== 'single') query.set('mode', model.mode)
  if (model.background !== 'surface') query.set('bg', model.background)
  if (model.viewport !== 'fill') query.set('width', model.viewport)
  if (model.animate) query.set('animate', 'on')
  if (model.outline) query.set('outline', 'on')
  return `${CATALOG_PATH}?${query.toString().replace(/%3A/g, ':').replace(/%3B/g, ';')}`
}

const Paint = Command.define('PaintCatalog', {
  args: {
    story: Schema.String,
    args: Schema.String,
    mode: Schema.Literals(MODES),
    animate: Schema.Boolean,
  },
  messages: [Message.Done],
  execute: ({ story, args, mode, animate }) =>
    Effect.promise(async () => {
      await solverReadyForBoard()
      const [{ boardFor }, { draw }] = await Promise.all([
        import('../catalog/boards.ts'),
        import('../catalog/stage.ts'),
      ])
      const found = storyOf(story)
      if (found) draw(boardFor(found, JSON.parse(args) as Args, mode, animate))
      return Message.Done()
    }),
})

const Sync = Command.define('SyncCatalogUrl', {
  args: { url: Schema.String },
  messages: [Message.Done],
  execute: ({ url }) => replaceUrl(url).pipe(Effect.as(Message.Done())),
})

const Camera = Command.define('MoveCatalogCamera', {
  args: { action: Schema.Literals(['in', 'out', 'fit'] as const) },
  messages: [Message.Done],
  execute: ({ action }) =>
    Effect.promise(async () => {
      const stage = await import('../catalog/stage.ts')
      if (action === 'fit') stage.fit()
      else stage.zoom(action === 'in' ? 1 : -1)
      return Message.Done()
    }),
})

const Copy_ = Command.define('CopyCatalogState', {
  args: { text: Schema.String },
  messages: [Message.Done],
  execute: ({ text }) =>
    Effect.promise(async () => {
      await navigator.clipboard?.writeText(text).catch(() => undefined)
      return Message.Done()
    }),
})

type Return = Update.Return<Model, Message>

export const paint = (model: Model) =>
  Paint({
    story: model.story,
    args: JSON.stringify(model.args),
    mode: model.mode,
    animate: model.animate,
  })

const commandsFor = (model: Model, redraw: boolean) => [
  Sync({ url: queryOf(model) }),
  ...(redraw ? [paint(model)] : []),
]

const changed = (model: Model, redraw = true): Return => ({
  model,
  commands: commandsFor(model, redraw),
})

export const update = (model: Model, message: Message): Return =>
  Message.match<Return>(message, {
    PickedStory: ({ id }) => {
      const story = storyOf(id)
      return story ? changed({ ...model, story: story.id, args: initialArgs(story) }) : { model }
    },
    ChangedArg: ({ key, value }) => changed({ ...model, args: { ...model.args, [key]: value } }),
    PickedState: ({ name }) => {
      const story = storyOfModel(model)
      const state = story.states.find((entry) => entry.name === name)
      return state ? changed({ ...model, args: stateArgs(story, state) }) : { model }
    },
    ResetArgs: () => changed({ ...model, args: initialArgs(storyOfModel(model)) }),
    PickedMode: ({ mode }) => changed({ ...model, mode }),
    PickedBackground: ({ background }) => changed({ ...model, background }, false),
    PickedViewport: ({ viewport }) => {
      const next = { ...model, viewport }
      return { model: next, commands: [...commandsFor(next, false), Camera({ action: 'fit' })] }
    },
    ToggledAnimate: () => changed({ ...model, animate: !model.animate }),
    ToggledOutline: () => changed({ ...model, outline: !model.outline }, false),
    Zoomed: ({ direction }) => ({
      model,
      commands: [Camera({ action: direction === 1 ? 'in' : 'out' })],
    }),
    Fitted: () => ({ model, commands: [Camera({ action: 'fit' })] }),
    Copied: ({ what }) => ({
      model,
      commands: [
        Copy_({
          text:
            what === 'link'
              ? `${location.origin}${queryOf(model)}`
              : JSON.stringify(model.args, null, 2),
        }),
      ],
    }),
    Done: () => ({ model }),
  })

type H = HtmlBuilder<Message>

const CHECKER =
  'conic-gradient(#8884 25%, transparent 0 50%, #8884 0 75%, transparent 0) 0 0 / 16px 16px'

const BACKGROUND_STYLE: Readonly<Record<(typeof BACKGROUNDS)[number], string>> = {
  surface: 'var(--background)',
  checker: CHECKER,
  light: '#ffffff',
  dark: '#141517',
}

const Stage = Mount.define('CatalogStage', {
  messages: [Message.Done],
  execute: ({ element }) =>
    Effect.gen(function* () {
      yield* Effect.promise(() => solverReadyForBoard())
      const { attach } = yield* Effect.promise(() => import('../catalog/stage.ts'))
      yield* Effect.acquireRelease(
        Effect.sync(() => attach(element as HTMLElement)),
        (detach) => Effect.sync(detach),
      )
      return Message.Done()
    }),
})

const Fps = Mount.define('CatalogFps', {
  messages: [Message.Done],
  execute: ({ element }) =>
    Effect.gen(function* () {
      const { meter } = yield* Effect.promise(() => import('../catalog/stage.ts'))
      yield* Effect.acquireRelease(
        Effect.sync(() => meter(element as HTMLElement)),
        (stop) => Effect.sync(stop),
      )
      return Message.Done()
    }),
})

const tool = (
  h: H,
  label: string,
  message: Message,
  content: Html | string,
  active = false,
): Html =>
  button(
    {
      onClick: message,
      variant: active ? 'secondary' : 'ghost',
      size: 'sm',
      attributes: [h.Title(label), h.AriaLabel(label), h.AriaPressed(String(active))],
    },
    content,
    h,
  )

const toolbar = (model: Model, h: H): Html => {
  const glyph = (node: Parameters<typeof icon>[1]) => icon(h, node)
  return h.div(
    [
      h.Class(
        css({
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '1',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid',
          borderColor: 'border',
          padding: '2',
        }),
      ),
    ],
    [
      tool(
        h,
        'Single',
        Message.PickedMode({ mode: 'single' }),
        glyph(Square),
        model.mode === 'single',
      ),
      tool(
        h,
        'States grid',
        Message.PickedMode({ mode: 'grid' }),
        glyph(LayoutGrid),
        model.mode === 'grid',
      ),
      divider(h),
      ...BACKGROUNDS.map((background) =>
        tool(
          h,
          `Background ${background}`,
          Message.PickedBackground({ background }),
          swatch(h, background),
          model.background === background,
        ),
      ),
      divider(h),
      ...VIEWPORTS.map((viewport) =>
        tool(
          h,
          viewport === 'fill' ? 'Full width' : `${viewport} px wide`,
          Message.PickedViewport({ viewport }),
          viewport === 'fill' ? 'Fill' : viewport,
          model.viewport === viewport,
        ),
      ),
      divider(h),
      tool(h, 'Zoom out', Message.Zoomed({ direction: -1 }), glyph(ZoomOut)),
      tool(h, 'Fit', Message.Fitted(), glyph(Maximize)),
      tool(h, 'Zoom in', Message.Zoomed({ direction: 1 }), glyph(ZoomIn)),
      divider(h),
      tool(
        h,
        model.animate ? 'Pause animation' : 'Play animation',
        Message.ToggledAnimate(),
        glyph(model.animate ? Pause : Play),
      ),
      tool(h, 'Outline the stage', Message.ToggledOutline(), glyph(Frame), model.outline),
      tool(h, 'Copy link', Message.Copied({ what: 'link' }), glyph(Link)),
      tool(h, 'Copy args as JSON', Message.Copied({ what: 'args' }), glyph(Copy)),
      h.span(
        [
          h.Class(
            css({
              marginLeft: 'auto',
              fontFamily: 'mono',
              fontSize: 'type.12',
              color: 'mutedForeground',
            }),
          ),
          h.OnMount(Fps()),
        ],
        [],
      ),
    ],
  )
}

const divider = (h: H): Html =>
  h.span(
    [
      h.AriaHidden(true),
      h.Class(css({ width: '1px', height: '5', backgroundColor: 'border', marginInline: '1' })),
    ],
    [],
  )

const swatch = (h: H, background: (typeof BACKGROUNDS)[number]): Html =>
  h.span(
    [
      h.AriaHidden(true),
      h.Class(
        css({
          display: 'block',
          width: '3.5',
          height: '3.5',
          borderRadius: 'sm',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: 'border',
        }),
      ),
      h.Style({ background: BACKGROUND_STYLE[background] }),
    ],
    [],
  )

const stagePane = (model: Model, story: Story, h: H): Html =>
  h.div(
    [
      h.Class(
        css({
          display: 'flex',
          minWidth: '0',
          minHeight: '0',
          flexDirection: 'column',
          overflowY: 'auto',
        }),
      ),
    ],
    [
      toolbar(model, h),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1',
              borderBottomWidth: '1px',
              borderBottomStyle: 'solid',
              borderColor: 'border',
              padding: '2',
            }),
          ),
        ],
        story.states.map((state, index) =>
          model.mode === 'single'
            ? button(
                {
                  onClick: Message.PickedState({ name: state.name }),
                  variant: 'outline',
                  size: 'sm',
                },
                state.name,
                h,
              )
            : h.span(
                [
                  h.Class(
                    css({
                      borderRadius: 'md',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderColor: 'border',
                      paddingInline: '2',
                      paddingBlock: '0.5',
                      fontSize: 'type.12',
                    }),
                  ),
                ],
                [`${index + 1} ${state.name}`],
              ),
        ),
      ),
      h.div(
        [
          h.Class(
            css({
              display: 'flex',
              flex: '1',
              justifyContent: 'center',
              overflow: 'auto',
              padding: '4',
            }),
          ),
        ],
        [
          h.div(
            [
              h.Key('catalog-stage'),
              h.Class(
                css({
                  position: 'relative',
                  height: '70dvh',
                  minHeight: '24rem',
                  maxWidth: '100%',
                  flexShrink: '0',
                }),
              ),
              h.Style({
                width: model.viewport === 'fill' ? '100%' : `${model.viewport}px`,
                background: BACKGROUND_STYLE[model.background],
                outline: model.outline ? '1px dashed #f43f5e' : 'none',
              }),
              h.OnMount(Stage()),
            ],
            [],
          ),
        ],
      ),
    ],
  )

const tree = (model: Model, h: H): Html =>
  h.nav(
    [
      h.AriaLabel('Components'),
      h.Class(
        css({
          overflowY: 'auto',
          borderRightWidth: '1px',
          borderRightStyle: 'solid',
          borderColor: 'border',
          padding: '2',
          lg: { height: 'calc(100dvh - 7.5rem)' },
        }),
      ),
    ],
    BUILD_GROUPS.map(({ key, label }) =>
      h.div(
        [h.Class(css({ marginBottom: '3' }))],
        [
          h.div(
            [
              h.Class(
                css({
                  paddingInline: '2',
                  paddingBlock: '1',
                  fontSize: 'type.12',
                  fontWeight: 'medium',
                  color: 'mutedForeground',
                }),
              ),
            ],
            [label],
          ),
          ...STORIES.filter((story) => story.group === key).map((story) =>
            button(
              {
                onClick: Message.PickedStory({ id: story.id }),
                variant: model.story === story.id ? 'secondary' : 'ghost',
                size: 'sm',
                className: css({ width: '100%', justifyContent: 'flex-start' }),
                attributes: model.story === story.id ? [h.AriaCurrent('true')] : [],
              },
              story.name,
              h,
            ),
          ),
        ],
      ),
    ),
  )

const control = (model: Model, story: Story, arg: ArgType, h: H): Html => {
  const id = `catalog-${story.id}-${arg.key}`
  const value = model.args[arg.key] ?? arg.initial
  switch (arg.control.kind) {
    case 'bool':
      return switch_(
        {
          id,
          isChecked: value === true,
          onToggle: (isChecked) => Message.ChangedArg({ key: arg.key, value: isChecked }),
          label: arg.key,
          size: 'sm',
        },
        h,
      )
    case 'select':
      return nativeSelect(
        {
          id,
          label: arg.key,
          value: String(value),
          size: 'sm',
          onChange: (next) => Message.ChangedArg({ key: arg.key, value: next }),
          options: arg.control.options.map((option) =>
            nativeSelectOption({ value: option, label: option }, h),
          ),
        },
        h,
      )
    case 'range':
      return h.div(
        [h.Class(css({ display: 'grid', gap: '1' }))],
        [
          h.div(
            [
              h.Class(
                css({ display: 'flex', justifyContent: 'space-between', fontSize: 'type.12' }),
              ),
            ],
            [
              h.label([h.For(id), h.Class(css({ fontWeight: 'medium' }))], [arg.key]),
              h.span(
                [h.Class(css({ fontFamily: 'mono', color: 'mutedForeground' }))],
                [String(value)],
              ),
            ],
          ),
          h.input([
            h.Id(id),
            h.Type('range'),
            h.Min(String(arg.control.min)),
            h.Max(String(arg.control.max)),
            h.Step(String(arg.control.step)),
            h.Value(String(value)),
            h.OnInput((next) => Message.ChangedArg({ key: arg.key, value: Number(next) })),
            h.Class(css({ width: '100%', accentColor: 'var(--primary)' })),
          ]),
        ],
      )
  }
}

const controls = (model: Model, story: Story, h: H): Html =>
  h.div(
    [
      h.Class(
        css({
          overflowY: 'auto',
          borderLeftWidth: '1px',
          borderLeftStyle: 'solid',
          borderColor: 'border',
          padding: '3',
          lg: { height: 'calc(100dvh - 7.5rem)' },
        }),
      ),
    ],
    [
      h.div(
        [h.Class(css({ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }))],
        [
          h.span([h.Class(css({ fontWeight: 'medium' }))], [story.name]),
          tool(h, 'Reset args', Message.ResetArgs(), icon(h, RotateCcw)),
        ],
      ),
      ...(['Node', 'Ledger', 'Research'] as const).flatMap((group) => {
        const args = story.argTypes.filter((arg) => arg.group === group)
        return args.length === 0
          ? []
          : [
              h.div(
                [
                  h.Class(
                    css({
                      marginTop: '4',
                      marginBottom: '2',
                      fontSize: 'type.12',
                      fontWeight: 'medium',
                      color: 'mutedForeground',
                    }),
                  ),
                ],
                [group],
              ),
              h.div(
                [h.Class(css({ display: 'grid', gap: '3' }))],
                args.map((arg) => control(model, story, arg, h)),
              ),
            ]
      }),
    ],
  )

export const view = defineView<Model, Message, Record<string, never>>((model, _inputs, h) => {
  const story = storyOfModel(model)
  return h.div(
    [
      h.Class(
        cx(
          css({
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            lg: {
              gridTemplateColumns: '14rem minmax(0, 1fr) 18rem',
              minHeight: 'calc(100dvh - 3.5rem)',
            },
          }),
        ),
      ),
    ],
    [tree(model, h), stagePane(model, story, h), controls(model, story, h)],
  )
})
