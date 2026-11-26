import { definePreset } from '@pandacss/dev'

const themeScoped = (value: string) => ({ value: { base: value, _dark: value } })

/* ==========================================================================
   The Quorum design language, shared by the game and the wiki (ADR 0010).
   The tokens below read these raw values, and hundreds of call sites read
   them as `var(--foreground)` and the like, so the names stay as they are.

   The shipped palette is Graphite: near-neutral greys with a faint cool
   cast, an ink primary, soft depth, Geist text and Geist Mono figures, and
   status green, amber, and red.
   ========================================================================== */

/* The dense interface type scale. Each name is the size in px at 100%; `-5` means half a pixel
   more. Every step multiplies by --type-scale, which is 1 or 1.5 (GDD 15 "Accessibility"), so
   type grows and boxes keep their size. */
const TYPE_STEPS =
  '9 9-5 10 10-5 11 11-5 12 12-5 12-8 13 13-5 14 14-5 15 16 17 18 20 22 23 26 28 30 32 34 44'
const typeScale = Object.fromEntries(
  TYPE_STEPS.split(' ').map((step) => [
    `--type-${step}`,
    `calc(${step.replace('-', '.')}px * var(--type-scale))`,
  ]),
)

const lightPalette = {
  '--radius': '10px',
  '--type-scale': '1',
  ...typeScale,

  '--font-sans': 'var(--sans)',
  '--font-heading': 'var(--heading)',
  '--font-mono': 'var(--mono)',

  /* The default transition values Panda's transition utilities read. */
  '--default-transition-duration': '150ms',
  '--default-transition-timing-function': 'cubic-bezier(0.4, 0, 0.2, 1)',

  '--radius-2xs': '2px',
  '--radius-xs': '4px',
  '--radius-sm': 'calc(var(--radius) * 0.6)',
  '--radius-md': 'calc(var(--radius) * 0.8)',
  '--radius-lg': 'var(--radius)',
  '--radius-xl': 'calc(var(--radius) * 1.4)',
  '--radius-2xl': 'calc(var(--radius) * 1.8)',
  '--radius-3xl': 'calc(var(--radius) * 2.2)',
  '--radius-4xl': 'calc(var(--radius) * 2.6)',

  '--sans': "'Geist', ui-sans-serif, system-ui, sans-serif",
  '--heading': 'var(--sans)',
  '--mono': "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace",

  '--background': 'oklch(0.981 0.0012 260)',
  '--foreground': 'oklch(0.26 0.01 260)',
  '--card': 'oklch(0.997 0.0006 260)',
  '--card-foreground': 'oklch(0.26 0.01 260)',
  '--popover': 'var(--card)',
  '--popover-foreground': 'oklch(0.26 0.01 260)',
  '--primary': 'oklch(0.3 0.004 260)',
  '--primary-foreground': 'oklch(0.99 0 0)',
  '--secondary': 'oklch(0.949 0.0024 260)',
  '--secondary-foreground': 'oklch(0.26 0.01 260)',
  '--muted': 'oklch(0.96 0.002 260)',
  '--muted-foreground': 'oklch(0.52 0.01 260)',
  '--accent': 'oklch(0.94 0.0036 260)',
  '--accent-foreground': 'oklch(0.26 0.01 260)',
  '--destructive': 'oklch(0.545 0.19 27)',
  '--destructive-foreground': 'oklch(0.99 0 0)',
  '--border': 'oklch(0.914 0.004 260)',
  '--input': 'oklch(0.895 0.0044 260)',
  '--ring': 'oklch(0.55 0 0)',

  '--primary-strong': 'oklch(0.3 0 0)',
  '--primary-soft': 'oklch(0.3 0 0 / 0.08)',
  '--primary-faint': 'oklch(0.3 0 0 / 0.04)',
  '--ok': 'oklch(0.5 0.13 155)',
  '--warn': 'oklch(0.66 0.145 66)',
  '--danger': 'oklch(0.52 0.19 27)',
  '--ok-soft': 'oklch(0.56 0.13 155 / 0.12)',
  '--warn-soft': 'oklch(0.66 0.145 66 / 0.14)',
  '--danger-soft': 'oklch(0.545 0.19 27 / 0.12)',
  '--canvas': 'oklch(0.955 0.002 260)',
  '--canvas-grid': 'oklch(0.45 0.004 260 / 0.1)',
  '--edge-solid': 'oklch(0.7 0.006 260)',
  /* What the board darkens toward: card shadows, sunk edges, and the rails of busy wires. */
  '--board-shade': 'var(--foreground)',
  /* How far wires and packets mix toward the canvas: 0 keeps their catalog colours. */
  '--board-wire-mute': '0',
  /* A card's footer button: the primary fill on a light board. */
  '--board-action-top': 'var(--primary-fill-top)',
  '--board-action-bottom': 'var(--primary-fill-bottom)',
  '--on-board-action': 'var(--on-primary-fill)',
  '--node': 'var(--card)',
  '--edge': 'oklch(0.5 0.006 260 / 0.45)',
  /* Build groups: one hue each, kept clear of the status hues. */
  '--group-edge': 'oklch(0.62 0.135 235)',
  '--group-compute': 'oklch(0.55 0.19 283)',
  '--group-data': 'oklch(0.62 0.115 182)',
  '--group-ops': 'oklch(0.6 0.2 340)',
  /* The title screen's one accent: lit parts, traffic, the wordmark's node. */
  '--signal': 'oklch(0.8 0.12 225)',
  '--chart-1': 'oklch(0.3 0 0)',
  '--chart-2': 'oklch(0.56 0.1 190)',
  '--chart-3': 'oklch(0.66 0.145 66)',
  '--chart-4': 'oklch(0.52 0.15 295)',
  '--chart-5': 'oklch(0.58 0.18 15)',
  '--sidebar': 'var(--muted)',
  '--sidebar-foreground': 'oklch(0.26 0.01 260)',
  '--sidebar-primary': 'var(--primary)',
  '--sidebar-primary-foreground': 'var(--primary-foreground)',
  '--sidebar-accent': 'var(--accent)',
  '--sidebar-accent-foreground': 'oklch(0.26 0.01 260)',
  '--sidebar-border': 'var(--border)',
  '--sidebar-ring': 'var(--ring)',

  /* Depth. Surfaces sit on the page at four heights, and each height has one recipe: a hairline
     edge, a light top edge, and a soft shadow below.
     - well:   sunk into its parent (tracks, inputs, segmented controls)
     - raised: one step up (buttons, keycaps, switch thumbs)
     - card:   a panel on the page
     - float:  above everything (dialogs, tooltips, toasts)
     Nest radii concentrically: card 2xl, nested group xl, control lg. */
  '--page': 'oklch(0.955 0.002 260)',
  '--surface-nested': 'oklch(0.975 0.0012 260)',
  '--well': 'oklch(0.938 0.002 260)',
  '--raised-top': 'oklch(1 0 0)',
  '--raised-bottom': 'oklch(0.972 0.0012 260)',
  '--hairline': 'oklch(0.26 0.01 260 / 0.1)',
  '--hairline-soft': 'oklch(0.26 0.01 260 / 0.06)',
  '--highlight': 'oklch(1 0 0 / 0.95)',
  '--primary-fill-top': 'oklch(0.38 0.004 260)',
  '--primary-fill-bottom': 'oklch(0.25 0.004 260)',
  '--primary-edge': 'oklch(0.18 0 0)',
  '--on-primary-fill': 'oklch(0.99 0 0)',
  '--on-group': 'oklch(0.99 0 0)',

  '--elev-well':
    'inset 0 1px 2px oklch(0.26 0.01 260 / 0.09), inset 0 0 0 1px var(--hairline-soft)',
  '--elev-raised':
    'inset 0 1px 0 var(--highlight), 0 0 0 1px var(--hairline), 0 1px 1px oklch(0.26 0.01 260 / 0.05), 0 2px 4px -1px oklch(0.26 0.01 260 / 0.07)',
  '--elev-card':
    'inset 0 1px 0 var(--highlight), 0 0 0 1px var(--hairline-soft), 0 1px 2px oklch(0.26 0.01 260 / 0.05), 0 10px 28px -12px oklch(0.26 0.01 260 / 0.16)',
  '--elev-float':
    'inset 0 1px 0 var(--highlight), 0 0 0 1px var(--hairline), 0 2px 6px oklch(0.26 0.01 260 / 0.06), 0 28px 56px -18px oklch(0.26 0.01 260 / 0.3)',
  '--elev-primary':
    'inset 0 1px 0 oklch(1 0 0 / 0.22), inset 0 -1px 0 oklch(0 0 0 / 0.2), 0 0 0 1px var(--primary-edge), 0 1px 2px oklch(0 0 0 / 0.25), 0 4px 10px -4px oklch(0 0 0 / 0.35)',

  /* Motion curves (.agents/skills/animate). */
  '--ease-out': 'cubic-bezier(0.23, 1, 0.32, 1)',
  '--ease-in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
  '--ease-drawer': 'cubic-bezier(0.32, 0.72, 0, 1)',
}

