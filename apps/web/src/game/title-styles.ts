/* The title screen's styles (src/game/title.ts): the clock-in splash and the menu.

   The menu is a runbook index on the board's canvas. Choices are lines on a
   bus wire; the focused line fills with ink and lights its node. Everything
   reads the shared tokens of the Panda preset: no palette of its own.

   Motion has three jobs and no others: a page slides from the side its depth
   says (deeper from the right, back from the left), the focused node's stub
   wire draws in, and the first reveal after clocking in staggers the lines.
   Reduced motion keeps the fades and drops the movement.

   A rule that reaches into another element names it by its `qm-*` marker
   class, which carries no style of its own; title.ts's own code finds
   elements by the same markers. A rule that used to win on source order alone
   is written as `&&` so it still wins among atomic classes. The keyframes live
   in apps/web/panda.config.ts. */
import { css, cx } from '@quorum/styled-system/css'

export const ROOT = css({
  position: 'relative',
  height: '100%',
  overflow: 'hidden',
  backgroundColor: 'var(--canvas)',
  color: 'var(--foreground)',
  fontFamily: 'var(--sans)',
})

export const ICON = cx('qm-icon', css({ width: '16px', height: '16px', flexShrink: '0' }))

export const MARK = cx(
  'qm-mark',
  css({
    display: 'block',
    height: 'auto',
    overflow: 'visible',
    '& path': { fill: 'none', stroke: 'currentColor', strokeWidth: '22' },
    '& circle': { fill: 'var(--signal)' },
    '@media (prefers-reduced-motion: reduce)': {
      '& path': { strokeDasharray: 'none !important', animation: 'none !important' },
    },
    ':root[data-motion="reduce"] &': { '& path': { strokeDasharray: 'none', animation: 'none' } },
  }),
)

export const EYEBROW = cx(
  'qm-eyebrow',
  css({
    margin: '0',
    color: 'var(--muted-foreground)',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--type-10-5)',
    fontWeight: 'var(--quorum-font-weights-medium)',
    letterSpacing: 'var(--quorum-letter-spacings-eyebrow)',
    textTransform: 'uppercase',
  }),
)

/* ---- Frame ------------------------------------------------------------- */

export const FRAME = css({
  position: 'absolute',
  inset: '0',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr) auto',
  padding:
    'max(12px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(10px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
})

export const BAR = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  minHeight: '44px',
})

export const TOOLS = css({ display: 'flex', alignItems: 'center', gap: '2px' })

export const DOCK_TOOLS = cx(
  TOOLS,
  css({
    '@media (max-width: 900px), (max-aspect-ratio: 1 / 1)': { justifyContent: 'space-between' },
  }),
)

export const TOOL = css({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  minWidth: '36px',
  height: '36px',
  padding: '0 8px',
  borderRadius: 'var(--radius-lg)',
  color: 'var(--muted-foreground)',
  fontSize: 'var(--type-12-5)',
  fontWeight: 'var(--quorum-font-weights-medium)',
  textDecoration: 'none',
  transition: 'background-color 120ms ease, color 120ms ease',
  '&:hover': { background: 'var(--primary-soft)', color: 'var(--foreground)' },
  '&:focus-visible': {
    outline: '2px solid var(--foreground)',
    outlineOffset: '1px',
    color: 'var(--foreground)',
  },
  '&[aria-pressed="true"]': { background: 'var(--foreground)', color: 'var(--background)' },
  /* A finger is wider than a pointer: every tool grows to 44px. */
  '@media (pointer: coarse), (max-width: 900px)': { minWidth: '44px', height: '44px' },
})

export const TOOL_LABEL = cx(
  'qm-tool-label',
  css({ '@media (max-width: 900px), (max-aspect-ratio: 1 / 1)': { display: 'none' } }),
)

export const BUILD = css({
  fontFamily: 'var(--mono)',
  fontVariantNumeric: 'tabular-nums',
  fontSize: 'var(--type-11)',
})

export const DOCK = css({
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: '16px',
  minHeight: '44px',
  paddingTop: '8px',
  borderTop: '1px solid var(--hairline-soft)',
  '@media (max-width: 900px), (max-aspect-ratio: 1 / 1)': {
    gridTemplateColumns: '1fr',
    justifyItems: 'stretch',
    '& .qm-tool-label': { display: 'inline' },
  },
})

export const KEYS = css({
  display: 'flex',
  gap: '14px',
  color: 'var(--muted-foreground)',
  fontSize: 'var(--type-11-5)',
  '@media (max-width: 900px), (max-aspect-ratio: 1 / 1)': { display: 'none' },
})

export const KEY = css({ display: 'inline-flex', alignItems: 'center', gap: '6px' })

export const DISCLAIMER = css({
  justifySelf: 'center',
  overflow: 'hidden',
  color: 'var(--muted-foreground)',
  fontSize: 'var(--type-11)',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textDecoration: 'none',
  '&:hover': { color: 'var(--foreground)', textDecoration: 'underline' },
  '&:focus-visible': {
    outline: '2px solid var(--foreground)',
    outlineOffset: '2px',
    borderRadius: '4px',
  },
  '@media (max-width: 900px), (max-aspect-ratio: 1 / 1)': { display: 'none' },
})

export const CLOCK = css({
  minWidth: '46px',
  paddingLeft: '6px',
  color: 'var(--foreground)',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--type-12)',
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'right',
})

/* ---- The tree: a stage, the world the camera moves, a column a page ------
   The camera centres the open column, then shifts right as far as it needs to
   keep the line it grew from readable. A column's left edge follows its depth,
   set as --d. */

export const STAGE = css({
  position: 'relative',
  minHeight: '0',
  marginInline:
    'calc(-1 * max(16px, env(safe-area-inset-left))) calc(-1 * max(16px, env(safe-area-inset-right)))',
  overflow: 'clip',
  containerType: 'size',
})

export const WORLD = cx(
  'qm-world',
  css({
    '--pad': '24px',
    '--gap': 'clamp(48px, 7cqw, 96px)',
    '--root': 'min(400px, 100cqw - 2 * var(--pad))',
    '--leaf': 'min(680px, 100cqw - 2 * var(--pad))',
    '--w1': 'var(--leaf)',
    position: 'absolute',
    inset: '0',
    transform: 'translateX(calc((100cqw - var(--root)) / 2))',
    translate: '0 var(--camera-y, 0px)',
    transition: 'transform 380ms var(--ease-drawer), translate 380ms var(--ease-drawer)',
    /* Opening a branch reads as two moves: across to the new column, then down
       to its head. Sideways first, so the eye follows the wire, and the drop
       starts as the slide settles. */
    '&[data-pan="open"]': {
      transition: 'transform 300ms var(--ease-drawer), translate 260ms var(--ease-drawer) 240ms',
    },
    /* A wheel notch or a moving focus: the camera follows quickly. A trackpad
       or a finger: it follows 1:1, with no easing to lag behind the hand. */
    '&[data-pan="step"]': {
      transition: 'transform 380ms var(--ease-drawer), translate 160ms var(--ease-out)',
    },
    '&[data-pan="track"]': { transition: 'transform 380ms var(--ease-drawer)' },
    '&&.is-still': { transition: 'none' },
    /* A list that opens a further branch (Settings, Companies) is as narrow as
       the root, so it still shows beside the branch it opened. */
    '&:has(> .qm-page.is-list[data-depth="1"])': { '--w1': 'var(--root)' },
    '&[data-depth="1"]': {
      transform: 'translateX(calc((100cqw - var(--w1)) / 2 - var(--root) - var(--gap)))',
    },
    '&[data-depth="2"]': {
      transform:
        'translateX(calc((100cqw - var(--leaf)) / 2 - var(--root) - 2 * var(--gap) - var(--w1)))',
    },
    '@media (max-width: 900px), (max-aspect-ratio: 1 / 1)': { '--pad': '16px' },
    '@media (prefers-reduced-motion: reduce)': {
      transition: 'none',
      '&[data-pan]': { transition: 'none' },
    },
  }),
)

