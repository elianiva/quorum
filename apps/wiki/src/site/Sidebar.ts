import type { View } from '@effect/ui'
import type { H } from '@effect/ui/html/Html'
import { Check, ChevronDown, ChevronRight, Shield, ShieldOff } from 'lucide'
import { FIGURE, SCROLL } from '@quorum/ui/game/bits'
import { css, cx } from '@quorum/styled-system/css'
import { langOf, type Lang } from '../i18n/lang.ts'
import { childrenOf, navOf } from './pages.ts'
import type { Page } from './page.ts'
import { icon } from './icon.ts'
import { quadrantBadge, quadrantColor } from './quadrant.ts'

export const ALL_ERAS = -1

type Props<Msg> = Readonly<{
  page: Page<Msg> | null
  current: string
  menu: boolean
  toggled: ReadonlyArray<string>
  era: number
  eraOpen: boolean
  onToggle: (path: string) => Msg
  onEra: (era: number) => Msg
  onToggleEraMenu: () => Msg
  onCloseEraMenu: () => Msg
}>

const navLink = <Msg>(
  target: Page<Msg>,
  current: string,
  color: string,
  h: H<Msg>,
  nested = false,
  room = false,
  number: number | null = null,
): View.Content<Msg> => {
  const active = target.path === current
  return h.a
    .key(target.path)
    .attr('href', target.path)
    .attr('aria-current', active ? 'page' : undefined)
    .class(
      cx(
        css({
          position: 'relative',
          display: 'block',
          borderRadius: 'md',
          paddingBlock: '1.5',
          paddingInline: nested ? undefined : room ? undefined : '2.5',
          paddingRight: nested ? '2' : room ? '14' : undefined,
          paddingLeft: nested ? '3' : room ? '2.5' : undefined,
          fontSize: 'type.14',
          lineHeight: 'snug',
          transitionProperty:
            'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
          transitionDuration: 'fast',
          transitionTimingFunction: 'default',
        }),
        active
          ? css({ backgroundColor: 'muted', fontWeight: 'medium', color: 'foreground' })
          : css({
              color: 'mutedForeground',
              _hover: {
                backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)',
                color: 'foreground',
              },
            }),
      ),
    )
    .children(
      active
        ? h.span
            .attr('aria-hidden', 'true')
            .class(
              css({
                position: 'absolute',
                top: '1.5',
                bottom: '1.5',
                left: '0',
                width: '0.5',
                borderRadius: 'full',
              }),
            )
            .style({ background: color })
            .children()
        : h.span.children(),
      number === null
        ? h.span.children(target.title)
        : h.span.class(css({ display: 'flex', alignItems: 'baseline', gap: '1.5' })).children(
            h.span
              .class(
                cx(
                  FIGURE,
                  css({ width: '4', flexShrink: '0', textAlign: 'right', fontSize: 'type.11' }),
                  active
                    ? css({ color: 'foreground' })
                    : css({
                        color: 'color-mix(in oklab, var(--muted-foreground) 70%, transparent)',
                      }),
                ),
              )
              .children(String(number)),
            h.span.class(css({ minWidth: '0', flex: '1 1 0%' })).children(target.title),
          ),
    )
}

const groupLabel = (l: Lang, name: string): string =>
  (l.t.groups as Readonly<Record<string, Readonly<{ name: string }> | undefined>>)[name]?.name ??
  name

