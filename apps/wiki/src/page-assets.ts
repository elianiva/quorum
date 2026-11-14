import type * as Markdown from '@foldkit/markdown'
import { Option } from 'effect'
import { loadDesignView } from './components/design-view.ts'
import { loadDiagram } from './components/diagram.ts'
import { loadMath } from './components/math.ts'
import { solverReadyForBoard } from './solver.ts'

/* The renderers a page's prose needs. Each is large, so the page brings in only the ones its
   blocks use before the view draws it. */

const needsOf = (
  blocks: ReadonlyArray<Markdown.Block>,
  needs: { latex: boolean; mermaid: boolean; design: boolean },
): void => {
  for (const block of blocks) {
    switch (block._tag) {
      case 'CodeBlock': {
        const language = Option.getOrNull(block.maybeLanguage)
        if (language === 'latex') needs.latex = true
        if (language === 'mermaid') needs.mermaid = true
        break
      }
      case 'List':
        for (const item of block.items) needsOf(item.blocks, needs)
        break
      case 'Blockquote':
        needsOf(block.blocks, needs)
        break
      case 'Island':
        if (block.name === 'Design') needs.design = true
        needsOf(block.blocks, needs)
        break
      default:
    }
  }
}

export const loadPageAssets = async (document: Markdown.MarkdownDocument): Promise<void> => {
  const needs = { latex: false, mermaid: false, design: false }
  needsOf(document.blocks, needs)
  if (needs.latex) await loadMath()
  if (needs.mermaid) await loadDiagram()
  if (needs.design) {
    // The card solves its Design to draw the caption, so this one waits for the Solver.
    await solverReadyForBoard()
    await loadDesignView()
  }
}
