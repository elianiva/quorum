import { definePreset } from '@pandacss/dev'

/** Values that theme.css redefines under `.dark`, so the token must too. */
const themeScoped = (value: string) => ({ value: { base: value, _dark: value } })

/**
 * The Quorum design language for Panda. The tokens point at the raw CSS custom
 * properties in `packages/ui/src/theme.css`, so the dark theme and the Pixi
 * board keep reading the values they read today.
 */
export const quorumPreset = definePreset({
  name: '@quorum/ui/panda-preset',
  conditions: {
    dark: '.dark &',
    narrow: '@media (max-width: 639px)',
    short: '@media (max-height: 499px)',
    compact: '@media (max-width: 639px), (max-height: 499px)',
  },
  theme: {
    extend: {
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
        /** Dense interface scale. Names are px at 100% text size; `-5` means half a pixel more. */
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
