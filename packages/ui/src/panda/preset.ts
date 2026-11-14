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
          default: { value: 'var(--default-transition-duration)' },
        },
        radii: {
          sm: { value: 'var(--radius-sm)' },
          md: { value: 'var(--radius-md)' },
          lg: { value: 'var(--radius-lg)' },
          xl: { value: 'var(--radius-xl)' },
          '2xl': { value: 'var(--radius-2xl)' },
          '3xl': { value: 'var(--radius-3xl)' },
          '4xl': { value: 'var(--radius-4xl)' },
        },
        spacing: {
          '0.5': { value: '0.125rem' },
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
        },
      },
      textStyles: {
        xs: { value: { fontSize: '0.75rem', lineHeight: '1rem' } },
        sm: { value: { fontSize: '0.875rem', lineHeight: '1.25rem' } },
        base: { value: { fontSize: '1rem', lineHeight: '1.5rem' } },
        lg: { value: { fontSize: '1.125rem', lineHeight: '1.75rem' } },
        xl: { value: { fontSize: '1.25rem', lineHeight: '1.75rem' } },
      },
      layerStyles: {
        surface: {
          value: {
            backgroundColor: 'var(--card)',
            backgroundImage:
              'linear-gradient(to bottom, color-mix(in oklch, var(--card), white 3%), var(--card) 48px)',
          },
        },
        raised: {
          value: {
            backgroundColor: 'var(--raised-bottom)',
            backgroundImage: 'linear-gradient(to bottom, var(--raised-top), var(--raised-bottom))',
          },
        },
        primaryFill: {
          value: {
            backgroundColor: 'var(--primary-fill-bottom)',
            backgroundImage:
              'linear-gradient(to bottom, var(--primary-fill-top), var(--primary-fill-bottom))',
          },
        },
      },
    },
  },
})
