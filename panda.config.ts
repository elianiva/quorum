import { quorumConfig } from './packages/ui/src/panda/config.ts'

export default quorumConfig(
  ['./apps/web/src/**/*.ts', './apps/wiki/src/**/*.ts', './packages/ui/src/**/*.ts'],
  'packages/styled-system',
)
