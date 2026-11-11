import { copy } from '@/i18n/messages.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { Mic } from 'lucide'
import { Message } from '@/game/message.ts'
import type { Model } from '@/game/model.ts'
import { icon } from '@quorum/ui/primitives/icon'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Dictation, over the action bar. It is not a text field: it is the sentence
   the board is carrying out. Each word arrives grey, and the words a Move has
   landed on are inked in, so the line reads back as the work it did.
   ========================================================================== */

type Token = Readonly<{ text: string; inked: boolean }>

/** The line as words, each one either acted on or still waiting. Spaces ride along with a word. */
const tokensOf = (line: string, inked: number): ReadonlyArray<Token> => {
  const tokens: Array<Token> = []
  let at = 0
  for (const piece of line.split(/(\s+)/)) {
    if (piece === '') continue
    const end = at + piece.length
    tokens.push({ text: piece, inked: end <= inked })
    at = end
  }
  return tokens
}

const line = (model: Model, h: HtmlBuilder<Message>): Html => {
  const { heard, settled, text, applied, clauses } = model.voice
  const live = heard !== '' ? heard : text
  const liveInk = heard !== '' ? 0 : applied
  const waiting = heard !== '' || clauses.length > 0
  // The line runs on: what was already said stays ahead of what is being said now.
  const shown = settled === '' ? live : live === '' ? settled : `${settled} ${live}`
  const inked = settled === '' ? liveInk : settled.length + 1 + liveInk
  return h.div(
    [
      h.DataAttribute('dictation-line', ''),
      h.Class(
        'w-full min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      ),
    ],
    [
      h.p(
        [
          h.Class(
            'm-0 w-max whitespace-nowrap text-[calc(21px*var(--type-scale))] leading-[1.25] font-semibold tracking-[-0.025em]',
          ),
          h.Title(shown),
        ],
        tokensOf(shown, inked).map((token, index) =>
          // A space is its own token. In an inline-block it has no width, so it stays
          // inline and keeps its advance, and the words do not run together.
          token.text.trim() === ''
            ? h.span([h.Key(`space-${index}`), h.Class('whitespace-pre')], [token.text])
            : h.span(
                [
                  h.Key(`word-${index}`),
                  h.Class(
                    cn(
                      'dictate-ink inline-block',
                      token.inked ? 'text-foreground' : 'text-foreground/20',
                      // Words still to come breathe, and enter from a blur as they arrive.
                      !token.inked && waiting ? 'dictate-waiting dictate-word' : undefined,
                    ),
                  ),
                ],
                [token.text],
              ),
        ),
      ),
    ],
  )
}

/** The microphone is open but the room is quiet: five bars say it is listening, without a label. */
const listening = (h: HtmlBuilder<Message>): Html =>
  h.span(
    [h.Class('flex h-6 items-center gap-[6px]'), h.AriaLabel(copy(h).voice.listening)],
    [0, 1, 2, 3, 4].map((bar) =>
      h.span(
        [
          h.Key(`bar-${bar}`),
          h.DataAttribute('wave', String(bar)),
          h.Class('dictate-wave w-[5px] rounded-full bg-foreground/45'),
          h.Style({ height: '20px', animationDelay: `${bar * 130}ms` }),
        ],
        [],
      ),
    ),
  )

const microphone = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h).voice
  return h.button(
    [
      h.Key('dictation-toggle'),
      h.Type('button'),
      h.Title(t.dictation),
      h.AriaLabel(t.dictation),
      h.AriaPressed(model.voice.on ? 'true' : 'false'),
      h.OnClick(Message.VoiceToggled()),
      h.Class(
        'press relative grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-background shadow-float',
      ),
    ],
    [
      // A soft halo breathes behind the button, so the bar looks awake rather than idle.
      h.span(
        [
          h.Class(
            'dictate-halo pointer-events-none absolute -inset-2 rounded-full bg-foreground/15 blur-lg',
          ),
        ],
        [],
      ),
      icon(h, Mic, 'relative size-[18px]'),
    ],
  )
}

/**
 * The dictation bar: one line of the player's own words, over the board. Its
 * share of ink is how much of the sentence the board has carried out, and the
 * beam under it fills as the words do.
 */
export const voiceBar = (model: Model, h: HtmlBuilder<Message>): Html => {
  const { on, heard, text, applied, note, error, choices, clauses } = model.voice
  const shown = heard !== '' ? heard : text
  const inked = heard !== '' ? 0 : applied
  // The beam is the sentence's ink.
  const share = shown === '' ? 0 : inked / shown.length
  const status = error ?? note
  return h.div(
    [
      h.Key('dictation'),
      h.DataAttribute('dictation', on ? 'on' : 'off'),
      h.Class(
        'dictate-in pointer-events-auto relative flex w-[min(880px,calc(100vw-1.75rem))] flex-col gap-2 rounded-[28px] bg-surface/85 py-3.5 pr-3 pl-7 shadow-float backdrop-blur-xl',
      ),
    ],
    [
      h.div(
        [h.Class('flex items-center gap-4')],
        [
          h.div(
            [h.Class('flex min-w-0 flex-1 items-center')],
            [shown === '' ? listening(h) : line(model, h)],
          ),
          status === null
            ? h.empty
            : h.span(
                [
                  h.Class(
                    cn(
                      'max-w-[30%] shrink-0 truncate text-[calc(11px*var(--type-scale))] tracking-[-0.01em]',
                      error === null ? 'text-muted-foreground' : 'text-warn',
                    ),
                  ),
                  // The bar truncates it; the whole sentence is on the hover.
                  h.Title(status),
                ],
                [status],
              ),
          on ? microphone(model, h) : h.empty,
        ],
      ),
      // The clauses still to run, so a long sentence reads as steps the board is about to take.
      clauses.length > 1
        ? h.div(
            [
              h.Key('queued'),
              h.Class(
                'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pb-1 text-[calc(12px*var(--type-scale))] font-medium tracking-[-0.01em] text-foreground/35',
              ),
            ],
            clauses
              .slice(1)
              .map((clause, index) =>
                h.span(
                  [h.Key(`queued-${clause.text}`), h.Class('dictate-word max-w-[42ch] truncate')],
                  [index === 0 ? clause.text : `· ${clause.text}`],
                ),
              ),
          )
        : h.empty,
      // One chip per reading the model found, so "which database" is a choice, not a refusal.
      choices.length === 0
        ? h.empty
        : h.div(
            [h.Class('flex flex-wrap gap-1.5 pb-1')],
            choices.map((choice, index) =>
              h.button(
                [
                  h.Key(`choice-${index}`),
                  h.Type('button'),
                  h.OnClick(
                    Message.VoiceChoiceChosen({ question: choice.question, id: choice.id }),
                  ),
                  h.Title(choice.label),
                  h.Class(
                    'press max-w-[280px] truncate rounded-full bg-well px-3 py-1.5 text-[calc(12px*var(--type-scale))] font-medium tracking-[-0.01em] text-foreground/85 hover:bg-raised',
                  ),
                ],
                [choice.label],
              ),
            ),
          ),
      // The beam runs along the foot of the bar: how much of the sentence the board has carried out.
      h.span(
        [h.Class('absolute inset-x-7 bottom-0 h-[2px] overflow-hidden rounded-full')],
        [
          h.span(
            [
              h.Class(
                'block h-full rounded-full bg-foreground transition-[width] duration-[720ms] ease-[cubic-bezier(0.22,1,0.36,1)]',
              ),
              h.Style({ width: `${Math.round(share * 100)}%` }),
            ],
            [],
          ),
        ],
      ),
    ],
  )
}
