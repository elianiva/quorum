import type { Markdown } from '@effect/ui/html'
import { Option, Schema } from 'effect'
import { COMPONENTS, ERAS, KINDS, RESEARCH_TRACKS, researchList } from '@quorum/simulation/catalog'
import { GUIDED_SUMMARY } from '@quorum/simulation/sandbox-summary'
import { documentOf, loadAllProse, proseAt } from './content.ts'
import type { Section } from '../frontmatter.ts'
import { langOf } from '../i18n/lang.ts'
import { islandAttributes } from '../islands.ts'
import { leverOf, leverRows } from '../reference/levers.ts'
import { optionControls } from '../reference/options.ts'
import { SECTION_ORDER, childrenOf, navOf, pageIn, pagesFor } from './pages.ts'
import { WIKI_ORIGIN } from '../site.ts'
import type { Page } from './page.ts'

type Inline = Markdown.Inline
type Block = Markdown.Block

const ENGLISH = langOf('en')

export const markdownPath = (path: string): string => (path === '/' ? '/index.md' : `${path}.md`)

const markdownUrl = (path: string): string => `${WIKI_ORIGIN}${markdownPath(path)}`

const target = (url: string): string => {
  if (!url.startsWith('/') || url.startsWith('//')) return url
  const hash = url.indexOf('#')
  const path = hash === -1 ? url : url.slice(0, hash)
  const rest = hash === -1 ? '' : url.slice(hash)
  return `${markdownUrl(path.replace(/\/+$/, '') || '/')}${rest}`
}

const inlines = (content: ReadonlyArray<Inline>): string =>
  content
    .map((node): string => {
      switch (node._tag) {
        case 'Text':
          return node.value
        case 'InlineCode':
          return `\`${node.value}\``
        case 'HardBreak':
          return '  \n'
        case 'Emphasis':
          return `*${inlines(node.content)}*`
        case 'Strong':
          return `**${inlines(node.content)}**`
        case 'Strikethrough':
          return `~~${inlines(node.content)}~~`
        case 'Link':
          return `[${inlines(node.content)}](${target(node.url)})`
        case 'Image':
          return `![${node.alt}](${node.url.startsWith('/') && !node.url.startsWith('//') ? `${WIKI_ORIGIN}${node.url}` : node.url})`
      }
    })
    .join('')

const quote = (text: string): string =>
  text
    .split('\n')
    .map((line) => (line === '' ? '>' : `> ${line}`))
    .join('\n')

const indent = (text: string, by: string): string =>
  text
    .split('\n')
    .map((line, index) => (index === 0 || line === '' ? line : `${by}${line}`))
    .join('\n')

const NOTE_LABELS = { tip: 'Tip', warn: 'Watch out', real: 'How real is it' } as const

const percent = (share: number): string => `${Math.round(share * 1000) / 10}%`

const decode = {
  Note: Schema.decodeUnknownSync(islandAttributes.Note),
  Sandbox: Schema.decodeUnknownSync(islandAttributes.Sandbox),
  Component: Schema.decodeUnknownSync(islandAttributes.Component),
  Options: Schema.decodeUnknownSync(islandAttributes.Options),
  Mix: Schema.decodeUnknownSync(islandAttributes.Mix),
  Lever: Schema.decodeUnknownSync(islandAttributes.Lever),
  Track: Schema.decodeUnknownSync(islandAttributes.Track),
  Quiz: Schema.decodeUnknownSync(islandAttributes.Quiz),
}

