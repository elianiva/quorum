import { css, cx } from '@quorum/styled-system/css'
import type { Html, HtmlBuilder } from 'foldkit/html'
import type { Message } from '@/game/message.ts'
import type { Toast } from '@/game/model.ts'

const TOAST_MARK: Record<Toast['tone'], string> = {
  plain: css({ backgroundColor: 'mutedForeground' }),
  ok: css({ backgroundColor: 'ok' }),
  warn: css({ backgroundColor: 'warn' }),
  danger: css({ backgroundColor: 'danger' }),
  primary: css({ backgroundColor: 'primaryStrong' }),
}

export const toast = (
  value: Toast | null,
  overPanel: boolean,
  dockRows: number,
  h: HtmlBuilder<Message>,
): Html =>
  value
    ? h.div(
        [
          h.Key('toast'),
          h.Role(value.tone === 'danger' ? 'alert' : 'status'),
          h.DataAttribute('morph', 'notice'),
          h.DataAttribute('exit', 'notice'),
          h.Attribute(
            'style',
            `--toast-bottom:${
              dockRows > 0
                ? `calc(max(8px, env(safe-area-inset-bottom)) + min(${50 * dockRows + 70}px, calc(46dvh + 68px)))`
                : 'calc(max(8px, env(safe-area-inset-bottom)) + 72px)'
            }`,
          ),
          h.Class(
            cx(
              css({
                pointerEvents: 'none',
                position: 'fixed',
                bottom: '44',
                left: '50%',
                zIndex: '50',
                display: 'flex',
                maxWidth: 'calc(100% - 16px)',
                translate: '-50% 0',
                justifyContent: 'center',
                borderRadius: 'xl',
                layerStyle: 'surface',
                paddingInline: '3.5',
                paddingBlock: '2.5',
                fontSize: 'type.13',
                boxShadow: 'float',
                _compact: {
                  right: 'max(8px, env(safe-area-inset-right))',
                  left: 'max(8px, env(safe-area-inset-left))',
                  bottom: 'var(--toast-bottom)',
                  maxWidth: 'none',
                  translate: '0 0',
                  justifyContent: 'flex-start',
                },
              }),
              overPanel
                ? css({
                    _short: {
                      top: 'max(2px, env(safe-area-inset-top)) !important',
                      right: 'auto !important',
                      bottom: 'auto !important',
                      left: '50% !important',
                      maxWidth: 'calc(100% - 16px) !important',
                      translate: '-50% 0 !important',
                      justifyContent: 'center !important',
                    },
                  })
                : '',
              'enter-toast',
            ),
          ),
        ],
        [
          h.div(
            [
              h.Key(`toast-${value.id}`),
              h.DataAttribute('exit', 'notice'),
              h.Class(
                cx(
                  css({
                    display: 'flex',
                    width: 'max-content',
                    maxWidth: '100%',
                    flexShrink: '0',
                    alignItems: 'center',
                    gap: '2.5',
                  }),
                  'swap',
                ),
              ),
            ],
            [
              h.span(
                [
                  h.Class(
                    cx(
                      css({
                        width: '2',
                        height: '2',
                        flexShrink: '0',
                        borderRadius: 'full',
                      }),
                      TOAST_MARK[value.tone],
                    ),
                  ),
                ],
                [],
              ),
              value.message,
              value.count > 1
                ? h.span(
                    [
                      h.AriaLabel(String(value.count)),
                      h.Class(
                        css({
                          marginLeft: '0.5',
                          flexShrink: '0',
                          fontFamily: 'mono',
                          fontSize: 'type.11-5',
                          color: 'mutedForeground',
                        }),
                      ),
                    ],
                    [`×${value.count}`],
                  )
                : h.empty,
            ],
          ),
        ],
      )
    : h.empty