/* Dark Graphite: ink and paper swap, so the primary fill turns white. */
const darkPalette = {
  '--background': 'oklch(0.175 0.0016 260)',
  '--foreground': 'oklch(0.94 0.0018 260)',
  '--card': 'oklch(0.215 0.0018 260)',
  '--card-foreground': 'oklch(0.94 0.0018 260)',
  '--popover': 'oklch(0.235 0.002 260)',
  '--popover-foreground': 'oklch(0.94 0.0018 260)',
  '--primary': 'oklch(0.93 0 0)',
  '--primary-foreground': 'oklch(0.2 0.004 260)',
  '--primary-strong': 'oklch(0.93 0 0)',
  '--primary-soft': 'oklch(1 0 0 / 0.1)',
  '--secondary': 'oklch(0.26 0.0022 260)',
  '--secondary-foreground': 'oklch(0.94 0.0018 260)',
  '--muted': 'oklch(0.25 0.002 260)',
  '--muted-foreground': 'oklch(0.68 0.0034 260)',
  '--accent': 'oklch(0.27 0.0026 260)',
  '--accent-foreground': 'oklch(0.94 0.0018 260)',
  '--border': 'oklch(1 0 0 / 0.08)',
  '--input': 'oklch(1 0 0 / 0.1)',
  '--ring': 'oklch(0.75 0 0)',
  '--ok': 'oklch(0.74 0.15 155)',
  '--warn': 'oklch(0.8 0.14 75)',
  '--danger': 'oklch(0.68 0.19 25)',
  '--destructive': 'oklch(0.68 0.19 25)',
  '--ok-soft': 'oklch(0.74 0.15 155 / 0.14)',
  '--warn-soft': 'oklch(0.8 0.14 75 / 0.14)',
  '--danger-soft': 'oklch(0.68 0.19 25 / 0.16)',
  '--canvas': 'oklch(0.16 0.0014 260)',
  /* Lines recede on a dark board: idle wires and ports sit a step above the canvas, and shadows
     and rails darken toward black instead of washing out toward the ink. */
  '--edge-solid': 'oklch(0.4 0.004 260)',
  '--board-shade': 'oklch(0 0 0)',
  '--board-wire-mute': '0.3',
  /* Every card has one, so on a dark board they are a raised grey, not a white slab. */
  '--board-action-top': 'oklch(0.4 0.003 260)',
  '--board-action-bottom': 'oklch(0.34 0.003 260)',
  '--on-board-action': 'oklch(0.94 0.0018 260)',
  '--group-edge': 'oklch(0.72 0.12 235)',
  '--group-compute': 'oklch(0.68 0.16 283)',
  '--group-data': 'oklch(0.74 0.11 182)',
  '--group-ops': 'oklch(0.72 0.17 340)',

  '--page': 'oklch(0.155 0.0014 260)',
  '--surface-nested': 'oklch(0.24 0.002 260)',
  '--well': 'oklch(0.165 0.0014 260)',
  '--raised-top': 'oklch(0.31 0.0022 260)',
  '--raised-bottom': 'oklch(0.27 0.002 260)',
  '--hairline': 'oklch(1 0 0 / 0.09)',
  '--hairline-soft': 'oklch(1 0 0 / 0.06)',
  '--highlight': 'oklch(1 0 0 / 0.07)',
  '--primary-fill-top': 'oklch(0.99 0 0)',
  '--primary-fill-bottom': 'oklch(0.88 0.003 260)',
  '--primary-edge': 'oklch(0 0 0 / 0.2)',
  '--on-primary-fill': 'oklch(0.2 0.004 260)',
  '--on-group': 'oklch(0.2 0.004 260)',

  '--elev-well':
    'inset 0 1px 3px oklch(0 0 0 / 0.45), inset 0 0 0 1px oklch(0 0 0 / 0.25), 0 1px 0 var(--highlight)',
  '--elev-raised':
    'inset 0 1px 0 var(--highlight), 0 0 0 1px var(--hairline), 0 1px 2px oklch(0 0 0 / 0.28)',
  '--elev-card':
    'inset 0 1px 0 var(--highlight), 0 0 0 1px var(--hairline-soft), 0 1px 2px oklch(0 0 0 / 0.35), 0 12px 32px -12px oklch(0 0 0 / 0.6)',
  '--elev-float':
    'inset 0 1px 0 oklch(1 0 0 / 0.08), 0 0 0 1px oklch(1 0 0 / 0.1), 0 2px 6px oklch(0 0 0 / 0.4), 0 28px 56px -16px oklch(0 0 0 / 0.75)',
  '--elev-primary':
    'inset 0 1px 0 oklch(1 0 0 / 0.28), inset 0 -1px 0 oklch(0 0 0 / 0.12), 0 0 0 1px var(--primary-edge), 0 1px 2px oklch(0 0 0 / 0.28)',
}