const groupBlock = <Msg>(
  l: Lang,
  name: string,
  pages: ReadonlyArray<Page<Msg>>,
  current: string,
  isOpen: boolean,
  color: string,
  onToggle: (path: string) => Msg,
  h: H<Msg>,
): View.Content<Msg> => {
  const numbered = name === 'Scaling steps'
  const label = groupLabel(l, name)
  return h.div
    .key(`group-${name}`)
    .class(css({ marginTop: '2' }))
    .children(
      h.button
        .attr('type', 'button')
        .attr('aria-expanded', isOpen ? 'true' : 'false')
        .attr('aria-label', isOpen ? l.t.sidebar.collapse(label) : l.t.sidebar.expand(label))
        .on('click', onToggle(`group:${name}`))
        .class(
          css({
            display: 'flex',
            width: '100%',
            cursor: 'pointer',
            alignItems: 'center',
            gap: '2',
            borderRadius: 'md',
            paddingInline: '2.5',
            paddingBlock: '1.5',
            textAlign: 'left',
            color: isOpen ? 'foreground' : 'mutedForeground',
            _hover: { backgroundColor: 'color-mix(in oklab, var(--muted) 60%, transparent)' },
          }),
        )
        .children(
          h.span
            .attr('aria-hidden', 'true')
            .class(css({ width: '1.5', height: '1.5', flexShrink: '0', borderRadius: 'full' }))
            .style({ background: color })
            .children(),
          h.span
            .class(
              css({
                minWidth: '0',
                flex: '1 1 0%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontSize: 'type.13',
                fontWeight: 'semibold',
              }),
            )
            .children(label),
          h.span
            .class(cx(FIGURE, css({ fontSize: 'type.11', color: 'mutedForeground' })))
            .children(String(pages.length)),
          icon(h, isOpen ? ChevronDown : ChevronRight, css({ width: '3.5', height: '3.5' })),
        ),
      ...(isOpen
        ? [
            h.div
              .class(
                css({
                  marginTop: '0.5',
                  marginBottom: '1',
                  marginLeft: '1.5',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5',
                  borderLeftWidth: '1px',
                  borderLeftStyle: 'solid',
                  borderColor: 'border',
                }),
              )
              .children(
                ...pages.map((entry) =>
                  navLink(
                    entry,
                    current,
                    color,
                    h,
                    false,
                    false,
                    numbered ? entry.order - 100 : null,
                  ),
                ),
              ),
          ]
        : []),
    )
}

const segmentsOf = <Msg>(
  pages: ReadonlyArray<Page<Msg>>,
): ReadonlyArray<Readonly<{ group: string | null; pages: ReadonlyArray<Page<Msg>> }>> =>
  pages.reduce<Array<{ group: string | null; pages: Array<Page<Msg>> }>>((runs, entry) => {
    const last = runs[runs.length - 1]
    if (last && last.group === entry.group) last.pages.push(entry)
    else runs.push({ group: entry.group, pages: [entry] })
    return runs
  }, [])

