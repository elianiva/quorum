import { Option } from 'effect'
import { copy } from '@/i18n/messages.ts'
import type { Html, HtmlBuilder } from 'foldkit/html'
import { Check, Mic } from 'lucide'
import { Message } from '@/game/message.ts'
import type { Model } from '@/game/model.ts'
import { icon } from '@quorum/ui/primitives/icon'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Dictation, over the action bar. The words are the sentence the board is
   carrying out: they are written out as they arrive, the line before slides
   away when a new one starts, and a Move that lands answers with a tick.
   Underneath, a text field with no chrome of its own takes the words, from a
   keyboard or from any dictation app that types into the focused window.
   ========================================================================== */

type Token = Readonly<{ text: string; index: number }>

/** The line as words, so each can arrive on its own. Spaces ride along. */
const tokensOf = (line: string): ReadonlyArray<Token> =>
  line
    .split(/(\s+)/)
    .filter((piece) => piece !== '')
    .map((text, index) => ({ text, index }))

/** How many words the stagger covers before it stops adding delay. */
const STAGGER = 14

const words = (line: string, live: boolean, h: HtmlBuilder<Message>): ReadonlyArray<Html> =>
  tokensOf(line).map((token) =>
    token.text.trim() === ''
      ? // A space keeps its advance: in an inline-block it would collapse to nothing.
        h.span([h.Key(`space-${token.index}`), h.Class('whitespace-pre')], [token.text])
      : h.span(
          [
            h.Key(`word-${token.index}`),
            h.Class(cn('inline-block text-foreground', live && 'dictate-write')),
            ...(live
              ? [h.Style({ animationDelay: `${Math.min(token.index, STAGGER) * 26}ms` })]
              : []),
          ],
          [token.text],
        ),
  )

/**
 * One sentence. While the player is typing the next one, the finished line is
 * removed and slides off to the left, and the new words come in from the right.
 */
const sentence = (line: string, live: boolean, h: HtmlBuilder<Message>): Html =>
  h.p(
    [
      h.Key(live ? 'dictation-live' : 'dictation-done'),
      h.DataAttribute('exit', 'notice'),
      h.Class(
        cn(
          'm-0 w-max whitespace-nowrap text-[calc(17px*var(--type-scale))] leading-[1.3] font-semibold tracking-[-0.02em]',
          'dictate-sentence',
          live ? 'dictate-sentence-live' : undefined,
        ),
      ),
      h.Title(line),
    ],
    words(line, live, h),
  )

/**
 * The words' way in. It covers the line and shows nothing of itself: the sentence
 * under it is the visible text, so the bar reads as the game taking orders rather
 * than as a form. Enter sends what it holds.
 */
const field = (model: Model, h: HtmlBuilder<Message>): Html => {
  const t = copy(h).voice
  return h.input([
    h.Key('dictation-input'),
    h.DataAttribute('dictation-input', ''),
    h.Type('text'),
    h.Autocomplete('off'),
    h.Autocapitalize('off'),
    h.Spellcheck(false),
    h.AriaLabel(t.dictation),
    h.OnInput((text) => Message.VoiceHeard({ text })),
    h.OnKeyDownPreventDefault((key) =>
      key === 'Enter' && model.voice.heard.trim() !== ''
        ? Option.some(Message.VoiceUttered({ text: model.voice.heard }))
        : Option.none(),
    ),
    h.Class(
      'absolute inset-0 w-full cursor-text bg-transparent text-transparent caret-transparent outline-none',
    ),
  ])
}

/** The microphone is open but nothing has been said: five bars say it is ready. */
const listening = (h: HtmlBuilder<Message>): Html =>
  h.span(
    [h.Class('flex h-5 items-center gap-[5px]'), h.AriaLabel(copy(h).voice.listening)],
    [0, 1, 2, 3, 4].map((bar) =>
      h.span(
        [
          h.Key(`bar-${bar}`),
          h.DataAttribute('wave', String(bar)),
          h.Class('dictate-wave w-[4px] rounded-full bg-foreground/30'),
          h.Style({ height: '16px', animationDelay: `${bar * 130}ms` }),
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
        'press relative grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background shadow-float',
      ),
    ],
    [icon(h, Mic, 'relative size-4')],
  )
}