/* ==========================================================================
   Motion. Curves and durations follow the animate skill
   (.agents/skills/animate). Only transform, opacity and clip-path move.
   Surfaces opened from the keyboard appear at once: shortcuts must feel
   instant. Reduced motion keeps the fades and drops the movement.

   The class names are hooks: views add them next to their atomic classes,
   and src/game/motion.ts sets `data-exiting` on a surface that leaves. These
   rules sit in the base layer, below the utilities, so a `!important` marks
   each declaration that must still beat a utility on the same element.
   ========================================================================== */
const enter = (ms: number) => `opacity ${ms}ms var(--ease-out), transform ${ms}ms var(--ease-out)`
const drawerEntrance = {
  transformOrigin: 'bottom center',
  transition: 'transform 380ms var(--ease-drawer), opacity 180ms var(--ease-out)',
}
const drawerStart = { opacity: '1 !important', transform: 'translateY(100%)' }
const drawerExit = { animation: 'exit-sheet 240ms var(--ease-drawer) forwards' }

const motion = {
  /* A finger is wider than a pointer: widen every button's hit area without moving it. */
  "[data-slot='button']": {
    '@media (pointer: coarse)': {
      position: 'relative',
      '&::after': { content: '""', position: 'absolute', inset: '-6px' },
    },
  },

  /* A pressable control sinks a little under the pointer. */
  '.press': {
    transition:
      'transform 160ms var(--ease-out), filter 150ms ease, background-color 150ms ease, box-shadow 150ms ease, color 150ms ease !important',
  },
  '.press:active:not([aria-haspopup], :disabled)': { transform: 'scale(0.97)' },

  /* Entrances. Each surface comes from where it lives. */
  '.enter-pop': {
    transformOrigin: 'var(--transform-origin, bottom center) !important',
    transition: enter(200),
    '@starting-style': { opacity: '0 !important', transform: 'translateY(4px) scale(0.97)' },
  },
  '.enter-badge': {
    transition: enter(200),
    '@starting-style': { opacity: '0 !important', transform: 'scale(0.9)' },
  },
  '.enter-panel': {
    transition: enter(250),
    '@starting-style': { opacity: '0 !important', transform: 'translateX(16px)' },
  },
  '.enter-modal': {
    transition: enter(250),
    '@starting-style': { opacity: '0 !important', transform: 'scale(0.96)' },
  },
  /* A toast can raise a panel's top padding on a short screen; move the panel with it. */
  '.enter-backdrop': {
    transition: `${enter(250)}, padding 200ms var(--ease-out)`,
    '@starting-style': { opacity: '0 !important' },
  },
  '.enter-down': {
    transition: enter(200),
    '@starting-style': { opacity: '0 !important', transform: 'translateY(-6px)' },
  },
  '.enter-left': {
    transition: enter(200),
    '@starting-style': { opacity: '0 !important', transform: 'translateX(-8px)' },
  },
  '.enter-toast': {
    transition: 'opacity 400ms ease, transform 400ms ease',
    '@starting-style': { opacity: '0 !important', transform: 'translateY(100%)' },
  },

  /* A modal's scrim is its own layer. The sheet above it can leave on its own curve instead of
     fading with the backdrop. */
  '.modal-overlay::before': {
    content: '""',
    position: 'absolute',
    inset: '0px',
    zIndex: 0,
    pointerEvents: 'none',
    background: 'color-mix(in oklab, var(--foreground) 10%, transparent)',
    backdropFilter: 'blur(3px)',
    transition: 'opacity 250ms var(--ease-out)',
    '@starting-style': { opacity: 0 },
  },
  /* The scrim blurs what is under it only: the sheet sits above the scrim, whatever its layout. */
  '.modal-overlay > *': { position: 'relative', zIndex: 1 },

  /* A phone's sheets rise from the bottom edge on the drawer curve, opaque, so the surface reads
     as one piece instead of a faded card arriving from the side. The exit falls back down faster
     than the entrance, which is where a player expects a dismissed sheet to go. */
  ':is(.enter-panel.sheet, .enter-panel.sheet-screen, .enter-modal)': {
    '@media (max-width: 639px)': {
      ...drawerEntrance,
      '@starting-style': drawerStart,
    },
  },
  ':is(.enter-panel.sheet, .enter-panel.sheet-screen)[data-exiting], html .modal-overlay[data-exiting] .enter-modal':
    { '@media (max-width: 639px)': drawerExit },
  /* A short landscape window still uses a bottom sheet for the build list, Research, and the
     Inbox. The Inspector stays a side panel there, so it keeps its horizontal entrance. */
  ':is(.enter-panel.sheet, .enter-modal)': {
    '@media (min-width: 640px) and (max-height: 499px)': {
      ...drawerEntrance,
      '@starting-style': drawerStart,
    },
  },
  '.enter-panel.sheet[data-exiting], html .modal-overlay[data-exiting] .enter-modal': {
    '@media (min-width: 640px) and (max-height: 499px)': drawerExit,
  },

  ":root[data-input='keyboard'] :is(.enter-pop, .enter-panel, .enter-modal, .enter-backdrop, .modal-overlay, .swap, .deck-pools)":
    { transitionDuration: '0ms' },
  ":root[data-input='keyboard'] .deck-pools-clip": { transitionDuration: '0ms' },

  /* New content in a surface that stays: it comes into focus where the old content was, while
     the surface morphs to fit (src/game/motion.ts). The blur masks the crossfade, so it reads as
     one thing changing. */
  '.swap': {
    transition:
      'opacity 200ms var(--ease-out), filter 200ms var(--ease-out), transform 200ms var(--ease-out)',
    '@starting-style': {
      opacity: '0 !important',
      filter: 'blur(4px)',
      transform: 'translateY(3px)',
    },
  },

  /* The Research deck's pool list: the row stays where it is and the list folds out above it. A
     grid row collapses to nothing, so the card keeps its width and the row never wraps or clips
     while the deck grows. */
  '.deck-pools': {
    display: 'grid',
    gridTemplateRows: '0fr',
    opacity: 0,
    transition: 'grid-template-rows 320ms var(--ease-out), opacity 160ms var(--ease-out)',
  },
  ".deck-pools[data-open='true']": {
    gridTemplateRows: '1fr',
    opacity: 1,
    transition: 'grid-template-rows 320ms var(--ease-out), opacity 200ms var(--ease-out) 80ms',
  },
  '.deck-pools-clip': {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    minHeight: '0px',
    overflow: 'clip',
    translate: '0 4px',
    transition: 'translate 320ms var(--ease-out)',
  },
  /* The list keeps its height and leaves through the top, so it pulls out of the row. */
  '.deck-pools-clip > *': { flex: 'none' },
  ".deck-pools[data-open='true'] .deck-pools-clip": { translate: '0 0' },
  '.deck-pools, .deck-pools-clip': {
    '@media (prefers-reduced-motion: reduce)': { transitionDuration: '0.01ms' },
  },

  /* A morphing box clips what does not fit it yet. */
  '[data-morph]': { overflow: 'clip !important' },

  /* Exits. A removed surface stays a moment, inert, and leaves the way it came, a little faster
     than it arrived (src/game/motion.ts removes it after). */
  '[data-exiting]': {
    pointerEvents: 'none !important',
    animation: 'exit-fade 150ms var(--ease-out) forwards',
  },
  '.modal-overlay[data-exiting]': { animation: 'none' },
  '.modal-overlay[data-exiting]::before': { animation: 'exit-fade 180ms var(--ease-out) forwards' },
  '.enter-backdrop[data-exiting]': { animation: 'exit-fade 180ms var(--ease-out) forwards' },
  '.modal-overlay[data-exiting] .enter-modal': {
    animation: 'exit-modal 180ms var(--ease-out) forwards',
  },
  '.enter-panel[data-exiting]': { animation: 'exit-panel 200ms var(--ease-out) forwards' },
  '.enter-toast[data-exiting]': { animation: 'exit-toast 260ms ease forwards' },
  '.enter-down[data-exiting]': { animation: 'exit-up 180ms var(--ease-out) forwards' },
  '.enter-left[data-exiting]': { animation: 'exit-left 180ms var(--ease-out) forwards' },
  '.enter-pop[data-exiting]': { animation: 'exit-pop 150ms var(--ease-out) forwards' },
  '.enter-badge[data-exiting]': { animation: 'exit-badge 150ms var(--ease-out) forwards' },
  '.swap[data-exiting]': { animation: 'exit-swap 140ms var(--ease-out) forwards' },

  /* A page arrives: its bell swings once and settles. It does not keep blinking. */
  '.ring': { transformOrigin: '50% 2px', animation: 'ring 700ms var(--ease-out)' },

  /* A rare moment, so it gets the delight budget: the content arrives in order. */
  '.stagger > *': {
    opacity: 0,
    transform: 'translateY(8px)',
    animation: 'stagger-in 300ms var(--ease-out) forwards',
  },
  '.stagger > :nth-child(2)': { animationDelay: '50ms' },
  '.stagger > :nth-child(3)': { animationDelay: '100ms' },
  '.stagger > :nth-child(4)': { animationDelay: '150ms' },

  /* A control that just appeared (GDD 15 "Progressive disclosure"): a ring that breathes until
     the player uses it. With reduced motion the ring holds still. */
  '.cue-glow': {
    boxShadow: '0 0 0 2px var(--ok)',
    animation: 'cue-breathe 1.3s ease-in-out infinite alternate',
    /* An animation outranks every layer, but a still ring must beat the button's own shadow. */
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
      boxShadow: '0 0 0 2px var(--ok) !important',
    },
  },

  /* A funding offer is rare: one light sweep says it is new. */
  '.shine': { position: 'relative', overflow: 'hidden' },
  '.shine::after': {
    content: '""',
    position: 'absolute',
    inset: '0px',
    background:
      'linear-gradient(100deg, transparent 30%, oklch(1 0 0 / 0.35) 50%, transparent 70%)',
    transform: 'translateX(-100%)',
    animation: 'shine-sweep 900ms var(--ease-in-out) 250ms forwards',
    pointerEvents: 'none',
  },

  /* Folded sections open by height: the one place height may animate. */
  'details.fold::details-content': {
    blockSize: '0px',
    opacity: 0,
    overflowY: 'clip',
    transition:
      'block-size 200ms var(--ease-out), opacity 200ms var(--ease-out), content-visibility 200ms allow-discrete',
  },
  'details.fold[open]::details-content': { blockSize: 'auto', opacity: 1 },
  '.fold-chevron': { transition: 'transform 200ms var(--ease-out)' },

  /* Reduced motion keeps the fades and drops the movement. */
  '@media (prefers-reduced-motion: reduce)': {
    '.enter-backdrop': { transitionDuration: '0.01ms' },
    '.press:active:not([aria-haspopup], :disabled)': { transform: 'none' },
    '.enter-pop, .enter-badge, .enter-panel, .enter-modal, .enter-down, .enter-left, .enter-toast':
      { '@starting-style': { transform: 'none' } },
    '.stagger > *': { transform: 'none' },
    '.shine::after': { display: 'none' },
    '.swap': { '@starting-style': { filter: 'none', transform: 'none' } },
    '[data-exiting], [data-exiting] .enter-modal': { animationName: 'exit-fade !important' },
    '.ring': { animation: 'none' },
  },
}