/* Columns take their full height on the canvas; the camera scrolls, not the
   column. The open branch's line stays lit in the parent while the rest dims.
   A branch grows out of its wire; a closed one draws back toward it. */
export const PAGE = cx(
  'qm-page',
  css({
    position: 'absolute',
    top: '0',
    left: 'calc(var(--root) + var(--gap) + (var(--d) - 1) * (var(--w1) + var(--gap)))',
    width: 'var(--leaf)',
    '&.is-list': { width: 'var(--root)' },
    '&.is-main': { left: '0', width: 'var(--root)' },
    '&:not(.is-active) .qm-hero-title': { opacity: '0.4', transition: 'opacity 200ms ease' },
    '&:not(.is-active) .qm-readout > :not(.is-open)': {
      opacity: '0.4',
      transition: 'opacity 200ms ease',
    },
    '&:not(.is-active) .qm-eyebrow': { opacity: '0.4', transition: 'opacity 200ms ease' },
    '&:not(.is-active) .qm-line:not(.is-open)': {
      opacity: '0.4',
      transition: 'opacity 200ms ease',
    },
    '&:not(.is-active) .qm-sub-head': { opacity: '0.4', transition: 'opacity 200ms ease' },
    '&:not(.is-active) .qm-note': { opacity: '0.4', transition: 'opacity 200ms ease' },
    '@media (hover: hover) and (pointer: fine)': {
      '&:not(.is-active):hover .qm-hero-title': { opacity: '0.8' },
      '&:not(.is-active):hover .qm-readout > :not(.is-open)': { opacity: '0.8' },
      '&:not(.is-active):hover .qm-eyebrow': { opacity: '0.8' },
      '&:not(.is-active):hover .qm-line:not(.is-open)': { opacity: '0.8' },
      '&:not(.is-active):hover .qm-sub-head': { opacity: '0.8' },
      '&:not(.is-active):hover .qm-note': { opacity: '0.8' },
    },
    '&[data-enter="fade"]': { animation: 'qm-fade 200ms var(--ease-out) both' },
    '&[data-enter="branch"] > *': { animation: 'qm-branch 280ms var(--ease-out) 60ms both' },
    '&.is-leaving': { animation: 'qm-leave 160ms var(--ease-out) both' },
    /* The first reveal after clocking in: the lines arrive down the wire. */
    '&[data-enter="first"]': { animation: 'none' },
    '&[data-enter="first"] .qm-hero': { animation: 'qm-rise 320ms var(--ease-out) both' },
    '&[data-enter="first"] .qm-section': { animation: 'qm-rise 320ms var(--ease-out) both' },
    '&[data-enter="first"] .qm-section:nth-child(2)': { animationDelay: '50ms' },
    '&[data-enter="first"] .qm-section:nth-child(3)': { animationDelay: '100ms' },
    '&[data-enter="first"] .qm-section:nth-child(4)': { animationDelay: '150ms' },
    '&[data-enter="first"] .qm-hero .qm-mark path': {
      strokeDasharray: '1',
      animation: 'qm-draw 520ms var(--ease-out) both',
      animationDelay: 'calc(var(--i) * 45ms)',
    },
    /* Reduced motion, from the system or from Settings: fades stay, movement goes. */
    '@media (prefers-reduced-motion: reduce)': {
      '&[data-enter="branch"] > *': { animationName: 'qm-fade' },
      '&.is-leaving': { animationName: 'qm-fade' },
      '&[data-enter="first"] .qm-hero': { animationName: 'qm-fade' },
      '&[data-enter="first"] .qm-section': { animationName: 'qm-fade' },
    },
    ':root[data-motion="reduce"] &': {
      '&[data-enter="branch"] > *': { animationName: 'qm-fade' },
      '&.is-leaving': { animationName: 'qm-fade' },
      '&[data-enter="first"] .qm-hero': { animationName: 'qm-fade' },
      '&[data-enter="first"] .qm-section': { animationName: 'qm-fade' },
    },
  }),
)

export const GHOSTS = cx(
  'qm-ghosts',
  css({ position: 'absolute', inset: '0', pointerEvents: 'none' }),
)

/* The wire from a parent line to the column it opened, drawn as it opens.
   TreeCamera draws each wire as `.qm-wire` with its `.qm-tip` and `.qm-packet`;
   while a packet runs, it draws the stroke and the tip waits for it. */
export const WIRES = cx(
  'qm-wires',
  css({
    position: 'absolute',
    top: '0',
    left: '0',
    width: '1px',
    height: '1px',
    overflow: 'visible',
    pointerEvents: 'none',
    '& .qm-wire path': {
      fill: 'none',
      stroke: 'var(--foreground)',
      strokeWidth: '1.5',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      strokeDasharray: '1',
      animation: 'qm-draw 300ms var(--ease-out) 40ms both',
    },
    '& .qm-wire .qm-tip': {
      fill: 'var(--signal)',
      stroke: 'var(--foreground)',
      strokeWidth: '1.5',
      animation: 'qm-fade 120ms var(--ease-out) 300ms both',
    },
    '& .qm-wire.is-sending path': { animation: 'none' },
    '& .qm-wire.is-sending .qm-tip': { opacity: '0', animation: 'none' },
    '& .qm-packet': { fill: 'var(--signal)', stroke: 'var(--foreground)', strokeWidth: '1.5' },
    '& .qm-wire.is-hit .qm-tip': {
      transformBox: 'fill-box',
      transformOrigin: 'center',
      animation: 'qm-ping 420ms var(--ease-out) both',
    },
    '& .qm-wire.is-leaving': { animation: 'qm-leave-fade 140ms var(--ease-out) both' },
  }),
)

/* ---- Root: the wordmark, the readout, the index ------------------------ */

export const MAIN = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '32px',
  width: '100%',
  padding: '16px 0',
  '@media (max-width: 900px), (max-aspect-ratio: 1 / 1)': { gap: '22px', padding: '8px 0 20px' },
})

export const HERO = cx(
  'qm-hero',
  css({
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
    minWidth: '0',
    '@media (max-width: 900px), (max-aspect-ratio: 1 / 1)': { gap: '18px' },
  }),
)

export const HERO_TITLE = cx(
  'qm-hero-title',
  css({
    margin: '0',
    '& .qm-mark': { width: 'min(100%, 300px)', color: 'var(--foreground)' },
    '@media (max-width: 900px), (max-aspect-ratio: 1 / 1)': {
      '& .qm-mark': { width: 'min(62vw, 240px)' },
    },
  }),
)

