import { css } from '@quorum/styled-system/css'

const link = {
  color: 'var(--foreground)',
  textDecoration: 'underline',
  textDecorationColor: 'color-mix(in oklch, var(--foreground) 30%, transparent)',
  textUnderlineOffset: '3px',
} as const

/* Prose: the body text of a page. Most of it is Markdown, so the inner elements take no class
   and are styled from the container. These rules once sat in a lower cascade layer so that a
   block's own utility (my-6 on a card) won over the default rhythm; as atomic utilities they
   share that layer, so they win by specificity instead. Every rule wraps the container and any
   class in `:where()` and stays below one class (0,1,0), so a utility still wins. Within prose,
   an override beats the default it replaces by one or two more type selectors. Panda's selector
   type only knows keys that start or end with `&`, so the rules sit in a const: TypeScript checks
   a variable's shape but not its extra keys, and Panda still reads it. */
const prose = {
  ':where(&)': {
    fontSize: 'type.15',
    lineHeight: 'prose',
    color: 'color-mix(in oklch, var(--foreground) 88%, transparent)',
  },
  ':where(&) > * + *': { marginTop: '1rem' },
  ':where(&) h2': {
    marginTop: '2.5rem',
    marginBottom: '0.5rem',
    fontSize: 'type.20',
    color: 'var(--foreground)',
  },
  ':where(&) h3': {
    marginTop: '1.75rem',
    marginBottom: '0.375rem',
    fontSize: 'type.16',
    color: 'var(--foreground)',
  },
  ':where(&) :is(h2, h3) + *': { marginTop: '0' },
  ':where(&) :where(a)': {
    ...link,
    transition: 'text-decoration-color var(--quorum-durations-fast) var(--ease-out)',
  },
  ':where(&) :where(a):hover': { textDecorationColor: 'var(--foreground)' },
  ':where(&) :where(ul, ol)': { paddingLeft: '1.3em' },
  ':where(&) :where(ul)': { listStyle: 'disc' },
  ':where(&) :where(ol)': { listStyle: 'decimal' },
  ':where(&) :where(li + li)': { marginTop: '0.3em' },
  ':where(&) li::marker': { color: 'var(--muted-foreground)' },
  ':where(&) strong': { fontWeight: 'semibold', color: 'var(--foreground)' },
  ':where(&) code': {
    fontFamily: 'var(--mono)',
    fontSize: 'code',
    padding: '0.1em 0.35em',
    borderRadius: 'sm',
    background: 'var(--well)',
  },
  ':where(&) pre': {
    fontFamily: 'var(--mono)',
    fontSize: 'type.13',
    lineHeight: 'code',
    padding: '14px 16px',
    borderRadius: 'xl',
    background: 'var(--well)',
    boxShadow: 'well',
    overflowX: 'auto',
  },
  ':where(&) pre code': { padding: '0', background: 'none' },
  ':where(&) blockquote': {
    paddingLeft: '14px',
    borderLeft: '2px solid var(--hairline)',
    color: 'var(--muted-foreground)',
  },
  ':where(&) :where(.prose-figure) img': {
    display: 'block',
    maxWidth: '100%',
    height: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'md',
  },
  ':where(&) :where(.prose-figure) figcaption': {
    marginTop: '0.5em',
    fontSize: 'type.13',
    lineHeight: 'normal',
    color: 'var(--muted-foreground)',
  },
  ':where(&) hr': { border: '0', borderTop: '1px solid var(--hairline)', margin: '2rem 0' },
  ':where(&) .anchor': {
    display: 'inline-flex',
    minWidth: '24px',
    minHeight: '24px',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: '0.2em',
    color: 'transparent',
    textDecoration: 'none',
  },
  ':where(&) :is(h2, h3) > a:not(:where(.anchor))': {
    display: 'inline-block',
    marginBlock: '-2px',
    paddingBlock: '2px',
  },
  ':where(&) :is(h2, h3):hover .anchor, :where(&) .anchor:focus-visible': {
    color: 'var(--muted-foreground)',
  },
  /* Blocks marked not-prose keep their own list and link styles. */
  ':where(&) :is(ul, ol):where(.not-prose), :where(&) :where(.not-prose) :is(ul, ol)': {
    paddingLeft: '0',
    listStyle: 'none',
  },
  ':where(&) :where(.not-prose) li + li': { marginTop: '0' },
  ':where(&) :where(.not-prose) a': { textDecoration: 'none' },
  /* A prose block inside a not-prose aside (an infobox's note) still underlines its links. */
  ':where(&) :where(.not-prose .prose) a:is(a)': {
    textDecoration: 'underline',
    textDecorationColor: link.textDecorationColor,
  },
  /* A prose table keeps its own border and spacing, but its links are still links in a
     sentence. */
  ':where(&) :where(.prose-table) a:is(a)': link,
  ':where(&) :where(.prose-table) a:hover': { textDecorationColor: 'var(--foreground)' },
}

export const proseStyle = css(prose)