const motionKeyframes = {
  'exit-sheet': { to: { transform: 'translateY(100%)' } },
  'exit-fade': { to: { opacity: '0' } },
  'exit-modal': { to: { opacity: '0', transform: 'scale(0.97)' } },
  'exit-panel': { to: { opacity: '0', transform: 'translateX(16px)' } },
  'exit-toast': { to: { opacity: '0', transform: 'translateY(12px) scale(0.98)' } },
  'exit-up': { to: { opacity: '0', transform: 'translateY(-6px)' } },
  'exit-left': { to: { opacity: '0', transform: 'translateX(-8px)' } },
  'exit-pop': { to: { opacity: '0', transform: 'translateY(4px) scale(0.97)' } },
  'exit-badge': { to: { opacity: '0', transform: 'scale(0.9)' } },
  'exit-swap': { to: { opacity: '0', filter: 'blur(4px)' } },
  ring: {
    '15%': { transform: 'rotate(16deg)' },
    '30%': { transform: 'rotate(-13deg)' },
    '45%': { transform: 'rotate(9deg)' },
    '60%': { transform: 'rotate(-5deg)' },
    '75%': { transform: 'rotate(2deg)' },
  },
  'stagger-in': { to: { opacity: '1', transform: 'translateY(0)' } },
  'cue-breathe': {
    from: { boxShadow: '0 0 0 2px oklch(from var(--ok) l c h / 0.35)' },
    to: { boxShadow: '0 0 0 2px var(--ok), 0 0 0 6px oklch(from var(--ok) l c h / 0.15)' },
  },
  'shine-sweep': { to: { transform: 'translateX(100%)' } },
}

