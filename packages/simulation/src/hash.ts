import { Schema } from 'effect'
import { Game } from './state.ts'

const encode = Schema.encodeSync(Game)

export const hashGame = (game: Game): string => {
  const encoded = encode(game) as unknown as Record<string, unknown> & {
    nodes: Array<Record<string, unknown>>
  }
  const withoutDisplayMetadata = {
    ...encoded,
    nodes: encoded.nodes.map((node) => {
      const { ordinal: _displayOnly, ...rest } = node
      return rest
    }),
  }
  const text = JSON.stringify(withoutDisplayMetadata)
  let hash = 0x81_1c_9d_c5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01_00_01_93) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}