const island = (block: Extract<Block, { _tag: 'Island' }>): string => {
  switch (block.name) {
    case 'Note': {
      const { tone } = decode.Note(block.attributes)
      return quote(`**${NOTE_LABELS[tone ?? 'tip']}.** ${blocksMarkdown(block.blocks)}`)
    }
    case 'Sandbox': {
      const { id } = decode.Sandbox(block.attributes)
      const def = GUIDED_SUMMARY[id]
      const goal = def.objectives[0]?.goal
      return `Sandbox: [${def.name}](${markdownUrl(`/sandboxes/${id}`)})${goal ? `: ${goal}` : ''}`
    }
    case 'Practice': {
      const { id } = block.attributes as { id?: string }
      return `Interactive practice board: ${id ?? ''}, open the page to use it.`
    }
    case 'Design': {
      const { id } = block.attributes as { id?: string }
      return `Interactive Design: ${id ?? ''}, open the page to see it.`
    }
    case 'Component': {
      const { id } = decode.Component(block.attributes)
      const def = COMPONENTS[id]
      return `Component: [${def.name}](${markdownUrl(`/components/${id}`)}) (${def.product}): ${def.blurb}`
    }
    case 'Options': {
      const { id } = decode.Options(block.attributes)
      const controls = optionControls(ENGLISH)[id] ?? []
      if (controls.length === 0) return ''
      return [
        '| Control | Settings | When |',
        '| --- | --- | --- |',
        ...controls.map(
          (control) => `| ${control.name} | ${control.settings} | ${control.shown} |`,
        ),
      ].join('\n')
    }
    case 'Mix': {
      const era = ERAS[Number(decode.Mix(block.attributes).era)]
      const shares = Object.entries(era?.mix ?? {})
        .map(([kind, share]) => `${KINDS[kind as keyof typeof KINDS].label} ${percent(share)}`)
        .join(', ')
      return `Request mix in the ${era?.name ?? ''} Era: ${shares}.`
    }
    case 'Track': {
      const { track } = decode.Track(block.attributes)
      const label = RESEARCH_TRACKS.find((entry) => entry.key === track)?.label ?? track
      const items = researchList
        .filter((entry) => entry.track === track)
        .map((entry) => `[${entry.name}](${markdownUrl(`/research/${entry.id}`)})`)
      return `Research track ${label}: ${items.join(', ')}.`
    }
    case 'Lever': {
      const { kind } = decode.Lever(block.attributes)
      const def = leverOf(ENGLISH, kind)
      const rows = leverRows(kind)
      return [
        `The ${def.name} lever arrives at ${percent(def.base)} of the mix in the ${def.era} Era.`,
        '',
        '| Step | Share of traffic | Dev Hours | Growth |',
        '| --- | --- | --- | --- |',
        ...rows.map(
          (row) =>
            `| ${row.step} | ${percent(row.share)} | ${row.dh} | −${Math.round(row.growth * 100)}% |`,
        ),
        '',
        'The other kinds give up the difference, so total traffic holds.',
      ].join('\n')
    }
    case 'Quiz': {
      const quiz = decode.Quiz(block.attributes)
      const options = quiz.options.split('|')
      const answer = Number(quiz.answer)
      return [
        `**Quiz:** ${quiz.question}`,
        '',
        ...options.map((option, index) => `${index + 1}. ${option}`),
        '',
        `Answer: ${answer}. ${options[answer - 1] ?? ''}. ${quiz.explain}`,
      ].join('\n')
    }
    default:
      return blocksMarkdown(block.blocks)
  }
}

const row = (cells: ReadonlyArray<Markdown.TableCell>): string =>
  `| ${cells.map((cell) => inlines(cell.content).replace(/\|/g, '\\|')).join(' | ')} |`

const blockMarkdown = (block: Block): string => {
  switch (block._tag) {
    case 'Heading':
      return `${'#'.repeat(block.level)} ${inlines(block.content)}`
    case 'Paragraph':
      return inlines(block.content)
    case 'CodeBlock':
      return `\`\`\`${Option.getOrElse(block.language, () => '')}\n${block.value}\n\`\`\``
    case 'List':
      return block.items
        .map((item, index) => {
          const marker = block.isOrdered
            ? `${Option.getOrElse(block.startNumber, () => 1) + index}. `
            : '- '
          return `${marker}${indent(blocksMarkdown(item.blocks), ' '.repeat(marker.length))}`
        })
        .join('\n')
    case 'Blockquote':
      return quote(blocksMarkdown(block.blocks))
    case 'ThematicBreak':
      return '---'
    case 'Table':
      return [
        row(block.headerRow.cells),
        `| ${block.headerRow.cells.map(() => '---').join(' | ')} |`,
        ...block.bodyRows.map((bodyRow) => row(bodyRow.cells)),
      ].join('\n')
    case 'Island':
      return island(block)
  }
}

