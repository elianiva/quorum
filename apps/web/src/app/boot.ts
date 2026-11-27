import { Schema } from 'effect'

export const Boot = Schema.TaggedUnion({
  Shut: {},
  Clocking: {},
  Ready: {},
})
export type Boot = typeof Boot.Type