const spoilerControl = <Msg>(
  l: Lang,
  era: number,
  eraOpen: boolean,
  onEra: (era: number) => Msg,
  onToggleEraMenu: () => Msg,
  onCloseEraMenu: () => Msg,
  h: H<Msg>,
): View.Content<Msg> => {
  const t = l.t.spoilers
  const all = era === ALL_ERAS
  const value = all ? t.allEras : t.after(l.cat.ERAS[era]?.name ?? '')
  const chip = css({
    display: 'flex',
    height: '8',
    overflow: 'hidden',
    borderRadius: 'md',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'border',
    backgroundColor: 'nested',
  })
  const shield = css({
    display: 'grid',
    width: '8',
    height: '100%',
    flexShrink: '0',
    placeItems: 'center',
    borderRightWidth: '1px',
    borderRightStyle: 'solid',
    borderColor: 'hairline',
    backgroundColor: 'transparent',
    color: all ? 'mutedForeground' : 'foreground',
    cursor: 'pointer',
    _hover: { backgroundColor: 'muted' },
  })
  const item = css({
    display: 'flex',
    width: '100%',
    minWidth: '0',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1',
    borderRadius: 'sm',
    paddingInline: '2',
    paddingBlock: '1.5',
    backgroundColor: 'transparent',
    color: 'foreground',
    cursor: 'pointer',
    fontSize: 'type.12',
    textAlign: 'left',
    _hover: { backgroundColor: 'muted' },
  })
  const chosen = css({ backgroundColor: 'muted', fontWeight: 'medium' })
  const check = css({ width: '3', height: '3', flexShrink: '0', color: 'mutedForeground' })
  return h.div
    .class(
      css({
        borderTopWidth: '1px',
        borderTopStyle: 'solid',
        borderColor: 'border',
        paddingTop: '3',
      }),
    )
    .children(
      h.span
        .class(css({ fontSize: 'type.12', fontWeight: 'semibold', color: 'foreground' }))
        .children(t.title),
      h.div.class(css({ position: 'relative', marginTop: '2' })).children(
        eraOpen
          ? h.button
              .attr('type', 'button')
              .attr('tabindex', '-1')
              .attr('aria-hidden', 'true')
              .on('click', onCloseEraMenu())
              .class(
                css({
                  position: 'fixed',
                  inset: '0',
                  zIndex: '20',
                  borderWidth: '0',
                  padding: '0',
                  backgroundColor: 'transparent',
                  cursor: 'default',
                }),
              )
              .children()
          : h.span.children(),
        h.div.class(cx(chip, css({ position: 'relative', zIndex: '21' }))).children(
          h.button
            .attr('type', 'button')
            .attr('role', 'switch')
            .attr('aria-checked', all ? 'false' : 'true')
            .attr('aria-label', t.hideFuture)
            .attr('title', t.hideFuture)
            .on('click', onEra(all ? 0 : ALL_ERAS))
            .class(shield)
            .children(
              icon(h, all ? ShieldOff : Shield, css({ width: '4', height: '4', flexShrink: '0' })),
            ),
          h.button
            .attr('type', 'button')
            .attr('aria-label', t.chooseEra)
            .attr('aria-haspopup', 'menu')
            .attr('aria-expanded', eraOpen ? 'true' : 'false')
            .on('click', onToggleEraMenu())
            .class(
              css({
                display: 'flex',
                minWidth: '0',
                flex: '1 1 0%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '2',
                paddingInline: '2.5',
                backgroundColor: 'transparent',
                color: 'foreground',
                cursor: 'pointer',
                fontSize: 'type.12',
                _hover: { backgroundColor: 'muted' },
              }),
            )
            .children(
              h.span
                .class(css({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }))
                .children(value),
              icon(
                h,
                ChevronDown,
                css({ width: '3.5', height: '3.5', flexShrink: '0', color: 'mutedForeground' }),
              ),
            ),
        ),
        eraOpen
          ? h.div
              .attr('role', 'menu')
              .attr('aria-label', t.chooseEra)
              .class(
                css({
                  position: 'absolute',
                  right: '0',
                  bottom: 'calc(100% + 6px)',
                  left: '0',
                  zIndex: '22',
                  maxHeight: 'min(60dvh, 260px)',
                  overflowY: 'auto',
                  borderRadius: 'xl',
                  borderWidth: '1px',
                  borderStyle: 'solid',
                  borderColor: 'hairline',
                  backgroundColor: 'popover',
                  boxShadow: 'float',
                  padding: '1',
                }),
              )
              .children(
                h.button
                  .attr('type', 'button')
                  .attr('role', 'menuitemradio')
                  .attr('aria-checked', all ? 'true' : 'false')
                  .attr('aria-label', t.showEvery)
                  .on('click', onEra(ALL_ERAS))
                  .class(cx(item, all ? chosen : undefined))
                  .children(
                    h.span.children(t.allEras),
                    all ? icon(h, Check, check) : h.span.children(),
                  ),
                h.div
                  .class(css({ height: '1px', marginBlock: '1', backgroundColor: 'hairline' }))
                  .children(),
                h.div
                  .class(
                    css({
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: '1',
                    }),
                  )
                  .children(
                    ...l.cat.ERAS.map((eraDef, index) =>
                      h.button
                        .key(eraDef.name)
                        .attr('type', 'button')
                        .attr('role', 'menuitemradio')
                        .attr('aria-checked', era === index ? 'true' : 'false')
                        .on('click', onEra(index))
                        .class(cx(item, era === index ? chosen : undefined))
                        .children(
                          h.span
                            .class(css({ overflow: 'hidden', textOverflow: 'ellipsis' }))
                            .children(eraDef.name),
                          era === index ? icon(h, Check, check) : h.span.children(),
                        ),
                    ),
                  ),
              )
          : h.span.children(),
      ),
    )
}