export const READOUT = cx(
  'qm-readout',
  css({
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    maxWidth: '420px',
    '& .qm-cta': { width: '100%' },
    '@media (max-width: 900px), (max-aspect-ratio: 1 / 1)': { maxWidth: 'none' },
  }),
)

export const READOUT_HEAD = css({ display: 'flex', alignItems: 'center', gap: '12px' })

export const READOUT_TITLE = css({ display: 'flex', flexDirection: 'column', minWidth: '0' })

export const READOUT_NAME = css({
  overflow: 'hidden',
  fontSize: 'var(--type-18)',
  fontWeight: 'var(--quorum-font-weights-semibold)',
  letterSpacing: 'var(--quorum-letter-spacings-title)',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

export const READOUT_ERA = css({
  color: 'var(--muted-foreground)',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--type-11-5)',
  fontVariantNumeric: 'tabular-nums',
})

/* A company mark is a node on the canvas: a hairline ring around the glyph,
   no plate. The glyph keeps its hue, pulled toward the ink so it reads on
   light and dark. */
export const LOGO = cx(
  'qm-logo',
  css({
    width: '36px',
    height: '36px',
    flexShrink: '0',
    padding: '7px',
    borderRadius: '50%',
    background: 'transparent',
    boxShadow: 'inset 0 0 0 1px var(--edge-solid)',
    '& path': { stroke: 'color-mix(in oklch, currentColor, var(--foreground) 45%)' },
    '&.is-small': { width: '28px', height: '28px', padding: '5px' },
    '&.is-large': { width: '56px', height: '56px', padding: '12px' },
  }),
)

export const LOGO_SMALL = cx(LOGO, 'is-small')
export const LOGO_LARGE = cx(LOGO, 'is-large')

/* The raise bar and the achievements meter span their column. */
export const FULL = css({ width: '100%' })

export const VITALS = css({
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  margin: '0',
  borderTop: '1px solid var(--hairline)',
  '&.is-file': { flex: '1' },
})

export const VITAL = css({
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '8px 0',
  borderBottom: '1px solid var(--hairline)',
  '&:nth-child(odd)': { paddingRight: '14px' },
  '&:nth-child(even)': { paddingLeft: '14px', borderLeft: '1px solid var(--hairline)' },
  '& dt': { color: 'var(--muted-foreground)', fontSize: 'var(--type-12)' },
  '& dd': {
    margin: '0',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--type-14)',
    fontWeight: 'var(--quorum-font-weights-medium)',
    fontVariantNumeric: 'tabular-nums',
  },
})

export const VITAL_OF = css({ color: 'var(--muted-foreground)', fontSize: 'var(--type-11)' })

/* ---- The bus and its lines --------------------------------------------- */

export const INDEX = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '18px',
  padding: '4px 4px 4px 0',
})

/* A section title sits on its own trunk with a solid node, and the items
   below hang from the same line; the bus trunk climbs from its first line to
   the title's node. The logo grid has no trunk, so its label sits at the same
   edge as the rows, not indented over a wire. */
export const SECTION = cx(
  'qm-section',
  css({
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    '& > .qm-eyebrow': { paddingLeft: '26px' },
    '&:not(:has(.qm-grid .qm-logo)) > .qm-eyebrow': {
      position: 'relative',
      color: 'var(--foreground)',
    },
    '&:not(:has(.qm-grid .qm-logo)) > .qm-eyebrow::before': {
      content: '""',
      position: 'absolute',
      top: '50%',
      left: '4px',
      width: '9px',
      height: '9px',
      marginTop: '-4.5px',
      borderRadius: '50%',
      background: 'var(--foreground)',
    },
    '& > .qm-bus::before': { top: '-12.5px' },
    '&:has(.qm-grid > .qm-tile .qm-logo) > .qm-eyebrow': { paddingLeft: '0' },
  }),
)

export const BUS = cx(
  'qm-bus',
  css({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    margin: '0',
    padding: '0 0 0 26px',
    listStyle: 'none',
    /* The wire every line hangs from. */
    '&::before': {
      content: '""',
      position: 'absolute',
      top: '10px',
      bottom: '10px',
      left: '8px',
      width: '1px',
      background: 'var(--edge-solid)',
    },
  }),
)

export const LINE = cx(
  'qm-line',
  css({
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: '28px minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    minHeight: '48px',
    padding: '7px 12px 7px 10px',
    borderRadius: 'var(--radius-lg)',
    color: 'var(--foreground)',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background-color 100ms ease, color 100ms ease',
    '&.is-bare': { gridTemplateColumns: 'minmax(0, 1fr) auto', paddingLeft: '14px' },
    /* Its node on the wire. */
    '&::before': {
      content: '""',
      position: 'absolute',
      top: '50%',
      left: '-22px',
      width: '9px',
      height: '9px',
      marginTop: '-4.5px',
      borderRadius: '50%',
      background: 'var(--canvas)',
      boxShadow: 'inset 0 0 0 1.5px var(--edge-solid)',
      transition: 'background-color 120ms ease, box-shadow 120ms ease',
    },
    /* And the stub that joins node to line when the line holds the focus. */
    '&::after': {
      content: '""',
      position: 'absolute',
      top: '50%',
      left: '-13px',
      width: '13px',
      height: '1.5px',
      marginTop: '-0.75px',
      background: 'var(--foreground)',
      transform: 'scaleX(0)',
      transformOrigin: 'left center',
      transition: 'transform 140ms var(--ease-out)',
    },
    '&:focus-visible': {
      outline: 'none',
      background: 'linear-gradient(var(--primary-fill-top), var(--primary-fill-bottom))',
      color: 'var(--on-primary-fill)',
      boxShadow: 'var(--elev-primary)',
    },
    '&:focus-visible::before': {
      background: 'var(--signal)',
      boxShadow:
        'inset 0 0 0 1.5px var(--foreground), 0 0 0 4px color-mix(in oklab, var(--signal) 35%, transparent)',
    },
    '&:focus-visible::after': { transform: 'scaleX(1)' },
    '&:active:not([aria-disabled="true"])': { transform: 'scale(0.99)' },
    '@media (hover: hover) and (pointer: fine)': {
      '&:hover:not(:focus-visible)': { background: 'var(--primary-soft)' },
      '&:hover:not(:focus-visible)::before': { boxShadow: 'inset 0 0 0 1.5px var(--foreground)' },
    },
    '&[aria-disabled="true"]': { cursor: 'default' },
    '&[aria-disabled="true"]:not(:focus-visible) .qm-label': { color: 'var(--muted-foreground)' },
    '&.is-danger': { color: 'var(--danger)' },
    '&.is-danger:focus-visible': {
      background: 'var(--danger)',
      color: 'var(--destructive-foreground)',
      boxShadow: 'none',
    },
    '&.is-record': { cursor: 'default' },
    '&:focus-visible .qm-num': {
      color: 'color-mix(in oklab, var(--on-primary-fill) 72%, transparent)',
    },
    '&:focus-visible .qm-detail': {
      color: 'color-mix(in oklab, var(--on-primary-fill) 72%, transparent)',
    },
    '&:focus-visible .qm-figure': {
      color: 'color-mix(in oklab, var(--on-primary-fill) 72%, transparent)',
    },
    '&:focus-visible .qm-pips > span': {
      background: 'color-mix(in oklab, var(--on-primary-fill) 30%, transparent)',
    },
    '&:focus-visible .qm-pips > span.is-on': { background: 'var(--on-primary-fill)' },
    '&:focus-visible[aria-checked="true"] .qm-tick': {
      background: 'var(--on-primary-fill)',
      color: 'var(--primary-fill-bottom)',
    },
    '@media (prefers-reduced-motion: reduce)': {
      '&::after': { transition: 'none' },
      '&:active:not([aria-disabled="true"])': { transform: 'none' },
    },
    ':root[data-motion="reduce"] &': {
      '&:active:not([aria-disabled="true"])': { transform: 'none' },
    },
  }),
)

