import { css } from '@quorum/styled-system/css'
import { formats } from '@/i18n/format.ts'
import { copy } from '@/i18n/messages.ts'
import type { H } from '@effect/ui/html/Html'
import { CDN_TTLS, CACHE_KEYS } from '@quorum/simulation/catalog'
import type { GameNode, CacheKey } from '@quorum/simulation/state'
import { Message } from '@/game/message.ts'
import { type Content, type Panel, caption, picker, section } from './shared.ts'

const cdnOptions = (node: GameNode, h: H<Message>): Content => {
  const t = copy(h)
  return section(h, t.inspectorCdn.deploysAndKeys, [
    picker(
      h,
      'cdn-purge',
      [
        [false, t.inspectorCdn.keepUntilTheTTL],
        [true, t.inspectorCdn.purgeOnDeploy],
      ],
      node.purge,
      (purge) => Message.CdnOptionsChosen({ nodeId: node.id, purge }),
    ),
    picker(
      h,
      'cdn-key',
      (Object.keys(CACHE_KEYS) as ReadonlyArray<CacheKey>).map(
        (id) => [id, t.catalog.cacheKeys[id].name] as const,
      ),
      node.cacheKey,
      (cacheKey) => Message.CdnOptionsChosen({ nodeId: node.id, cacheKey }),
      () => true,
      css({ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }),
    ),
    caption(
      h,
      node.purge
        ? t.inspectorCdn.aDeployEmptiesTheCacheThe
        : t.inspectorCdn.afterADeployTheEdgeServes,
    ),
    caption(
      h,
      node.cacheKey === 'full'
        ? t.inspectorCdn.theKeyHoldsThePathThe
        : t.inspectorCdn.aSmallerKeyLifts(Math.round((CACHE_KEYS[node.cacheKey].hit - 1) * 100)),
    ),
  ])
}

const cdnTtl = (node: GameNode, h: H<Message>): Content => {
  const t = copy(h)
  return section(h, 'TTL', [
    picker(
      h,
      'cdn-ttl',
      CDN_TTLS.map((entry) => [entry.ttl, formats(t).duration(entry.ttl)] as const),
      node.ttl,
      (ttl) => Message.TtlChosen({ nodeId: node.id, ttl }),
    ),
  ])
}

export const cdnPanel: Panel = {
  body: ({ node, h }) => [cdnTtl(node, h), cdnOptions(node, h)],
}
