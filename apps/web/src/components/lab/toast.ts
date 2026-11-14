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

/**
 * One toast surface. A new message replaces the text in place and the surface morphs to fit it, so
 * a run of messages never blinks; it leaves when the last one expires. The same message twice in a
 * row keeps one line and a count, and a danger is announced at once rather than when it ends.
 *
 * `dockRows` is the open build group's row count. The phone dock grows upward to fit its list, so
 * the toast moves above that height instead of covering the first row.
 */
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
          // A panel can fill a short screen, so the toast moves above it rather than over its actions.
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
                bottom: '176px',
                left: '50%',
                zIndex: '50',
                display: 'flex',
                maxWidth: 'calc(100% - 16px)',
                translate: '-50% 0',
                justifyContent: 'center',
                borderRadius: 'xl',
                layerStyle: 'surface',
                paddingInline: '0.875rem',
                paddingBlock: '0.625rem',
                fontSize: 'calc(13px * var(--type-scale))',
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
                    gap: '0.625rem',
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
                        width: '0.5rem',
                        height: '0.5rem',
                        flexShrink: '0',
                        borderRadius: '9999px',
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
                          marginLeft: '0.125rem',
                          flexShrink: '0',
                          fontFamily: 'mono',
                          fontSize: 'calc(11.5px*var(--type-scale))',
                          color: 'var(--muted-foreground)',
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