export const NUM = cx(
  'qm-num',
  css({
    color: 'var(--muted-foreground)',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--type-11)',
    fontVariantNumeric: 'tabular-nums',
  }),
)

export const TEXT = css({ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: '0' })

export const LABEL = cx(
  'qm-label',
  css({
    fontSize: 'var(--type-14-5)',
    fontWeight: 'var(--quorum-font-weights-medium)',
    lineHeight: 'var(--quorum-line-heights-dense)',
  }),
)

export const DETAIL = cx(
  'qm-detail',
  css({
    color: 'var(--muted-foreground)',
    fontSize: 'var(--type-12)',
    lineHeight: 'var(--quorum-line-heights-dense)',
  }),
)

export const FIGURE = cx(
  'qm-figure',
  css({
    display: 'inline-flex',
    alignItems: 'center',
    color: 'var(--muted-foreground)',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--type-12)',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  }),
)

export const NOTE = cx(
  'qm-note',
  css({ margin: '4px 0', color: 'var(--muted-foreground)', fontSize: 'var(--type-13)' }),
)

/* Legacy perks: one pip per level, filled as they are bought. */
export const PIPS = cx(
  'qm-pips',
  css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: '2px',
    width: '28px',
    '& > span': {
      width: '4px',
      height: '8px',
      borderRadius: '1px',
      background: 'var(--hairline)',
    },
    '& > span.is-on': { background: 'var(--ok)' },
  }),
)

/* A choice's mark: a ring for one of many, a square for any of many. */
export const TICK = cx(
  'qm-tick',
  css({
    display: 'grid',
    placeItems: 'center',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    boxShadow: 'inset 0 0 0 1.5px var(--edge-solid)',
    '&.is-checkbox': { borderRadius: '4px' },
    '& .qm-icon': { width: '12px', height: '12px', strokeWidth: '3' },
    '[aria-checked="true"] &': {
      background: 'var(--foreground)',
      boxShadow: 'none',
      color: 'var(--background)',
    },
  }),
)

/* ---- Sub pages --------------------------------------------------------- */

export const SUB = css({ display: 'flex', flexDirection: 'column', width: '100%' })

export const SUB_HEAD = cx(
  'qm-sub-head',
  css({
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 0 14px',
  }),
)

export const SUB_TITLE = css({
  margin: '0',
  overflow: 'hidden',
  fontSize: 'var(--type-26)',
  fontWeight: 'var(--quorum-font-weights-semibold)',
  letterSpacing: 'var(--quorum-letter-spacings-title)',
  lineHeight: 'var(--quorum-line-heights-heading)',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  '@media (max-width: 900px), (max-aspect-ratio: 1 / 1)': { fontSize: 'var(--type-20)' },
})

export const SUB_FIGURE = css({
  color: 'var(--muted-foreground)',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--type-13)',
  fontVariantNumeric: 'tabular-nums',
})

export const SUB_BODY = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '22px',
  padding: '4px 4px 24px 2px',
})

/* ---- Tiles ------------------------------------------------------------- */

/* A group of tiles is a subtree drawn as an org chart: the trunk comes down
   the left, each row hangs from a rail off it, and each tile drops from the
   rail onto its node. Three to a row, one on a narrow stage. The first tile of
   a row draws the trunk beside its row and the rail across it, as far as the
   row's last node. Logos stay a swatch grid: each choice is a row on the
   canvas, its swatch, its name, its mark, with no card around it. */
