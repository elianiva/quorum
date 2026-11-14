import { definePreset } from '@pandacss/dev'

/**
 * The Quorum design language for Panda. The tokens point at the raw CSS custom
 * properties in `packages/ui/src/theme.css`, so the dark theme and the Pixi
 * board keep reading the values they read today.
 */
export const quorumPreset = definePreset({
  name: '@quorum/ui/panda-preset',
  conditions: {
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
        radii: {
          sm: { value: 'var(--radius-sm)' },
          md: { value: 'var(--radius-md)' },
          lg: { value: 'var(--radius-lg)' },
          xl: { value: 'var(--radius-xl)' },
          '2xl': { value: 'var(--radius-2xl)' },
          '3xl': { value: 'var(--radius-3xl)' },
          '4xl': { value: 'var(--radius-4xl)' },
        },
        shadows: {
          well: { value: 'var(--elev-well)' },
          raised: { value: 'var(--elev-raised)' },
          card: { value: 'var(--elev-card)' },
          float: { value: 'var(--elev-float)' },
          primary: { value: 'var(--elev-primary)' },
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
          background: { value: 'var(--background)' },
          foreground: { value: 'var(--foreground)' },
          card: { value: 'var(--card)' },
          cardForeground: { value: 'var(--card-foreground)' },
          popover: { value: 'var(--popover)' },
          popoverForeground: { value: 'var(--popover-foreground)' },
          primary: { value: 'var(--primary)' },
          primaryForeground: { value: 'var(--primary-foreground)' },
          secondary: { value: 'var(--secondary)' },
          secondaryForeground: { value: 'var(--secondary-foreground)' },
          muted: { value: 'var(--muted)' },
          mutedForeground: { value: 'var(--muted-foreground)' },
          accent: { value: 'var(--accent)' },
          accentForeground: { value: 'var(--accent-foreground)' },
          destructive: { value: 'var(--destructive)' },
          destructiveForeground: { value: 'var(--destructive-foreground)' },
          border: { value: 'var(--border)' },
          input: { value: 'var(--input)' },
          ring: { value: 'var(--ring)' },
          ok: { value: 'var(--ok)' },
          warn: { value: 'var(--warn)' },
          danger: { value: 'var(--danger)' },
          canvas: { value: 'var(--canvas)' },
          well: { value: 'var(--well)' },
          nested: { value: 'var(--surface-nested)' },
          hairline: { value: 'var(--hairline)' },
          hairlineSoft: { value: 'var(--hairline-soft)' },
          onPrimaryFill: { value: 'var(--on-primary-fill)' },
          page: { value: 'var(--page)' },
          node: { value: 'var(--node)' },
          edge: { value: 'var(--edge)' },
          groupEdge: { value: 'var(--group-edge)' },
          groupCompute: { value: 'var(--group-compute)' },
          groupData: { value: 'var(--group-data)' },
          groupOps: { value: 'var(--group-ops)' },
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
