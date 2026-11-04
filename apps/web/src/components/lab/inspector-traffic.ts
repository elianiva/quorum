import type { Html, HtmlBuilder } from 'foldkit/html'
import { clockOf } from '@quorum/simulation/calendar'
import { KINDS } from '@quorum/simulation/catalog'
import type { Ledger } from '@quorum/simulation/ledger'
import type { GameNode } from '@quorum/simulation/state'
import { has } from '@quorum/simulation/lookups'
import { compact, queueWait, rate } from '@/game/format.ts'
import { Message } from '@/game/message.ts'
import type { Model } from '@/game/model.ts'
import { hintOf, sampleNode, TRAFFIC_KINDS, type NodeSample } from '@/game/node-metrics.ts'
import { button } from '@/components/ui/button'
import { EYEBROW, FIGURE, row, WELL } from './bits.ts'

const percent = (value: number): string => `${Math.round(value * 100)}%`
const when = (time: number): string => {
  const clock = clockOf(time)
  return `Day ${clock.day} · ${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`
}
const difference = (value: number): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${rate(Math.abs(value))}/s`

const chart = (
  history: ReadonlyArray<NodeSample>,
  selected: number,
  nodeId: string,
  h: HtmlBuilder<Message>,
): Html => {
  const width = 300
  const height = 52
  const first = history[0]!.time
  const span = Math.max(1, history.at(-1)!.time - first)
  const top = Math.max(1, ...history.map((sample) => sample.utilization))
  const x = (sample: NodeSample) => ((sample.time - first) / span) * width
  const y = (sample: NodeSample) => height - (sample.utilization / top) * height
  const chosen = history[selected]
  return h.svg(
    [
      h.Class('h-[60px] w-full overflow-visible'),
      h.Attribute('viewBox', `0 0 ${width} ${height}`),
      h.Attribute('preserveAspectRatio', 'none'),
      h.AriaLabel('Load history. Select a point or use the sample slider below.'),
    ],
    [
      h.line([
        h.Attribute('x1', '0'),
        h.Attribute('x2', String(width)),
        h.Attribute('y1', String(height - height / top)),
        h.Attribute('y2', String(height - height / top)),
        h.Attribute('stroke', 'var(--danger)'),
        h.Attribute('stroke-dasharray', '3 3'),
      ]),
      h.polyline([
        h.Attribute('points', history.map((sample) => `${x(sample)},${y(sample)}`).join(' ')),
        h.Attribute('fill', 'none'),
        h.Attribute('stroke', 'var(--primary-strong)'),
        h.Attribute('stroke-width', '1.5'),
      ]),
      ...(chosen
        ? [
            h.line([
              h.Attribute('x1', String(x(chosen))),
              h.Attribute('x2', String(x(chosen))),
              h.Attribute('y1', '0'),
              h.Attribute('y2', String(height)),
              h.Attribute('stroke', 'var(--group-compute)'),
              h.Attribute('stroke-width', '1.5'),
            ]),
            h.circle([
              h.Attribute('cx', String(x(chosen))),
              h.Attribute('cy', String(y(chosen))),
              h.Attribute('r', '3'),
              h.Attribute('fill', 'var(--group-compute)'),
            ]),
          ]
        : []),
      ...history.map((sample, index) => {
        const left = index === 0 ? 0 : (x(history[index - 1]!) + x(sample)) / 2
        const right =
          index === history.length - 1 ? width : (x(sample) + x(history[index + 1]!)) / 2
        return h.rect([
          h.Attribute('x', String(left)),
          h.Attribute('y', '-4'),
          h.Attribute('width', String(right - left)),
          h.Attribute('height', String(height + 8)),
          h.Attribute('fill', 'transparent'),
          h.Class('cursor-crosshair'),
          h.OnClick(Message.NodeSampleChosen({ nodeId, time: sample.time })),
        ])
      }),
    ],
  )
}

const trafficRow = (
  label: string | Html,
  value: number,
  total: number,
  previous: number | null,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class('flex items-start justify-between gap-2 py-1.5 text-[12px]')],
    [
      h.span([h.Class('min-w-0 break-words text-muted-foreground')], [label]),
      h.span(
        [h.Class(`${FIGURE} shrink-0 text-right`)],
        [
          `${rate(value)}/s · ${total > 0 ? percent(value / total) : '0%'}`,
          ...(previous !== null
            ? [
                h.span(
                  [h.Class('block text-[10.5px] text-muted-foreground')],
                  [difference(value - previous)],
                ),
              ]
            : []),
        ],
      ),
    ],
  )

export const inspectorTraffic = (
  model: Model,
  node: GameNode,
  ledger: Ledger,
  h: HtmlBuilder<Message>,
): Html => {
  const history = model.board.nodeHistory[node.id] ?? []
  const selection = model.board.nodeSample
  const index =
    selection?.nodeId === node.id
      ? history.findIndex((sample) => sample.time === selection.time)
      : -1
  const sample = history[index] ?? sampleNode(model.board.game, node, ledger)
  const previous = index > 0 ? history[index - 1] : index === -1 ? history.at(-1) : undefined
  const hint = hintOf(sample)
  const kinds = TRAFFIC_KINDS.filter(
    (kind) => (sample.traffic[kind] ?? 0) > 0 || (previous?.traffic[kind] ?? 0) > 0,
  ).sort((a, b) => (sample.traffic[b] ?? 0) - (sample.traffic[a] ?? 0))
  const sources = [...sample.sources].sort((a, b) => b.rate - a.rate)
  return h.details(
    [
      h.Key('traffic-breakdown'),
      h.Open(true),
      h.Class('fold group px-4'),
      h.DataAttribute('traffic-breakdown', ''),
    ],
    [
      h.summary(
        [h.Class(`${EYEBROW} cursor-pointer py-3 text-muted-foreground`)],
        ['Traffic & load'],
      ),
      h.div(
        [h.Class('space-y-3 pb-3')],
        [
          ...(has(model.board.game, 'metrics') && history.length > 1
            ? [
                chart(history, index, node.id, h),
                h.input([
                  h.Type('range'),
                  h.Attribute('min', '0'),
                  h.Attribute('max', String(history.length - 1)),
                  h.Attribute('step', '1'),
                  h.Value(String(index >= 0 ? index : history.length - 1)),
                  h.AriaLabel('Inspect recorded sample'),
                  h.Attribute(
                    'aria-valuetext',
                    when(history[index >= 0 ? index : history.length - 1]!.time),
                  ),
                  h.Class('h-4 w-full cursor-pointer accent-[var(--group-compute)]'),
                  h.OnInput((value) =>
                    Message.NodeSampleChosen({
                      nodeId: node.id,
                      time: history[Number(value)]?.time ?? null,
                    }),
                  ),
                ]),
                h.p(
                  [h.Class('text-[10.5px] text-muted-foreground')],
                  [
                    'Select a point or use arrow keys on the slider. Up to one day, sampled every 10 game minutes in this session.',
                  ],
                ),
              ]
            : [
                h.p(
                  [h.Class('text-[11px] text-muted-foreground')],
                  [
                    has(model.board.game, 'metrics')
                      ? 'History appears after two recorded samples.'
                      : 'Research Metrics to inspect past samples.',
                  ],
                ),
              ]),
          h.div(
            [h.Class('flex items-center justify-between gap-2')],
            [
              h.div(
                [],
                [
                  h.p(
                    [h.Class(`${EYEBROW} text-group-compute`)],
                    [index >= 0 ? 'Recorded sample' : 'Live traffic'],
                  ),
                  h.p([h.Class(`${FIGURE} mt-1 text-[11px]`)], [when(sample.time)]),
                ],
              ),
              ...(index >= 0
                ? [
                    button(
                      {
                        onClick: Message.NodeSampleChosen({ nodeId: node.id, time: null }),
                        variant: 'outline',
                        size: 'xs',
                      },
                      'Back to live',
                      h,
                    ),
                  ]
                : []),
            ],
          ),
          h.div(
            [h.Class(WELL)],
            [
              row('Inbound', `${rate(sample.inbound)}/s`, 'plain', h),
              row(
                'Load',
                `${percent(sample.utilization)} of ${rate(sample.capacity)}/s`,
                sample.utilization >= 0.9 ? 'danger' : 'plain',
                h,
              ),
              ...(sample.dropped > 0
                ? [
                    row(
                      node.type === 'worker' ? 'Requeued' : 'Dropped',
                      `${rate(sample.dropped)}/s`,
                      'warn',
                      h,
                    ),
                  ]
                : []),
              ...(sample.refused > 0
                ? [row('Refused', `${rate(sample.refused)}/s`, 'danger', h)]
                : []),
              ...(sample.hitRatio !== null
                ? [
                    row(
                      'Hits / misses',
                      `${percent(sample.hitRatio)} / ${percent(1 - sample.hitRatio)}`,
                      'plain',
                      h,
                    ),
                  ]
                : []),
              ...(sample.queue
                ? [
                    row('Backlog', compact(sample.queue.depth), 'plain', h),
                    row('Sent to Workers', `${rate(sample.queue.out)}/s`, 'plain', h),
                    row(
                      'Queue wait',
                      queueWait(
                        sample.queue.stalled ? Number.POSITIVE_INFINITY : sample.queue.wait,
                      ),
                      'plain',
                      h,
                    ),
                  ]
                : []),
            ],
          ),
          ...(previous
            ? [
                h.p(
                  [h.Class('text-[11px] text-muted-foreground')],
                  [
                    `Changes vs ${when(previous.time)}: inbound ${difference(sample.inbound - previous.inbound)}. Operation deltas appear below.`,
                  ],
                ),
              ]
            : []),
          h.div(
            [],
            [
              h.p([h.Class(`${EYEBROW} mb-1 text-muted-foreground`)], ['Incoming operations']),
              ...(kinds.length
                ? kinds.map((kind) =>
                    trafficRow(
                      KINDS[kind].label,
                      sample.traffic[kind] ?? 0,
                      sample.inbound,
                      previous ? (previous.traffic[kind] ?? 0) : null,
                      h,
                    ),
                  )
                : [
                    h.p(
                      [h.Class('text-[12px] text-muted-foreground')],
                      ['No incoming traffic at this sample.'],
                    ),
                  ]),
              h.p(
                [h.Class('mt-1 text-[10.5px] text-muted-foreground')],
                ['Shares describe incoming traffic, not CPU usage.'],
              ),
            ],
          ),
          ...(sources.length
            ? [
                h.div(
                  [],
                  [
                    h.p([h.Class(`${EYEBROW} mb-1 text-muted-foreground`)], ['Sent by']),
                    ...sources.map((source) =>
                      trafficRow(
                        h.span([], [h.span([], [source.name]), ` · ${source.id}`]),
                        source.rate,
                        sample.inbound,
                        previous
                          ? (previous.sources.find((entry) => entry.id === source.id)?.rate ?? 0)
                          : null,
                        h,
                      ),
                    ),
                  ],
                ),
              ]
            : []),
          ...(hint
            ? [
                h.p(
                  [
                    h.Class(
                      'rounded-lg border border-warn/20 bg-warn/5 p-2.5 text-[12px] leading-snug',
                    ),
                    h.DataAttribute('traffic-hint', ''),
                  ],
                  [hint],
                ),
              ]
            : []),
        ],
      ),
    ],
  )
}
