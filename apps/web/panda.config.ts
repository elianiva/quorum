import { quorumConfig } from '../../packages/ui/src/panda/config.ts'

/* The title screen's motion (src/game/title-styles.ts) and the board's own. */
const keyframes = {
  'qm-fade': { from: { opacity: '0' } },
  'qm-branch': { from: { opacity: '0', transform: 'translateX(-12px)' } },
  'qm-leave': { to: { opacity: '0', transform: 'translateX(-8px)' } },
  'qm-leave-fade': { to: { opacity: '0' } },
  'qm-rise': { from: { opacity: '0', transform: 'translateY(8px)' } },
  'qm-draw': { from: { strokeDashoffset: '1' }, to: { strokeDashoffset: '0' } },
  'qm-ping': { '0%': { transform: 'scale(1.9)' }, '100%': { transform: 'scale(1)' } },
  'qm-fill': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
  'reader-in': { from: { opacity: '0', transform: 'translateY(12px)' } },
  'reader-out': { to: { opacity: '0', transform: 'scale(0.96)' } },
  'reader-blink': { '50%': { opacity: '0.35' } },
  'reader-hide': { to: { visibility: 'hidden' } },
  'reader-show': { to: { visibility: 'visible' } },
  'mail-ping': {
    from: { boxShadow: '0 0 0 0 color-mix(in oklab, var(--danger) 55%, transparent)' },
    to: { boxShadow: '0 0 0 12px transparent' },
  },
}

const globalCss = {
  'html, body': { height: '100%', margin: '0', overflow: 'hidden' },
  /* Both screens paint their own background; the body matches the light menu
     so nothing flashes before it renders. A game, not a page: no
     pull-to-refresh, no double-tap zoom, no grey tap flash. */
  body: {
    background: 'oklch(0.955 0.002 260)',
    overscrollBehavior: 'none',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
  },

  /* The Reduce motion setting, whatever the system says: animations and
     transitions end at once. */
  ':root[data-motion="reduce"] *, :root[data-motion="reduce"] ::before, :root[data-motion="reduce"] ::after':
    {
      animationDuration: '0.01ms !important',
      animationDelay: '0.01ms !important',
      animationIterationCount: '1 !important',
      transitionDuration: '0.01ms !important',
      transitionDelay: '0.01ms !important',
    },

  /* The Text at 150% setting (15 "Accessibility"): the type grows, the boxes
     around it keep their size, so a card still holds its rows. Text sizes
     multiply their px or rem value by `--type-scale`. */
  ':root[data-text="150"]': { '--type-scale': '1.5' },
}

/* `extend` adds to the preset's global styles instead of replacing a rule it
   also names, such as `body`. */
export default quorumConfig(['./src/**/*.ts', '../../packages/ui/src/**/*.ts'], undefined, {
  theme: { extend: { keyframes } },
  globalCss: { extend: globalCss },
})
