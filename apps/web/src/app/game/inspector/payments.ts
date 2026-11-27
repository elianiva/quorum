import { copy } from '@/i18n/messages.ts'
import { drawerSize } from '@quorum/simulation/lookups'
import { money } from '@quorum/ui/game/format'
import { type Panel, row } from './shared.ts'

export const paymentsPanel: Panel = {
  stats: ({ game, ledger, h }) => {
    const t = copy(h)

    return [
      row(
        h,
        t.inspectorPayments.inTheDrawer,
        money(game.pending),
        game.pending >= drawerSize(game, ledger.revenue) * 0.98 ? 'warn' : 'plain',
      ),
      row(h, t.inspectorPayments.drawerSize, money(drawerSize(game, ledger.revenue)), 'plain'),
      row(h, t.inspectorPayments.spilled, money(game.spilled), game.spilled > 0 ? 'warn' : 'plain'),
      row(h, t.inspectorPayments.revenue, t.inspectorPayments.s(money(ledger.revenue)), 'ok'),
      ...(ledger.subscriptions > 0
        ? [
            row(
              h,
              t.inspectorPayments.subscriptions,
              t.inspectorPayments.s(money(ledger.subscriptions)),
              'ok',
            ),
          ]
        : []),
      row(h, t.inspectorPayments.burn, t.inspectorPayments.s(money(ledger.burn)), 'plain'),
      ...(ledger.salaries > 0
        ? [
            row(
              h,
              t.inspectorPayments.salaries,
              t.inspectorPayments.s(money(ledger.salaries)),
              'plain',
            ),
          ]
        : []),
    ]
  },
}
