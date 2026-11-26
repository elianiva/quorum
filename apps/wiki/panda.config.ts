import { quorumConfig } from '../../packages/ui/src/panda/config.ts'

/* The two Geist faces, served from this origin (public/fonts): a reader never waits on a
   third-party stylesheet before the first paint (apps/web/index.html loads the same files). */
const geist = (file: string) => ({
  fontStyle: 'normal',
  fontWeight: '100 900',
  fontDisplay: 'swap',
  src: `url('/fonts/${file}') format('woff2')`,
})

export default quorumConfig(['./src/**/*.ts', '../../packages/ui/src/**/*.ts'], undefined, {
  globalFontface: {
    Geist: geist('geist-latin-v5.woff2'),
    'Geist Mono': geist('geist-mono-latin-v6.woff2'),
  },
  /* The wiki wears the game's Graphite theme (packages/ui/src/panda/preset.ts). It is a page, not a
     game: it scrolls, and its backdrop is the board's dotted canvas, so a reader knows where
     they are. */
  globalCss: {
    /* extend merges into the preset's :root and body; a plain key would replace them. */
    extend: {
      ':root': {
        /* The sticky header: the bar and the section bar. */
        '--header-height': '100px',
      },
      html: {
        scrollPaddingTop: 'calc(var(--header-height) + 24px)',
        colorScheme: 'light',
      },
      'html.dark': {
        colorScheme: 'dark',
      },
      body: {
        margin: '0',
        backgroundColor: 'var(--background)',
        fontSize: 'var(--type-14)',
      },
      /* The search box clears with Escape; hide the browser's own clear button. */
      "input[type='search']::-webkit-search-cancel-button": {
        appearance: 'none',
      },
    },
  },
})