export const GRID = cx(
  'qm-grid',
  css({
    '--cols': '3',
    '--col-gap': '12px',
    '--row-gap': '18px',
    display: 'grid',
    gridTemplateColumns: 'repeat(var(--cols), minmax(0, 1fr))',
    gap: 'var(--row-gap) var(--col-gap)',
    padding: 'calc(var(--row-gap) / 2) 0 0 26px',
    /* No box of its own: the node carries the state. */
    '&:not(:has(.qm-logo)) > .qm-tile': {
      '--node': '17px',
      position: 'relative',
      gap: '2px',
      padding: '8px 10px 8px 28px',
      background: 'transparent',
      boxShadow: 'none',
    },
    /* The stem ends at the choice itself: the tick is the node on the line,
       so a row holds one circle, not a node beside a mark. */
    '&:not(:has(.qm-logo)) > .qm-tile::after': {
      content: '""',
      position: 'absolute',
      top: 'calc(var(--row-gap) / -2)',
      left: '4px',
      width: '9px',
      height: 'calc(var(--row-gap) / 2 + 9px)',
      backgroundImage: 'linear-gradient(var(--edge-solid), var(--edge-solid))',
      backgroundPosition: '4.5px 0',
      backgroundSize: '1px 100%',
      backgroundRepeat: 'no-repeat',
    },
    '&:not(:has(.qm-logo)) > .qm-tile > .qm-tile-head > .qm-tile-state': {
      position: 'absolute',
      top: '9px',
      left: '0.5px',
    },
    /* An open tile has no mark, so it gets the hollow node a bus line wears,
       and its stem runs down to it. */
    '&:not(:has(.qm-logo)) > .qm-tile.is-open:not([aria-checked])::after': {
      height: 'calc(var(--row-gap) / 2 + 12.5px)',
    },
    '&:not(:has(.qm-logo)) > .qm-tile.is-open:not([aria-checked]) .qm-tile-state::before': {
      content: '""',
      width: '9px',
      height: '9px',
      margin: '3.5px',
      borderRadius: '50%',
      background: 'var(--canvas)',
      boxShadow: 'inset 0 0 0 1.5px var(--edge-solid)',
    },
    '&:not(:has(.qm-logo)) > .qm-tile:nth-child(3n + 1)::before': {
      '--n': '3',
      content: '""',
      position: 'absolute',
      top: 'calc(var(--row-gap) / -2 - var(--up))',
      bottom: 'calc(var(--row-gap) / -2)',
      left: '-18px',
      width: 'calc(26.5px + (var(--n) - 1) * (100% + var(--col-gap)))',
      backgroundImage:
        'linear-gradient(var(--edge-solid), var(--edge-solid)), linear-gradient(var(--edge-solid), var(--edge-solid))',
      backgroundPosition: '0 var(--up), 0 0',
      backgroundSize: '100% 1px, 1px 100%',
      backgroundRepeat: 'no-repeat',
    },
    '&:not(:has(.qm-logo)) > .qm-tile:nth-child(3n + 1):nth-last-child(2)::before': {
      '--n': '2',
    },
    '&:not(:has(.qm-logo)) > .qm-tile:nth-child(3n + 1):nth-last-child(1)::before': {
      '--n': '1',
    },
    /* The last row ends the trunk at its rail. */
    '&:not(:has(.qm-logo)) > .qm-tile:nth-child(3n + 1):nth-last-child(-n + 3)::before': {
      bottom: 'auto',
      height: 'calc(var(--up) + 1px)',
    },
    '@container (max-width: 560px)': {
      '--cols': '1',
      '&:not(:has(.qm-logo)) > .qm-tile:nth-child(n)::before': {
        '--n': '1',
        content: '""',
        position: 'absolute',
        top: 'calc(var(--row-gap) / -2 - var(--up))',
        bottom: 'calc(var(--row-gap) / -2)',
        left: '-18px',
        width: 'calc(26.5px + (var(--n) - 1) * (100% + var(--col-gap)))',
        backgroundImage:
          'linear-gradient(var(--edge-solid), var(--edge-solid)), linear-gradient(var(--edge-solid), var(--edge-solid))',
        backgroundPosition: '0 var(--up), 0 0',
        backgroundSize: '100% 1px, 1px 100%',
        backgroundRepeat: 'no-repeat',
      },
      '&:not(:has(.qm-logo)) > .qm-tile:nth-child(n):nth-last-child(n + 2)::before': {
        bottom: 'calc(var(--row-gap) / -2)',
        height: 'auto',
      },
      '&:not(:has(.qm-logo)) > .qm-tile:nth-child(n):last-child::before': {
        bottom: 'auto',
        height: 'calc(var(--up) + 1px)',
      },
    },
    /* The trunk starts under the group's label. */
    '& > .qm-tile': { '--up': '0px' },
    '& > .qm-tile:first-child': { '--up': '14px' },
    '& > .qm-tile.is-next': { '--node-fill': 'var(--signal)', '--node-ring': 'var(--foreground)' },
    '& > .qm-tile.is-done': { '--node-fill': 'var(--ok)', '--node-ring': 'var(--ok)' },
    '& > .qm-tile.is-on': {
      '--node-fill': 'var(--foreground)',
      '--node-ring': 'var(--foreground)',
    },
    /* A flat tile keeps its ground on focus: the ring, the lit node and ink
       text mark it, so the detail stays readable. */
    '&:not(:has(.qm-logo)) > .qm-tile:focus-visible': {
      '--node-fill': 'var(--signal)',
      '--node-ring': 'var(--foreground)',
      background: 'transparent',
      boxShadow: 'none',
      color: 'var(--foreground)',
      outline: '2px solid var(--foreground)',
      outlineOffset: '2px',
    },
    '&:not(:has(.qm-logo)) > .qm-tile:focus-visible .qm-tile-name': {
      color: 'var(--foreground)',
    },
    '&:not(:has(.qm-logo)) > .qm-tile:focus-visible .qm-tile-detail': {
      color: 'var(--muted-foreground)',
    },
    '&:not(:has(.qm-logo)) > .qm-tile:focus-visible .qm-tile-figure': {
      color: 'var(--muted-foreground)',
    },
    '&:not(:has(.qm-logo)) > .qm-tile:focus-visible .qm-tile-state': {
      color: 'var(--muted-foreground)',
    },
    '&:has(.qm-logo)': {
      gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))',
      gap: '10px 6px',
      padding: '0',
    },
    '&:has(.qm-logo) > .qm-tile': {
      alignItems: 'center',
      gap: '8px',
      minHeight: '0',
      padding: '6px 4px',
      borderRadius: 'var(--radius-md)',
      background: 'transparent',
      boxShadow: 'none',
      textAlign: 'center',
    },
    '&:has(.qm-logo) > .qm-tile .qm-tile-head': {
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px',
    },
    /* The chosen mark carries the state, so the tick has no job here. */
    '&:has(.qm-logo) > .qm-tile .qm-tile-state': { display: 'none' },
    '&:has(.qm-logo) .qm-logo': { width: '40px', height: '40px', padding: '9px' },
    '&:has(.qm-logo) > .qm-tile .qm-tile-name': {
      color: 'var(--muted-foreground)',
      fontSize: 'var(--type-12)',
    },
    /* Chosen: a flat signal ring around the mark, as the open station wears. */
    '&:has(.qm-logo) > .qm-tile.is-on .qm-logo': {
      boxShadow:
        'inset 0 0 0 1px var(--foreground), 0 0 0 3px var(--canvas), 0 0 0 5px var(--signal)',
    },
    '&:has(.qm-logo) > .qm-tile.is-on .qm-tile-name': {
      color: 'var(--foreground)',
      fontWeight: 'var(--quorum-font-weights-semibold)',
    },
    '&:has(.qm-logo) > .qm-tile:focus-visible': {
      outline: '2px solid var(--foreground)',
      outlineOffset: '2px',
      background: 'transparent',
      boxShadow: 'none',
      color: 'var(--foreground)',
    },
    '@media (hover: hover) and (pointer: fine)': {
      '&:not(:has(.qm-logo)) > .qm-tile.is-open:not([aria-checked]):hover .qm-tile-state::before': {
        boxShadow: 'inset 0 0 0 1.5px var(--foreground)',
      },
      '&:not(:has(.qm-logo)) > .qm-tile:not(.is-badge, [aria-disabled="true"]):hover:not(:focus-visible)':
        {
          '--node-ring': 'var(--foreground)',
          background: 'var(--primary-soft)',
          boxShadow: 'none',
        },
      '&:has(.qm-logo) > .qm-tile:hover:not(.is-on) .qm-logo': {
        boxShadow: 'inset 0 0 0 1px var(--foreground)',
      },
      '&:has(.qm-logo) > .qm-tile:hover:not(:focus-visible)': {
        background: 'var(--primary-soft)',
        boxShadow: 'none',
      },
      '&:has(.qm-logo) > .qm-tile:hover .qm-tile-name': { color: 'var(--foreground)' },
    },
  }),
)

export const TILE = cx(
  'qm-tile',
  css({
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minHeight: '48px',
    padding: '10px 12px',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--card)',
    boxShadow: '0 0 0 1px var(--hairline)',
    color: 'var(--foreground)',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background-color 100ms ease, box-shadow 100ms ease',
    '&.is-done .qm-tile-state': { color: 'var(--ok)' },
    '&.is-locked': { background: 'transparent', boxShadow: 'inset 0 0 0 1px var(--hairline)' },
    '&.is-locked .qm-tile-name': { color: 'var(--muted-foreground)' },
    '&.is-on': { boxShadow: '0 0 0 1.5px var(--foreground)' },
    '&.is-badge': { cursor: 'default' },
    '@media (hover: hover) and (pointer: fine)': {
      '&:not(.is-badge, [aria-disabled="true"]):hover:not(:focus-visible)': {
        background: 'var(--surface-nested)',
        boxShadow: '0 0 0 1px var(--foreground)',
      },
    },
    '&:focus-visible': {
      outline: 'none',
      background: 'linear-gradient(var(--primary-fill-top), var(--primary-fill-bottom))',
      boxShadow:
        'var(--elev-primary), 0 0 0 3px color-mix(in oklab, var(--signal) 45%, transparent)',
      color: 'var(--on-primary-fill)',
    },
    '&:focus-visible .qm-tile-detail': {
      color: 'color-mix(in oklab, var(--on-primary-fill) 80%, transparent)',
    },
    '&:focus-visible .qm-tile-figure': {
      color: 'color-mix(in oklab, var(--on-primary-fill) 80%, transparent)',
    },
    '&:focus-visible .qm-tile-state': {
      color: 'color-mix(in oklab, var(--on-primary-fill) 80%, transparent)',
    },
    '&:focus-visible .qm-tile-name': { color: 'var(--on-primary-fill)' },
    '&:focus-visible[aria-checked="true"] .qm-tick': {
      background: 'var(--on-primary-fill)',
      color: 'var(--primary-fill-bottom)',
    },
    '&[aria-disabled="true"]': { cursor: 'default' },
  }),
)