/** A Move landed: a tick pops in, and a ring goes out around the bar. */
const acknowledged = (model: Model, h: HtmlBuilder<Message>): Html => {
  const { note, error } = model.voice
  if (note === null || error !== null) return h.empty
  return h.span(
    [
      h.Key(`tick-${note}`),
      h.Class(
        'dictate-tick grid size-5 shrink-0 place-items-center rounded-full bg-ok-soft text-ok',
      ),
      h.Title(note),
    ],
    [icon(h, Check, 'size-3')],
  )
}

/** One chip per reading the model found, so "which database" is a choice, not a refusal. */
const choices = (model: Model, h: HtmlBuilder<Message>): Html => {
  const offered = model.voice.choices
  if (offered.length === 0) return h.empty
  return h.div(
    [h.Class('flex flex-wrap gap-1.5 pb-1')],
    offered.map((choice, index) =>
      h.button(
        [
          h.Key(`choice-${index}`),
          h.Type('button'),
          h.OnClick(Message.VoiceChoiceChosen({ question: choice.question, id: choice.id })),
          h.Title(choice.label),
          h.Class(
            'press max-w-[260px] truncate rounded-full bg-well px-2.5 py-1 text-[calc(11px*var(--type-scale))] font-medium tracking-[-0.01em] text-foreground/85 hover:bg-raised',
          ),
        ],
        [choice.label],
      ),
    ),
  )
}

/** The clauses still to run, so a long sentence reads as steps the board is about to take. */
const queued = (model: Model, h: HtmlBuilder<Message>): Html => {
  const { clauses } = model.voice
  if (clauses.length < 2) return h.empty
  return h.div(
    [
      h.Key('queued'),
      h.Class(
        'flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pb-1 text-[calc(11px*var(--type-scale))] font-medium tracking-[-0.01em] text-foreground/35',
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
}

/**
 * The dictation bar: one line of the player's own words, over the board. The
 * line is black as it arrives, the tick says a Move landed, and the beam under
 * it is how much of the sentence the board has carried out.
 */
export const voiceBar = (model: Model, h: HtmlBuilder<Message>): Html => {
  const { on, heard, text, applied, note, error } = model.voice
  const live = heard !== ''
  const shown = live ? heard : text
  const share = live || shown === '' ? 0 : applied / shown.length
  const status = error ?? note
  return h.div(
    [
      h.Key('dictation'),
      h.DataAttribute('dictation', on ? 'on' : 'off'),
      h.Class(
        'dictate-in pointer-events-auto relative flex w-[min(720px,calc(100vw-1.75rem))] flex-col gap-1 rounded-[22px] bg-surface/90 py-2 pr-2 pl-5 shadow-float backdrop-blur-xl transition-shadow focus-within:ring-2 focus-within:ring-foreground/15',
      ),
    ],
    [
      h.div(
        [h.Class('flex items-center gap-2.5')],
        [
          // A dot says the bar is the place being typed into, rather than one more strip of chrome.
          h.span([h.Class('dictate-live size-1.5 shrink-0 rounded-full bg-foreground')], []),
          h.div(
            [h.Class('relative flex min-w-0 flex-1 items-center')],
            [
              shown === ''
                ? listening(h)
                : h.div(
                    [
                      h.DataAttribute('dictation-line', ''),
                      h.Class(
                        'w-full min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                      ),
                    ],
                    [sentence(shown, live, h)],
                  ),
              on ? field(model, h) : h.empty,
            ],
          ),
          acknowledged(model, h),
          status === null
            ? h.empty
            : h.span(
                [
                  h.Class(
                    cn(
                      'max-w-[32%] shrink-0 truncate text-[calc(10.5px*var(--type-scale))] tracking-[-0.01em]',
                      error === null ? 'text-muted-foreground' : 'text-warn',
                    ),
                  ),
                  h.Title(status),
                ],
                [status],
              ),
          on ? microphone(model, h) : h.empty,
        ],
      ),
      queued(model, h),
      choices(model, h),
      // The beam runs along the foot of the bar: how much of the sentence the board has carried out.
      h.span(
        [h.Class('absolute inset-x-5 bottom-0 h-[2px] overflow-hidden rounded-full')],
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
      // A landed Move sends one ring out around the bar, then leaves the tick behind.
      note !== null && error === null
        ? h.span(
            [
              h.Key(`ack-ring-${note}`),
              h.Class('dictate-ack pointer-events-none absolute inset-0 rounded-[22px]'),
            ],
            [],
          )
        : h.empty,
    ],
  )
}
