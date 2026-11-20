export const THEME_KEY = 'quorum.wiki.theme'
export const THEME_COLORS = { light: '#f1f2f4', dark: '#141517' } as const

export type Theme = keyof typeof THEME_COLORS

const isTheme = (value: string | null): value is Theme => value === 'light' || value === 'dark'

const systemTheme = (): Theme =>
  matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

const storedTheme = (): Theme | null => {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return isTheme(stored) ? stored : null
  } catch {
    return null
  }
}

const currentTheme = (): Theme =>
  storedTheme() ?? (document.documentElement.classList.contains('dark') ? 'dark' : systemTheme())

const applyTheme = (theme: Theme): void => {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.dataset['theme'] = theme
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[theme])
  window.dispatchEvent(new CustomEvent('quorum:theme', { detail: theme }))
}

export const themeScript = `(()=>{const root=document.documentElement;let theme;try{const stored=localStorage.getItem('${THEME_KEY}');theme=stored==='dark'||stored==='light'?stored:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch{theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}root.classList.toggle('dark',theme==='dark');root.dataset.theme=theme;const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.setAttribute('content',theme==='dark'?'${THEME_COLORS.dark}':'${THEME_COLORS.light}')})()`

export const startTheme = (): void => {
  applyTheme(currentTheme())
  document.addEventListener('click', (event) => {
    const target = event.target
    if (!(target instanceof Element) || target.closest('[data-theme-toggle]') === null) return
    const theme = currentTheme() === 'dark' ? 'light' : 'dark'
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {}
    applyTheme(theme)
  })
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    if (storedTheme() === null) applyTheme(event.matches ? 'dark' : 'light')
  })
}