export const TILE_HEAD = cx(
  'qm-tile-head',
  css({ display: 'flex', alignItems: 'center', gap: '8px' }),
)

export const TILE_NAME = cx(
  'qm-tile-name',
  css({
    flex: '1',
    minWidth: '0',
    fontSize: 'var(--type-13-5)',
    fontWeight: 'var(--quorum-font-weights-medium)',
    lineHeight: 'var(--quorum-line-heights-dense)',
  }),
)

export const TILE_STATE = cx(
  'qm-tile-state',
  css({ display: 'inline-flex', color: 'var(--muted-foreground)' }),
)

export const TILE_DETAIL = cx(
  'qm-tile-detail',
  css({
    color: 'var(--muted-foreground)',
    fontSize: 'var(--type-12)',
    lineHeight: 'var(--quorum-line-heights-dense)',
  }),
)

export const TILE_FIGURE = cx(
  'qm-tile-figure',
  css({
    marginTop: 'auto',
    color: 'var(--muted-foreground)',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--type-11-5)',
    fontVariantNumeric: 'tabular-nums',
  }),
)

/* ---- Founding form: three stations on one trunk ------------------------ */

export const PHASES = css({
  display: 'flex',
  flexDirection: 'column',
  margin: '0',
  padding: '0',
  listStyle: 'none',
})

export const PHASE = css({
  position: 'relative',
  '&:not(:last-child)': { paddingBottom: '18px' },
  /* The trunk runs from this station's node to the next one's. */
  '&:not(:last-child)::before': {
    content: '""',
    position: 'absolute',
    top: '22px',
    bottom: '-11px',
    left: '10.5px',
    width: '1px',
    background: 'var(--edge-solid)',
  },
  '&&.is-done::before': { background: 'var(--foreground)' },
  '&.is-open .qm-phase-head': { position: 'relative', cursor: 'default' },
  /* The open station's title sits on a rail of its own, run out of the node,
     so the heading is part of the drawing. */
  '&.is-open > .qm-phase-head::after': {
    content: '""',
    position: 'absolute',
    right: '0',
    bottom: '-2px',
    left: '11px',
    height: '1px',
    background: 'var(--edge-solid)',
  },
  '&.is-done .qm-phase-node': {
    background: 'var(--foreground)',
    boxShadow: 'none',
    color: 'var(--background)',
  },
  /* This station: an ink node with a flat signal ring, no glow. */
  '&.is-open .qm-phase-node': {
    background: 'var(--foreground)',
    boxShadow: '0 0 0 2px var(--canvas), 0 0 0 4px var(--signal)',
    color: 'var(--background)',
  },
  '&.is-open .qm-phase-label': { color: 'var(--foreground)' },
})

export const PHASE_HEAD = cx(
  'qm-phase-head',
  css({
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    minHeight: '22px',
    padding: '0',
    borderRadius: '4px',
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
    '&:focus-visible': { outline: '2px solid var(--foreground)', outlineOffset: '4px' },
  }),
)

export const PHASE_NODE = cx(
  'qm-phase-node',
  css({
    display: 'grid',
    flex: '0 0 auto',
    placeItems: 'center',
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: 'var(--canvas)',
    boxShadow: 'inset 0 0 0 1.5px var(--edge-solid)',
    color: 'var(--muted-foreground)',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--type-11)',
    fontVariantNumeric: 'tabular-nums',
    '& .qm-icon': { width: '12px', height: '12px', strokeWidth: '3' },
  }),
)

export const PHASE_LABEL = cx(
  'qm-phase-label',
  css({
    color: 'var(--muted-foreground)',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--type-11)',
    letterSpacing: 'var(--quorum-letter-spacings-stamp)',
    textTransform: 'uppercase',
  }),
)

/* What the station holds, on the line: the value, not a second label. */
export const PHASE_VALUE = css({
  minWidth: '0',
  marginLeft: 'auto',
  overflow: 'hidden',
  color: 'var(--foreground)',
  fontSize: 'var(--type-13-5)',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
})

export const PHASE_GO = css({
  display: 'inline-flex',
  flex: '0 0 auto',
  color: 'var(--muted-foreground)',
  '& .qm-icon': { width: '14px', height: '14px' },
})

/* The open station's fields hang off the trunk on a short branch. The grid's
   top rail is the title's rail: the body starts where that rail runs, so the
   title sits on it. A grid under a station puts its trunk on the station's
   own line, so the two read as one spine. */
export const PHASE_BODY = cx(
  'qm-phase-body',
  css({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
    margin: '14px 0 0 32px',
    '&:has(> .qm-grid)': { marginTop: '-2px' },
    '&& > .qm-grid:not(:has(.qm-logo)) > .qm-tile::before': {
      left: '-47.5px',
      width: 'calc(56px + (var(--n, 1) - 1) * (100% + var(--col-gap)))',
    },
    '&[data-enter="branch"] > *': { animation: 'qm-branch 280ms var(--ease-out) 60ms both' },
    '@media (prefers-reduced-motion: reduce)': {
      '&[data-enter="branch"] > *': { animationName: 'qm-fade' },
    },
  }),
)

export const FIELD = css({ display: 'flex', flexDirection: 'column', gap: '8px' })