/** The section navigation, with the desktop rail and the mobile drawer sharing one tree. */
export const Sidebar = <Msg>(
  h: H<Msg>,
  {
    page,
    current,
    menu,
    toggled,
    era,
    eraOpen,
    onToggle,
    onEra,
    onToggleEraMenu,
    onCloseEraMenu,
  }: Props<Msg>,
): View.Content<Msg> => {
  const locale = page?.locale ?? 'en'
  const l = langOf(locale)
  const open = page?.parent ?? page?.path ?? null
  const section = page?.section ?? 'play'
  const color = quadrantColor(section)
  const isOpen = (path: string): boolean => (path === open) !== toggled.includes(path)
  return h.nav
    .attr('aria-label', l.t.quadrants[section].label)
    .class(
      cx(
        SCROLL,
        css({
          borderColor: 'border',
          lg: {
            position: 'sticky',
            top: 'var(--header-height)',
            display: 'flex',
            height: 'calc(100dvh - var(--header-height))',
            flexDirection: 'column',
            alignSelf: 'flex-start',
            borderRightWidth: '1px',
            borderRightStyle: 'solid',
            paddingRight: '4',
          },
        }),
        menu
          ? css({
              position: 'fixed',
              insetInline: '0',
              top: 'var(--header-height)',
              bottom: '0',
              zIndex: '30',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: 'background',
              paddingInline: '4',
              lg: { position: 'static', backgroundColor: 'transparent', paddingInline: '0' },
            })
          : css({ display: 'none' }),
      ),
    )
    .children(
      h.div.class(css({ paddingTop: '4', lg: { paddingTop: '6' } })).children(
        h.div
          .class(
            css({
              marginBottom: '3',
              display: 'flex',
              alignItems: 'center',
              gap: '2',
              paddingInline: '2.5',
            }),
          )
          .children(
            quadrantBadge(section, css({ width: '5', height: '5' }), h),
            h.span
              .class(css({ fontSize: 'type.13', fontWeight: 'semibold', color: 'foreground' }))
              .children(l.t.quadrants[section].label),
          ),
        h.div.class(css({ display: 'flex', flexDirection: 'column', gap: '0.5' })).children(
          ...(segmentsOf(navOf<Msg>(locale, section)).flatMap(
            (segment): ReadonlyArray<View.Content<Msg>> =>
              segment.group !== null
                ? [
                    groupBlock(
                      l,
                      segment.group,
                      segment.pages,
                      current,
                      (segment.pages.some((entry) => entry.path === current) ||
                        (page?.group ?? null) === segment.group) !==
                        toggled.includes(`group:${segment.group}`),
                      color,
                      onToggle,
                      h,
                    ),
                  ]
                : segment.pages.flatMap((hub) => {
                    const kids = childrenOf<Msg>(locale, hub.path)
                    const openHub = isOpen(hub.path)
                    return [
                      h.div
                        .key(`${hub.path}-row`)
                        .class(css({ position: 'relative', display: 'flex', alignItems: 'center' }))
                        .children(
                          h.div
                            .class(css({ minWidth: '0', flex: '1 1 0%' }))
                            .children(navLink(hub, current, color, h, false, kids.length > 0)),
                          kids.length > 0
                            ? h.button
                                .attr('type', 'button')
                                .attr(
                                  'aria-label',
                                  openHub
                                    ? l.t.sidebar.collapse(hub.title)
                                    : l.t.sidebar.expand(hub.title),
                                )
                                .attr('aria-expanded', openHub ? 'true' : 'false')
                                .on('click', onToggle(hub.path))
                                .class(
                                  css({
                                    position: 'absolute',
                                    right: '1',
                                    display: 'flex',
                                    height: '6',
                                    cursor: 'pointer',
                                    alignItems: 'center',
                                    gap: '1',
                                    borderRadius: 'xs',
                                    paddingInline: '1.5',
                                    color: openHub ? 'foreground' : 'mutedForeground',
                                    _hover: {
                                      backgroundColor:
                                        'color-mix(in oklab, var(--foreground) 10%, transparent)',
                                      color: 'foreground',
                                    },
                                  }),
                                )
                                .children(
                                  h.span
                                    .class(cx(FIGURE, css({ fontSize: 'type.11' })))
                                    .children(String(kids.length)),
                                  icon(
                                    h,
                                    openHub ? ChevronDown : ChevronRight,
                                    css({ width: '3.5', height: '3.5' }),
                                  ),
                                )
                            : h.span.children(),
                        ),
                      ...(openHub && kids.length > 0
                        ? [
                            h.div
                              .key(`${hub.path}-children`)
                              .class(
                                css({
                                  marginTop: '0.5',
                                  marginBottom: '1.5',
                                  marginLeft: '3',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.5',
                                  borderLeftWidth: '1px',
                                  borderLeftStyle: 'solid',
                                  borderColor: 'border',
                                  paddingLeft: '1',
                                }),
                              )
                              .children(
                                ...kids.map((child) => navLink(child, current, color, h, true)),
                              ),
                          ]
                        : []),
                    ]
                  }),
          ) as unknown as ReadonlyArray<never>),
        ),
      ),
      h.div
        .class(
          css({
            position: 'sticky',
            bottom: '0',
            marginTop: 'auto',
            backgroundColor: 'background',
            paddingTop: '4',
            paddingBottom: '4',
            lg: { paddingBottom: '6' },
          }),
        )
        .children(spoilerControl(l, era, eraOpen, onEra, onToggleEraMenu, onCloseEraMenu, h)),
    ) as unknown as View.Content<Msg>
}
