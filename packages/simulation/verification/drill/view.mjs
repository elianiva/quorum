export const title = 'The DR drill'
export const state = (v) =>
  ({ Running: `Running, ${v.elapsed} Steps in`, Recovered: 'Recovered', Failed: 'Failed' })[v.phase]
export const step = (_a, from, to) =>
  to.phase === 'Recovered'
    ? 'errors fall under 1%'
    : to.phase === 'Failed'
      ? 'the drill times out'
      : 'a Step passes'
export const group = (v) => v.phase
export const colors = { Running: 'yellow', Recovered: 'teal', Failed: 'orange' }