export const FOOT = css({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
  padding: '12px 0 4px',
  borderTop: '1px solid var(--hairline)',
  '@media (max-width: 900px), (max-aspect-ratio: 1 / 1)': {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
})

export const PREVIEW = css({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  minWidth: '0',
  '& .qm-label': { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
})

export const FOOT_ACTIONS = css({
  display: 'flex',
  gap: '8px',
  '@media (max-width: 900px), (max-aspect-ratio: 1 / 1)': {
    flexDirection: 'column-reverse',
    '& .qm-cta': { width: '100%' },
  },
})

export const FILE = css({
  display: 'flex',
  alignItems: 'center',
  gap: '18px',
  '@media (max-width: 900px), (max-aspect-ratio: 1 / 1)': {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
})

/* ---- Settings ---------------------------------------------------------- */

export const SETTING = cx(
  'qm-setting',
  css({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    minHeight: '48px',
    padding: '7px 12px 7px 14px',
    borderRadius: 'var(--radius-lg)',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: '50%',
      left: '-22px',
      width: '9px',
      height: '9px',
      marginTop: '-4.5px',
      borderRadius: '50%',
      background: 'var(--canvas)',
      boxShadow: 'inset 0 0 0 1.5px var(--edge-solid)',
    },
    '&:focus-within': { background: 'var(--primary-soft)' },
    '&:has(:focus-visible)::before': {
      background: 'var(--signal)',
      boxShadow:
        'inset 0 0 0 1.5px var(--foreground), 0 0 0 4px color-mix(in oklab, var(--signal) 35%, transparent)',
    },
    '&.is-split': { justifyContent: 'space-between', gap: '12px' },
    '&.is-volume > *': { width: '100%' },
  }),
)

/* The switch's own wrapper keeps its gap: the label sits across from the switch. */
export const SWITCH_ROW = css({
  width: '100%',
  flexDirection: 'row-reverse',
  justifyContent: 'space-between',
})

/* The kit's switch and slider thumb keep their own outline style (none and
   hidden), as they did when this was a components-layer rule under them. */
export const FOCUS_OUTLINE = css({
  '&:focus-visible': {
    outlineWidth: '2px',
    outlineColor: 'var(--foreground)',
    outlineOffset: '2px',
  },
})

/* The volume thumb draws the whole ring: the old rule beat the kit's hidden outline. */
export const THUMB_FOCUS = css({
  '&&:focus-visible': {
    outlineStyle: 'solid',
    outlineWidth: '2px',
    outlineColor: 'var(--foreground)',
    outlineOffset: '2px',
  },
})

/* ---- Connecting -------------------------------------------------------- */

export const CONNECT = cx(
  'qm-connect',
  css({
    position: 'absolute',
    inset: '0',
    zIndex: '5',
    display: 'grid',
    placeItems: 'center',
    background: 'color-mix(in oklab, var(--canvas) 80%, transparent)',
    animation: 'qm-fade 160ms var(--ease-out) both',
  }),
)

export const CONNECT_CARD = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  width: 'min(360px, calc(100vw - 32px))',
  padding: '16px 18px',
  borderRadius: 'var(--radius-xl)',
  background: 'var(--card)',
  boxShadow: 'var(--elev-float)',
  fontFamily: 'var(--mono)',
})

export const CONNECT_HOST = css({
  fontSize: 'var(--type-13)',
  fontWeight: 'var(--quorum-font-weights-medium)',
})

export const CONNECT_LINE = css({
  height: '2px',
  marginTop: '6px',
  overflow: 'hidden',
  borderRadius: '1px',
  background: 'var(--hairline)',
  '&::after': {
    content: '""',
    display: 'block',
    height: '100%',
    background: 'var(--signal)',
    transformOrigin: 'left',
    animation: 'qm-fill 1100ms linear both',
  },
})

export const CONNECT_OK = css({
  color: 'var(--ok)',
  fontSize: 'var(--type-12)',
  animation: 'qm-fade 120ms 1050ms both',
})

/* ---- Clock-in splash --------------------------------------------------- */

/* A wall badge reader. The badge hangs out of the slot; on a click it slides
   in, the LED turns green, the screen says so, and the reader steps back for
   the menu. The plastic follows the theme; the screen stays dark glass. */
export const SPLASH = css({
  position: 'absolute',
  inset: '0',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  padding: '24px',
})

export const READER = css({
  '--reader-shell': 'linear-gradient(170deg, oklch(0.985 0.001 260), oklch(0.9 0.003 260) 60%)',
  '--reader-shell-edge':
    'inset 0 1px 0 oklch(1 0 0 / 0.9), inset 0 -3px 0 oklch(0 0 0 / 0.08), 0 0 0 1px oklch(0 0 0 / 0.1), 0 40px 70px -24px oklch(0.3 0.01 260 / 0.35)',
  '--reader-screw':
    'radial-gradient(circle at 35% 30%, oklch(0.95 0.002 260), oklch(0.7 0.004 260))',
  '--reader-slot-lip': '0 1px 0 oklch(1 0 0 / 0.9), 0 -1px 0 oklch(0 0 0 / 0.12)',
  '--reader-card':
    'radial-gradient(ellipse 120% 70% at 50% 0%, oklch(0.8 0.12 225 / 0.12), transparent 70%), linear-gradient(170deg, oklch(0.995 0 0), oklch(0.93 0.003 260))',
  '--reader-card-edge':
    'inset 1px 0 0 oklch(1 0 0 / 0.9), inset -1px 0 0 oklch(0 0 0 / 0.06), inset 0 -2px 0 oklch(0 0 0 / 0.08), 0 14px 22px -8px oklch(0.3 0.01 260 / 0.35)',
  '--reader-card-ink': 'oklch(0.3 0.006 260)',
  '--reader-card-name': 'oklch(0.52 0.008 260)',
  position: 'relative',
  width: '240px',
  height: '440px',
  animation: 'reader-in 500ms var(--ease-out) both',
  '.dark &': {
    '--reader-shell': 'linear-gradient(170deg, oklch(0.3 0.006 260), oklch(0.19 0.004 260) 60%)',
    '--reader-shell-edge':
      'inset 0 1px 0 oklch(1 0 0 / 0.14), inset 0 -3px 0 oklch(0 0 0 / 0.45), 0 0 0 1px oklch(0 0 0 / 0.6), 0 40px 70px -24px oklch(0 0 0 / 0.9)',
    '--reader-screw':
      'radial-gradient(circle at 35% 30%, oklch(0.5 0.004 260), oklch(0.22 0.004 260))',
    '--reader-slot-lip': '0 1px 0 oklch(1 0 0 / 0.12), 0 -1px 0 oklch(0 0 0 / 0.5)',
    '--reader-card':
      'radial-gradient(ellipse 120% 70% at 50% 0%, oklch(0.8 0.12 225 / 0.1), transparent 70%), linear-gradient(170deg, oklch(0.34 0.006 260), oklch(0.23 0.005 260))',
    '--reader-card-edge':
      'inset 1px 0 0 oklch(1 0 0 / 0.08), inset -1px 0 0 oklch(0 0 0 / 0.3), inset 0 -2px 0 oklch(0 0 0 / 0.35), 0 14px 22px -8px oklch(0 0 0 / 0.85)',
    '--reader-card-ink': 'oklch(0.88 0.004 260)',
    '--reader-card-name': 'oklch(0.7 0.006 260)',
  },
  '&.is-in': { animation: 'reader-out 240ms var(--ease-out) 700ms both' },
  '&.is-in + .reader-hint': { animation: 'reader-out 240ms var(--ease-out) 700ms both' },
  '@media (hover: hover)': {
    '&:not(.is-in) .reader-card:hover': { transform: 'translateY(-24px)' },
  },
})

export const READER_HINT = cx(
  'reader-hint',
  css({
    margin: '0',
    color: 'var(--muted-foreground)',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--type-11)',
    letterSpacing: 'var(--quorum-letter-spacings-badge-wide)',
    textTransform: 'uppercase',
    animation: 'reader-in 500ms var(--ease-out) 200ms both',
  }),
)

export const READER_BODY = css({
  position: 'absolute',
  inset: '0 0 auto',
  height: '300px',
  borderRadius: '28px',
  background: 'var(--reader-shell)',
  boxShadow: 'var(--reader-shell-edge)',
})