export const blocksMarkdown = (blocks: ReadonlyArray<Block>): string =>
  blocks.map(blockMarkdown).join('\n\n')

const rendered = new Map<string, string>()

export const pageMarkdown = <Msg>(page: Page<Msg>): string => {
  const cached = rendered.get(page.path)
  if (cached !== undefined) return cached
  const found = proseAt('en', page.path)
  const document = found?.document ?? documentOf(page.path)
  const body = document ? blocksMarkdown(document.blocks) : page.text
  const related = page.related.flatMap((path) => {
    const twin = pageIn<never>('en', path)
    return twin ? [`- [${twin.title}](${markdownUrl(twin.path)})`] : []
  })
  const text = [
    `# ${page.title}`,
    `> ${page.summary}`,
    body,
    related.length ? `## See also\n\n${related.join('\n')}` : '',
    `Source: ${WIKI_ORIGIN}${page.path === '/' ? '' : page.path}`,
  ]
    .filter(Boolean)
    .join('\n\n')
    .concat('\n')
  rendered.set(page.path, text)
  return text
}

const SECTION_LABELS: Record<Section, string> = {
  play: 'Play the game',
  tutorials: 'Tutorials',
  guides: 'Guides',
  explanation: 'Explanation',
  patterns: 'Patterns',
  reference: 'Reference',
  design: 'Design',
  about: 'About',
}

const entry = <Msg>(page: Page<Msg>): string =>
  `- [${page.title}](${markdownUrl(page.path)}): ${page.summary.replace(/\s+/g, ' ')}`

export const llmsTxt = (): string => {
  const home = pageIn<never>('en', '/')
  const sections = SECTION_ORDER.map((section) => ({
    title: SECTION_LABELS[section],
    pages: navOf<never>('en', section),
  }))
  const hubs = SECTION_ORDER.flatMap((section) => navOf<never>('en', section)).flatMap((hub) => {
    const children = childrenOf<never>('en', hub.path)
    return children.length ? [{ title: hub.title, pages: children }] : []
  })
  return [
    '# Quorum Wiki',
    `> The player wiki for Quorum, a game about running the infrastructure of a growing Company. Every page is also served as Markdown at its URL plus \`.md\`; numbers come from the game's catalog. The game changes every week, so a page can lag behind it; see the changelog at ${WIKI_ORIGIN}/about/changelog.`,
    `Every page in one file: [llms-full.txt](${WIKI_ORIGIN}/llms-full.txt)`,
    ...(home ? ['## Start', entry(home)] : []),
    ...[...sections, ...hubs].flatMap(({ title, pages }) =>
      pages.length ? [`## ${title}`, pages.map(entry).join('\n')] : [],
    ),
  ]
    .join('\n\n')
    .concat('\n')
}

const llmsFullTxt = (): string =>
  pagesFor<never>('en')
    .map((page) => `<!-- ${markdownUrl(page.path)} -->\n\n${pageMarkdown(page)}`)
    .join('\n---\n\n')

export const markdownFiles = async (): Promise<Readonly<Record<string, string>>> => {
  await loadAllProse()
  return {
    'llms.txt': llmsTxt(),
    'llms-full.txt': llmsFullTxt(),
    ...Object.fromEntries(
      pagesFor<never>('en').map((page) => [markdownPath(page.path).slice(1), pageMarkdown(page)]),
    ),
  }
}
