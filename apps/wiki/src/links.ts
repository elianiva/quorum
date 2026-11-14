import type * as Markdown from '@foldkit/markdown'

/* The wiki paths and Sandboxes a document links to or places. Kept free of views so the build's
   content index can read every file without loading the renderer. */

export const linksIn = (
  document: Markdown.MarkdownDocument,
): Readonly<{ paths: ReadonlySet<string>; sandboxes: ReadonlySet<string> }> => {
  const paths = new Set<string>()
  const sandboxes = new Set<string>()
  const inlines = (content: ReadonlyArray<Markdown.Inline>): void => {
    for (const node of content) {
      if (node._tag === 'Link') {
        if (node.url.startsWith('/')) paths.add(node.url.split('#')[0] ?? node.url)
        inlines(node.content)
      } else if (
        node._tag === 'Emphasis' ||
        node._tag === 'Strong' ||
        node._tag === 'Strikethrough'
      )
        inlines(node.content)
    }
  }
  const blocks = (list: ReadonlyArray<Markdown.Block>): void => {
    for (const block of list) {
      switch (block._tag) {
        case 'Heading':
        case 'Paragraph':
          inlines(block.content)
          break
        case 'List':
          for (const item of block.items) blocks(item.blocks)
          break
        case 'Blockquote':
          blocks(block.blocks)
          break
        case 'Table':
          for (const row of [block.headerRow, ...block.bodyRows])
            for (const cell of row.cells) inlines(cell.content)
          break
        case 'Island':
          if (block.name === 'Sandbox' && block.attributes.id) sandboxes.add(block.attributes.id)
          blocks(block.blocks)
          break
        default:
      }
    }
  }
  blocks(document.blocks)
  return { paths, sandboxes }
}
