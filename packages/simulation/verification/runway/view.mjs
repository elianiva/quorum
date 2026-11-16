export const title = 'Runway: cash, the bridge, and the shutdown'

export const state = (v) => {
  const sold = v.gone.length
  const nodes =
    sold === 0 ? 'all Nodes billing' : sold === 2 ? 'no Node billing' : 'one Node billing'
  const bridge = { None: 'no bridge yet', Offered: 'bridge offered', Taken: 'bridge used up' }[
    v.bridge
  ]
  return `${v.cash >= 0 ? 'Cash positive' : 'Cash negative'}, ${bridge}, ${nodes}`
}

export const step = (action, from, to) => {
  if (action === 'Sell') return 'you sell a Node'
  if (action === 'Place') return 'you place a Node back'
  if (action === 'AcceptBridge') return 'you accept the bridge'
  if (to.offerAndShut) return 'a Step offers the bridge and shuts Nodes down at once'
  if (to.justShut) return 'a Step shuts Nodes down'
  if (from.bridge === 'None' && to.bridge === 'Offered') return 'a Step offers the bridge'
  return 'a Step bills Burn'
}

export const group = (v) => v.bridge
export const colors = { None: 'blue', Offered: 'yellow', Taken: 'orange' }