export const READER_SCREW = css({
  position: 'absolute',
  width: '9px',
  height: '9px',
  borderRadius: '50%',
  background:
    'linear-gradient(135deg, transparent 42%, oklch(0 0 0 / 0.45) 42% 58%, transparent 58%), var(--reader-screw)',
  boxShadow: '0 1px 0 oklch(1 0 0 / 0.08)',
  '&.is-tl': { top: '12px', left: '12px' },
  '&.is-tr': { top: '12px', right: '12px' },
  '&.is-bl': { bottom: '12px', left: '12px' },
  '&.is-br': { bottom: '12px', right: '12px' },
})

export const READER_SCREEN = css({
  position: 'absolute',
  inset: '30px 26px auto',
  height: '112px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
  borderRadius: '12px',
  background:
    'repeating-linear-gradient(0deg, oklch(1 0 0 / 0.025) 0 1px, transparent 1px 3px), radial-gradient(ellipse at 50% 40%, oklch(0.24 0.04 220), oklch(0.13 0.02 230))',
  boxShadow: 'inset 0 2px 8px oklch(0 0 0 / 0.8), 0 1px 0 oklch(1 0 0 / 0.1)',
  color: 'var(--signal)',
  fontFamily: 'var(--mono)',
  textShadow: '0 0 10px oklch(0.8 0.12 225 / 0.55)',
})

export const READER_TIME = css({
  fontSize: 'var(--type-34)',
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: 'var(--quorum-letter-spacings-label)',
})

export const READER_STATUS = css({
  display: 'grid',
  fontSize: 'var(--type-10-5)',
  letterSpacing: 'var(--quorum-letter-spacings-stamp)',
  textTransform: 'uppercase',
  '& > *': { gridArea: '1 / 1', textAlign: 'center' },
})

export const READER_STATUS_OUT = css({
  animation: 'reader-blink 1.6s steps(1, end) infinite',
  '.is-in &': { animation: 'reader-hide 0s 320ms forwards' },
})

export const READER_STATUS_IN = css({
  visibility: 'hidden',
  color: 'oklch(0.74 0.15 155)',
  textShadow: '0 0 10px oklch(0.74 0.15 155 / 0.6)',
  '.is-in &': { animation: 'reader-show 0s 320ms forwards' },
})

export const READER_LED = css({
  position: 'absolute',
  top: '168px',
  left: '50%',
  width: '8px',
  height: '8px',
  marginLeft: '-4px',
  borderRadius: '50%',
  background: 'oklch(0.78 0.15 70)',
  boxShadow: '0 0 10px oklch(0.78 0.15 70 / 0.8)',
  animation: 'reader-blink 1.6s steps(1, end) infinite',
  transition: 'background-color 120ms, box-shadow 120ms',
  '.is-in &': {
    animation: 'none',
    background: 'oklch(0.74 0.15 155)',
    boxShadow: '0 0 14px oklch(0.74 0.15 155 / 0.9)',
    transitionDelay: '300ms',
  },
})

/* The slot's mouth; the well below it starts at its middle, so the badge's
   top edge disappears into it. */
export const READER_SLOT = css({
  position: 'absolute',
  top: '228px',
  left: '30px',
  right: '30px',
  height: '14px',
  borderRadius: '7px',
  background: 'oklch(0.08 0 0)',
  boxShadow: 'inset 0 3px 4px oklch(0 0 0 / 0.9), var(--reader-slot-lip)',
})

export const READER_WELL = css({
  position: 'absolute',
  top: '235px',
  left: '40px',
  right: '40px',
  bottom: '0',
  overflow: 'hidden',
  padding: '0 10px 20px',
})

export const READER_CARD = cx(
  'reader-card',
  css({
    position: 'relative',
    display: 'block',
    width: '100%',
    height: '186px',
    overflow: 'hidden',
    padding: '0',
    border: '0',
    borderRadius: '0 0 14px 14px',
    background: 'var(--reader-card)',
    boxShadow: 'var(--reader-card-edge)',
    color: 'var(--reader-card-ink)',
    cursor: 'pointer',
    transform: 'translateY(-14px)',
    transition: 'transform 220ms var(--ease-out)',
    '&:focus-visible': { outline: '2px solid var(--signal)', outlineOffset: '3px' },
    '.is-in &': {
      transform: 'translateY(-100%)',
      transition: 'transform 300ms cubic-bezier(0.55, 0, 0.3, 1)',
    },
  }),
)

export const READER_CARD_MARK = css({
  position: 'absolute',
  top: '44px',
  left: '50%',
  width: '34px',
  marginLeft: '-17px',
  overflow: 'visible',
  '& circle': { filter: 'drop-shadow(0 0 4px oklch(0.8 0.12 225 / 0.8))' },
})

export const READER_CARD_CHIP = css({
  position: 'absolute',
  left: '16px',
  bottom: '18px',
  width: '30px',
  height: '22px',
  borderRadius: '5px',
  background:
    'linear-gradient(90deg, transparent 32%, oklch(0 0 0 / 0.3) 32% 36%, transparent 36% 64%, oklch(0 0 0 / 0.3) 64% 68%, transparent 68%), linear-gradient(0deg, transparent 46%, oklch(0 0 0 / 0.3) 46% 54%, transparent 54%), linear-gradient(160deg, oklch(0.72 0.006 260), oklch(0.5 0.006 260))',
  boxShadow: 'inset 0 1px 0 oklch(1 0 0 / 0.3)',
})

export const READER_CARD_NAME = css({
  position: 'absolute',
  right: '16px',
  bottom: '22px',
  color: 'var(--reader-card-name)',
  fontFamily: 'var(--mono)',
  fontSize: 'var(--type-10)',
  letterSpacing: 'var(--quorum-letter-spacings-stamp)',
  textTransform: 'uppercase',
})

/* ---- The kit's primitives, sized for the menu --------------------------
   Their own atomic classes set the same properties, so these win on a
   tripled class: a 48px main action, a 44px way back, a founding name field
   that is a rule on the canvas rather than a well, and the same ink outline
   every other focused line carries. */

export const CTA = cx(
  'qm-cta',
  css({
    '&&&': {
      height: '48px',
      gap: '10px',
      paddingInline: '18px',
      justifyContent: 'space-between',
      fontSize: 'var(--type-15)',
    },
    '&&&:focus-visible': { outline: '2px solid var(--foreground)', outlineOffset: '3px' },
  }),
)

export const BACK = css({
  '&&&': {
    height: '44px',
    gap: '4px',
    paddingInline: '8px 12px',
    color: 'var(--muted-foreground)',
  },
  '&&&:focus-visible': {
    outline: '2px solid var(--foreground)',
    outlineOffset: '3px',
    color: 'var(--foreground)',
  },
})

export const NAME_INPUT = css({
  '&&&': {
    height: '56px',
    paddingInline: '2px',
    borderRadius: '0',
    background: 'transparent',
    boxShadow: 'inset 0 -1px 0 var(--edge-solid)',
    fontSize: 'var(--type-22)',
    fontWeight: 'var(--quorum-font-weights-medium)',
  },
  '&&&:focus-visible': {
    borderColor: 'transparent',
    boxShadow: 'inset 0 -2px 0 var(--foreground)',
  },
})