export const quorumPreset = definePreset({
  name: '@quorum/ui/panda-preset',
  globalCss: {
    ':root': { ...lightPalette, interpolateSize: 'allow-keywords' },
    '.dark': darkPalette,
    /* A white switch thumb on a white track disappears, so keep it dark. */
    ".dark [data-slot='switch-thumb'][data-checked]": {
      '--raised-top': 'oklch(0.32 0 0)',
      '--raised-bottom': 'oklch(0.24 0 0)',
    },
    '*': { borderColor: 'var(--border)' },
    body: {
      color: 'var(--foreground)',
      fontFamily: 'var(--sans)',
      fontSize: 'var(--type-13)',
      lineHeight: 'var(--quorum-line-heights-body)',
      WebkitFontSmoothing: 'antialiased',
    },
    'h1, h2, h3, h4': {
      fontFamily: 'var(--heading)',
      fontWeight: 'var(--quorum-font-weights-semibold)',
      letterSpacing: 'var(--quorum-letter-spacings-tight)',
      lineHeight: 'var(--quorum-line-heights-heading)',
    },
    '::selection': { background: 'var(--primary-soft)' },
    ...motion,
  },
  conditions: {
    dark: '.dark &',
    narrow: '@media (max-width: 639px)',
    short: '@media (max-height: 499px)',
    compact: '@media (max-width: 639px), (max-height: 499px)',
  },
  theme: {
    extend: {
      keyframes: motionKeyframes,
      tokens: {
        fonts: {
          sans: { value: 'var(--sans)' },
          heading: { value: 'var(--heading)' },
          mono: { value: 'var(--mono)' },
        },
        easings: {
          out: { value: 'var(--ease-out)' },
          'in-out': { value: 'var(--ease-in-out)' },
          drawer: { value: 'var(--ease-drawer)' },
          default: { value: 'var(--default-transition-timing-function)' },
        },
        durations: {
          fast: { value: '150ms' },
          faster: { value: '100ms' },
          normal: { value: '200ms' },
          slow: { value: '250ms' },
          slower: { value: '400ms' },
          slowest: { value: '500ms' },
          glacial: { value: '700ms' },
        },
        radii: {
          '2xs': { value: 'var(--radius-2xs)' },
          xs: { value: 'var(--radius-xs)' },
          sm: { value: 'var(--radius-sm)' },
          md: { value: 'var(--radius-md)' },
          lg: { value: 'var(--radius-lg)' },
          xl: { value: 'var(--radius-xl)' },
          '2xl': { value: 'var(--radius-2xl)' },
          '3xl': { value: 'var(--radius-3xl)' },
          '4xl': { value: 'var(--radius-4xl)' },
        },
        fontSizes: {
          code: { value: '0.86em' },
          type: {
            '9': { value: 'var(--type-9)' },
            '9-5': { value: 'var(--type-9-5)' },
            '10': { value: 'var(--type-10)' },
            '10-5': { value: 'var(--type-10-5)' },
            '11': { value: 'var(--type-11)' },
            '11-5': { value: 'var(--type-11-5)' },
            '12': { value: 'var(--type-12)' },
            '12-5': { value: 'var(--type-12-5)' },
            '12-8': { value: 'var(--type-12-8)' },
            '13': { value: 'var(--type-13)' },
            '13-5': { value: 'var(--type-13-5)' },
            '14': { value: 'var(--type-14)' },
            '14-5': { value: 'var(--type-14-5)' },
            '15': { value: 'var(--type-15)' },
            '16': { value: 'var(--type-16)' },
            '17': { value: 'var(--type-17)' },
            '18': { value: 'var(--type-18)' },
            '20': { value: 'var(--type-20)' },
            '22': { value: 'var(--type-22)' },
            '23': { value: 'var(--type-23)' },
            '26': { value: 'var(--type-26)' },
            '28': { value: 'var(--type-28)' },
            '30': { value: 'var(--type-30)' },
            '32': { value: 'var(--type-32)' },
            '34': { value: 'var(--type-34)' },
            '44': { value: 'var(--type-44)' },
          },
        },
        fontWeights: {
          normal: { value: '400' },
          medium: { value: '500' },
          semibold: { value: '600' },
        },
        lineHeights: {
          display: { value: '1.05' },
          heading: { value: '1.1' },
          compact: { value: '1.3333333333333333' },
          dense: { value: '1.35' },
          bodyTight: { value: '1.4' },
          fine: { value: '1.4285714285714286' },
          body: { value: '1.45' },
          fixed: { value: '1rem' },
          prose: { value: '1.7' },
          code: { value: '1.6' },
          loose: { value: '1.8' },
        },
        letterSpacings: {
          label: { value: '0.04em' },
          tag: { value: '0.06em' },
          eyebrow: { value: '0.08em' },
          banner: { value: '0.1em' },
          badge: { value: '0.12em' },
          badgeWide: { value: '0.14em' },
          overline: { value: '0.16em' },
          stamp: { value: '0.18em' },
          heading: { value: '-0.035em' },
          title: { value: '-0.03em' },
          body: { value: '-0.02em' },
          subtle: { value: '-0.01em' },
        },
        spacing: {
          '0.25': { value: '0.0625rem' },
          '0.5': { value: '0.125rem' },
          '0.75': { value: '0.1875rem' },
          '1.5': { value: '0.375rem' },
          '2.5': { value: '0.625rem' },
          '3.5': { value: '0.875rem' },
        },
      },
      semanticTokens: {
        colors: {
          background: themeScoped('var(--background)'),
          foreground: themeScoped('var(--foreground)'),
          card: themeScoped('var(--card)'),
          cardForeground: themeScoped('var(--card-foreground)'),
          popover: themeScoped('var(--popover)'),
          popoverForeground: themeScoped('var(--popover-foreground)'),
          primary: themeScoped('var(--primary)'),
          primaryForeground: themeScoped('var(--primary-foreground)'),
          primaryStrong: themeScoped('var(--primary-strong)'),
          primarySoft: themeScoped('var(--primary-soft)'),
          primaryFaint: themeScoped('var(--primary-faint)'),
          secondary: themeScoped('var(--secondary)'),
          secondaryForeground: themeScoped('var(--secondary-foreground)'),
          muted: themeScoped('var(--muted)'),
          mutedForeground: themeScoped('var(--muted-foreground)'),
          accent: themeScoped('var(--accent)'),
          accentForeground: themeScoped('var(--accent-foreground)'),
          destructive: themeScoped('var(--destructive)'),
          destructiveForeground: themeScoped('var(--destructive-foreground)'),
          border: themeScoped('var(--border)'),
          input: themeScoped('var(--input)'),
          ring: themeScoped('var(--ring)'),
          ok: themeScoped('var(--ok)'),
          okSoft: themeScoped('var(--ok-soft)'),
          warn: themeScoped('var(--warn)'),
          warnSoft: themeScoped('var(--warn-soft)'),
          danger: themeScoped('var(--danger)'),
          dangerSoft: themeScoped('var(--danger-soft)'),
          canvas: themeScoped('var(--canvas)'),
          canvasGrid: themeScoped('var(--canvas-grid)'),
          well: themeScoped('var(--well)'),
          nested: themeScoped('var(--surface-nested)'),
          raisedTop: themeScoped('var(--raised-top)'),
          raisedBottom: themeScoped('var(--raised-bottom)'),
          primaryFillTop: themeScoped('var(--primary-fill-top)'),
          primaryFillBottom: themeScoped('var(--primary-fill-bottom)'),
          primaryEdge: themeScoped('var(--primary-edge)'),
          hairline: themeScoped('var(--hairline)'),
          hairlineSoft: themeScoped('var(--hairline-soft)'),
          highlight: themeScoped('var(--highlight)'),
          onPrimaryFill: themeScoped('var(--on-primary-fill)'),
          onGroup: themeScoped('var(--on-group)'),
          page: themeScoped('var(--page)'),
          node: themeScoped('var(--node)'),
          edge: themeScoped('var(--edge)'),
          edgeSolid: themeScoped('var(--edge-solid)'),
          signal: themeScoped('var(--signal)'),
          boardShade: themeScoped('var(--board-shade)'),
          boardActionTop: themeScoped('var(--board-action-top)'),
          boardActionBottom: themeScoped('var(--board-action-bottom)'),
          onBoardAction: themeScoped('var(--on-board-action)'),
          chart1: themeScoped('var(--chart-1)'),
          chart2: themeScoped('var(--chart-2)'),
          chart3: themeScoped('var(--chart-3)'),
          chart4: themeScoped('var(--chart-4)'),
          chart5: themeScoped('var(--chart-5)'),
          sidebar: themeScoped('var(--sidebar)'),
          sidebarForeground: themeScoped('var(--sidebar-foreground)'),
          sidebarPrimary: themeScoped('var(--sidebar-primary)'),
          sidebarPrimaryForeground: themeScoped('var(--sidebar-primary-foreground)'),
          sidebarAccent: themeScoped('var(--sidebar-accent)'),
          sidebarAccentForeground: themeScoped('var(--sidebar-accent-foreground)'),
          sidebarBorder: themeScoped('var(--sidebar-border)'),
          sidebarRing: themeScoped('var(--sidebar-ring)'),
          groupEdge: themeScoped('var(--group-edge)'),
          groupCompute: themeScoped('var(--group-compute)'),
          groupData: themeScoped('var(--group-data)'),
          groupOps: themeScoped('var(--group-ops)'),
        },
        shadows: {
          well: themeScoped('var(--elev-well)'),
          raised: themeScoped('var(--elev-raised)'),
          card: themeScoped('var(--elev-card)'),
          float: themeScoped('var(--elev-float)'),
          primary: themeScoped('var(--elev-primary)'),
          focus: {
            value: '0 0 0 3px color-mix(in oklab, {colors.ring} 50%, transparent)',
          },
          focusWell: {
            value: '{shadows.well}, 0 0 0 3px color-mix(in oklab, {colors.ring} 50%, transparent)',
          },
          focusRaised: {
            value:
              '{shadows.raised}, 0 0 0 3px color-mix(in oklab, {colors.ring} 50%, transparent)',
          },
          focusRaisedSoft: {
            value:
              '{shadows.raised}, 0 0 0 3px color-mix(in oklab, {colors.ring} 40%, transparent)',
          },
          invalid: {
            value: {
              base: '0 0 0 3px color-mix(in oklab, {colors.destructive} 20%, transparent)',
              _dark: '0 0 0 3px color-mix(in oklab, {colors.destructive} 40%, transparent)',
            },
          },
          invalidLine: {
            value: 'inset 0 0 0 1px color-mix(in oklch, {colors.destructive} 25%, transparent)',
          },
          line: { value: 'inset 0 0 0 1px {colors.hairlineSoft}' },
          lineStrong: { value: 'inset 0 0 0 1px {colors.hairline}' },
          avatar: { value: '0 0 0 2px {colors.background}' },
          cardRing: { value: '0 0 0 2px {colors.card}' },
          selected: {
            value:
              '{shadows.raised}, 0 0 0 4px color-mix(in oklab, {colors.primary} 25%, transparent)',
          },
          selectedStrong: {
            value:
              '{shadows.raised}, 0 0 0 6px color-mix(in oklab, {colors.primary} 25%, transparent)',
          },
          selectedHalo: {
            value: '0 0 0 2px {colors.white}, 0 0 0 4px {colors.primary}',
          },
          active: { value: '{shadows.raised}, 0 0 0 1.5px {colors.primary}' },
          hoverCard: {
            value: '0 0 0 1px {colors.hairlineSoft}, 0 1px 2px oklch(0 0 0 / 0.05)',
          },
          hoverCardStrong: {
            value: '0 0 0 1px {colors.hairline}, 0 2px 6px oklch(0 0 0 / 0.07)',
          },
          dangerRing: { value: '0 0 0 1.5px {colors.danger}' },
          dangerLine: {
            value: '0 0 0 1px color-mix(in oklab, {colors.danger} 60%, transparent)',
          },
          edge: { value: '0 0 0 1px {colors.hairlineSoft}' },
          dividerStart: { value: 'inset 1px 0 0 {colors.hairlineSoft}' },
          highlightTop: { value: 'inset 0 1px 0 oklch(1 0 0 / 0.3)' },
          highlightTopStrong: { value: 'inset 0 1px 0 oklch(1 0 0 / 0.35)' },
          highlightLine: { value: 'inset 0 0 0 1px oklch(1 0 0 / 0.4)' },
          highlightLineStrong: { value: 'inset 0 0 0 1px oklch(1 0 0 / 0.42)' },
          insetTop: { value: 'inset 0 1px 2px oklch(0 0 0 / 0.3)' },
          pressed: {
            value: 'inset 0 -2px 0 oklch(0 0 0 / 0.12), 0 1px 2px oklch(0 0 0 / 0.12)',
          },
          hoverCardElevated: {
            value: '0 0 0 1px {colors.hairlineSoft}, 0 2px 6px oklch(0 0 0 / 0.08)',
          },
          okLine: {
            value: 'inset 0 0 0 1px color-mix(in oklch, {colors.ok} 25%, transparent)',
          },
          okLineFaint: {
            value: 'inset 0 0 0 1px color-mix(in oklch, {colors.ok} 18%, transparent)',
          },
          warnLine: {
            value: 'inset 0 0 0 1px color-mix(in oklch, {colors.warn} 28%, transparent)',
          },
          warnLineStrong: {
            value: 'inset 0 0 0 1px color-mix(in oklch, {colors.warn} 38%, transparent)',
          },
          dangerLineInset: {
            value: 'inset 0 0 0 1px color-mix(in oklch, {colors.danger} 25%, transparent)',
          },
          primaryLineInset: {
            value: 'inset 0 0 0 1px color-mix(in oklch, {colors.primary} 28%, transparent)',
          },
        },
      },
      textStyles: {
        display: {
          value: {
            fontSize: 'type.44',
            lineHeight: 'display',
            fontWeight: 'semibold',
            letterSpacing: 'heading',
          },
        },
        pageTitle: {
          value: {
            fontSize: 'type.32',
            lineHeight: 'tight',
            fontWeight: 'semibold',
            letterSpacing: 'tight',
          },
        },
        sectionTitle: {
          value: {
            fontSize: 'type.20',
            fontWeight: 'semibold',
            letterSpacing: 'tight',
          },
        },
      },
      layerStyles: {
        surface: {
          value: {
            backgroundColor: '{colors.card}',
            backgroundImage:
              'linear-gradient(to bottom, color-mix(in oklch, {colors.card}, {colors.white} 3%), {colors.card} 48px)',
          },
        },
        raised: {
          value: {
            backgroundColor: '{colors.raisedBottom}',
            backgroundImage:
              'linear-gradient(to bottom, {colors.raisedTop}, {colors.raisedBottom})',
          },
        },
        primaryFill: {
          value: {
            backgroundColor: '{colors.primaryFillBottom}',
            backgroundImage:
              'linear-gradient(to bottom, {colors.primaryFillTop}, {colors.primaryFillBottom})',
          },
        },
      },
    },
  },
})
