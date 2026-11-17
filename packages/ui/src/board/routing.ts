import {
  CARD_W,
  CARD_CLEARANCE_PX,
  gap,
  heightOf,
  inPort,
  layoutOf,
  outPort,
  smooth,
  type Placed,
  type Pt,
  type Route,
} from './geometry.ts'

export type RoutedNode = Placed & Readonly<{ id: string }>
export type RoutedLink = Readonly<{ from: string; to: string }>
export type Wire = Readonly<{
  path: Route
  pieces: ReadonlyArray<Route>
  tunnels: ReadonlyArray<readonly [number, number]>
}>

const MARGIN = CARD_CLEARANCE_PX / 2
const LANE = 12
const PAD = 5
const MIN_LANE = 4
const BEND_COST = 40
const PRESENT_COST = 4
const HISTORY_COST = 2
const PASSES = 4
const HOP = 7
export const SURFACE_MIN_PX = 22

const keyOf = (link: RoutedLink): string => `${link.from}>${link.to}`

type Rect = Readonly<{ x0: number; y0: number; x1: number; y1: number }>

class Heap {
  private keys: Array<number> = []
  private items: Array<number> = []
  get size(): number {
    return this.items.length
  }
  push(key: number, item: number): void {
    const keys = this.keys
    const items = this.items
    let index = items.length
    keys.push(key)
    items.push(item)
    while (index > 0) {
      const parent = (index - 1) >> 1
      if ((keys[parent] as number) <= key) break
      keys[index] = keys[parent] as number
      items[index] = items[parent] as number
      index = parent
    }
    keys[index] = key
    items[index] = item
  }
  pop(): number {
    const keys = this.keys
    const items = this.items
    const top = items[0] as number
    const lastKey = keys.pop() as number
    const lastItem = items.pop() as number
    if (items.length === 0) return top
    let index = 0
    for (;;) {
      const left = index * 2 + 1
      if (left >= items.length) break
      const right = left + 1
      const child =
        right < items.length && (keys[right] as number) < (keys[left] as number) ? right : left
      if ((keys[child] as number) >= lastKey) break
      keys[index] = keys[child] as number
      items[index] = items[child] as number
      index = child
    }
    keys[index] = lastKey
    items[index] = lastItem
    return top
  }
}

const DX = [1, -1, 0, 0] as const
const DY = [0, 0, 1, -1] as const

type Tree = {
  next: Map<number, number>
  dir: Map<number, number>
  edges: Set<number>
  joins: Int8Array
  owns: Uint8Array
  starts: Set<number>
  box: { x0: number; y0: number; x1: number; y1: number }
}

type Run = {
  bundle: string
  vertical: boolean
  line: number
  lo: number
  hi: number
  edges: Array<number>
  offset: number
}

export const routeLinks = (
  nodes: ReadonlyArray<RoutedNode>,
  links: ReadonlyArray<RoutedLink>,
): Map<string, Wire> => {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const rects: Array<Rect> = nodes.map((node) => ({
    x0: node.x,
    y0: node.y,
    x1: node.x + CARD_W,
    y1: node.y + heightOf(node.type),
  }))
  const ends = links.flatMap((link) => {
    const from = byId.get(link.from)
    const to = byId.get(link.to)
    if (!from || !to || link.from === link.to) return []
    if (layoutOf(from.type).outRow === null || layoutOf(to.type).inRow === null) return []
    return [{ link, out: outPort(from), in: inPort(to) }]
  })
  const wires = new Map<string, Wire>()
  if (ends.length === 0) return wires

  const xSet = new Set<number>()
  const ySet = new Set<number>()
  for (const rect of rects) {
    xSet.add(rect.x0 - MARGIN).add(rect.x1 + MARGIN)
    ySet.add(rect.y0 - MARGIN).add(rect.y1 + MARGIN)
  }
  for (const end of ends) {
    xSet.add(end.out.x + MARGIN).add(end.in.x - MARGIN)
    ySet.add(end.out.y).add(end.in.y)
  }
  const outer = 3 * MARGIN
  xSet.add(Math.min(...rects.map((rect) => rect.x0)) - outer)
  xSet.add(Math.max(...rects.map((rect) => rect.x1)) + outer)
  ySet.add(Math.min(...rects.map((rect) => rect.y0)) - outer)
  ySet.add(Math.max(...rects.map((rect) => rect.y1)) + outer)
  const xs = [...xSet].sort((a, b) => a - b)
  const ys = [...ySet].sort((a, b) => a - b)
  const nx = xs.length
  const ny = ys.length
  const xIndex = new Map(xs.map((x, index) => [x, index]))
  const yIndex = new Map(ys.map((y, index) => [y, index]))
  const vid = (i: number, j: number): number => i * ny + j
  const xOf = (v: number): number => xs[Math.floor(v / ny)] as number
  const yOf = (v: number): number => ys[v % ny] as number

  const inside = (x: number, y: number): boolean => {
    for (const rect of rects)
      if (
        x > rect.x0 - MARGIN &&
        x < rect.x1 + MARGIN &&
        y > rect.y0 - MARGIN &&
        y < rect.y1 + MARGIN
      )
        return true
    return false
  }

  const count = nx * ny
  const open = new Uint8Array(count * 2)
  const capacity = new Int32Array(count * 2)
  const freeLo = new Float64Array(count * 2)
  const freeHi = new Float64Array(count * 2)
  const blocked = new Uint8Array(count)
  for (let i = 0; i < nx; i += 1)
    for (let j = 0; j < ny; j += 1)
      blocked[vid(i, j)] = inside(xs[i] as number, ys[j] as number) ? 1 : 0

  const across = (
    at: number,
    from: number,
    to: number,
    vertical: boolean,
  ): Readonly<{ lo: number; hi: number }> => {
    let lo = Number.NEGATIVE_INFINITY
    let hi = Number.POSITIVE_INFINITY
    for (const rect of rects) {
      const a0 = vertical ? rect.y0 : rect.x0
      const a1 = vertical ? rect.y1 : rect.x1
      const c0 = vertical ? rect.x0 : rect.y0
      const c1 = vertical ? rect.x1 : rect.y1
      if (a0 >= to || a1 <= from) continue
      if (c1 <= at) lo = Math.max(lo, c1)
      else if (c0 >= at) hi = Math.min(hi, c0)
    }
    return { lo, hi }
  }
  const lanesFor = (lo: number, hi: number): number =>
    Number.isFinite(hi - lo) ? Math.max(1, Math.floor((hi - lo - 2 * PAD) / LANE) + 1) : 99

  for (let i = 0; i < nx; i += 1) {
    for (let j = 0; j < ny; j += 1) {
      const v = vid(i, j)
      const x = xs[i] as number
      const y = ys[j] as number
      if (i + 1 < nx) {
        const x2 = xs[i + 1] as number
        const e = v * 2
        if (!blocked[v] && !blocked[vid(i + 1, j)] && !inside((x + x2) / 2, y)) {
          open[e] = 1
          const free = across(y, x, x2, false)
          freeLo[e] = free.lo
          freeHi[e] = free.hi
          capacity[e] = lanesFor(free.lo, free.hi)
        }
      }
      if (j + 1 < ny) {
        const y2 = ys[j + 1] as number
        const e = v * 2 + 1
        if (!blocked[v] && !blocked[vid(i, j + 1)] && !inside(x, (y + y2) / 2)) {
          open[e] = 1
          const free = across(x, y, y2, true)
          freeLo[e] = free.lo
          freeHi[e] = free.hi
          capacity[e] = lanesFor(free.lo, free.hi)
        }
      }
    }
  }

  const step = (v: number, d: number): Readonly<{ edge: number; to: number }> | null => {
    const i = Math.floor(v / ny) + (DX[d] as number)
    const j = (v % ny) + (DY[d] as number)
    if (i < 0 || i >= nx || j < 0 || j >= ny) return null
    const to = vid(i, j)
    const edge = d === 0 ? v * 2 : d === 1 ? to * 2 : d === 2 ? v * 2 + 1 : to * 2 + 1
    return open[edge] ? { edge, to } : null
  }

  const history = new Float64Array(count * 2)
  const order = [...ends].sort((a, b) => (keyOf(a.link) < keyOf(b.link) ? -1 : 1))
  let trees = new Map<string, Tree>()
  let paths = new Map<string, Array<number>>()
  const g = new Float64Array(count * 4)
  const seen = new Int32Array(count * 4)
  let search = 0
  const came = new Int32Array(count * 4)

  for (let pass = 0; pass < PASSES; pass += 1) {
    trees = new Map()
    paths = new Map()
    const use = new Int32Array(count * 2)
    for (const end of order) {
      const start = vid(xIndex.get(end.out.x + MARGIN) as number, yIndex.get(end.out.y) as number)
      const root = vid(xIndex.get(end.in.x - MARGIN) as number, yIndex.get(end.in.y) as number)
      if (blocked[start] || blocked[root]) continue
      const bundle = end.link.to
      let tree = trees.get(bundle)
      if (!tree) {
        tree = {
          next: new Map([[root, -1]]),
          dir: new Map([[root, 0]]),
          edges: new Set(),
          joins: new Int8Array(count),
          owns: new Uint8Array(count * 2),
          starts: new Set(),
          box: { x0: xOf(root), y0: yOf(root), x1: xOf(root), y1: yOf(root) },
        }
        tree.joins[root] = 1
        trees.set(bundle, tree)
      }
      const t = tree
      const h = (v: number): number => {
        const x = xOf(v)
        const y = yOf(v)
        return Math.max(0, t.box.x0 - x, x - t.box.x1) + Math.max(0, t.box.y0 - y, y - t.box.y1)
      }
      search += 1
      const heap = new Heap()
      const first = start * 4
      g[first] = 0
      seen[first] = search
      came[first] = -1
      heap.push(h(start), first)
      let found = -1
      while (heap.size > 0) {
        const state = heap.pop()
        const v = state >> 2
        const d = state & 3
        const cost = g[state] as number
        const join = t.joins[v] as number
        if (join !== 0) {
          if (d !== ((join - 1) ^ 1)) {
            found = state
            break
          }
          continue
        }
        const vi = Math.floor(v / ny)
        const vj = v - vi * ny
        for (let nd = 0; nd < 4; nd += 1) {
          if (nd === (d ^ 1)) continue
          const i = vi + (DX[nd] as number)
          const j = vj + (DY[nd] as number)
          if (i < 0 || i >= nx || j < 0 || j >= ny) continue
          const to = i * ny + j
          const edge = nd === 0 ? v * 2 : nd === 1 ? to * 2 : nd === 2 ? v * 2 + 1 : to * 2 + 1
          if (!open[edge]) continue
          const length =
            Math.abs((xs[i] as number) - (xs[vi] as number)) +
            Math.abs((ys[j] as number) - (ys[vj] as number))
          const crowd = t.owns[edge]
            ? 0
            : Math.max(0, (use[edge] as number) + 1 - (capacity[edge] as number))
          const total =
            cost +
            length * (1 + (history[edge] as number) + PRESENT_COST * crowd) +
            (nd === d ? 0 : BEND_COST)
          const ns = to * 4 + nd
          if (seen[ns] !== search || total < (g[ns] as number)) {
            seen[ns] = search
            g[ns] = total
            came[ns] = state
            heap.push(total + h(to), ns)
          }
        }
      }
      if (found < 0) continue
      const own: Array<number> = []
      for (let state = found; state >= 0; state = came[state] as number) own.push(state)
      own.reverse()
      for (let index = 0; index < own.length - 1; index += 1) {
        const state = own[index + 1] as number
        const v = (own[index] as number) >> 2
        const d = state & 3
        const edge = (step(v, d) as { edge: number }).edge
        t.next.set(v, state >> 2)
        t.dir.set(v, d)
        t.joins[v] = d + 1
        if (!t.edges.has(edge)) {
          t.edges.add(edge)
          t.owns[edge] = 1
          use[edge] = (use[edge] as number) + 1
        }
        t.box.x0 = Math.min(t.box.x0, xOf(v))
        t.box.x1 = Math.max(t.box.x1, xOf(v))
        t.box.y0 = Math.min(t.box.y0, yOf(v))
        t.box.y1 = Math.max(t.box.y1, yOf(v))
      }
      t.starts.add(start)
      const vertices = own.map((state) => state >> 2)
      for (let v = t.next.get(found >> 2) ?? -1; v >= 0; v = t.next.get(v) ?? -1) vertices.push(v)
      paths.set(keyOf(end.link), vertices)
    }
    let over = false
    for (let e = 0; e < count * 2; e += 1) {
      const extra = (use[e] as number) - (capacity[e] as number)
      if (extra > 0) {
        over = true
        history[e] = (history[e] as number) + HISTORY_COST * extra
      }
    }
    if (!over) break
  }

  const runs: Array<Run> = []
  const runOf = new Map<string, Run>()
  for (const [bundle, tree] of trees) {
    const byLine = new Map<string, Array<{ at: number; edge: number }>>()
    for (const edge of tree.edges) {
      const v = edge >> 1
      const vertical = (edge & 1) === 1
      const line = vertical ? Math.floor(v / ny) : v % ny
      const at = vertical ? v % ny : Math.floor(v / ny)
      const key = `${vertical ? 'v' : 'h'}${line}`
      const list = byLine.get(key) ?? []
      list.push({ at, edge })
      byLine.set(key, list)
    }
    for (const [key, list] of byLine) {
      list.sort((a, b) => a.at - b.at)
      let run: Run | null = null
      for (const { at, edge } of list) {
        if (run && run.hi === at) {
          run.hi = at + 1
          run.edges.push(edge)
        } else {
          run = {
            bundle,
            vertical: key.startsWith('v'),
            line: Number(key.slice(1)),
            lo: at,
            hi: at + 1,
            edges: [edge],
            offset: 0,
          }
          runs.push(run)
        }
        runOf.set(`${edge}:${bundle}`, run)
      }
    }
  }

  const sideAt = (run: Run, at: number): number => {
    const tree = trees.get(run.bundle) as Tree
    const vertical = run.vertical
    const v = vertical ? vid(run.line, at) : vid(at, run.line)
    const has = (d: number): boolean => {
      if (vertical && d === 0 && tree.dir.get(v) === 0 && tree.next.get(v) === -1) return true
      if (vertical && d === 1 && tree.starts.has(v)) return true
      const next = step(v, d)
      return next !== null && tree.edges.has(next.edge)
    }
    const [plus, minus] = vertical ? [0, 1] : [2, 3]
    return (has(plus) ? 1 : 0) - (has(minus) ? 1 : 0)
  }
  const compare = (a: Run, b: Run): number => {
    let low = 0
    if (a.lo === b.lo) low = sideAt(a, a.lo) - sideAt(b, b.lo)
    else if (a.lo > b.lo) low = sideAt(a, a.lo)
    else low = -sideAt(b, b.lo)
    let high = 0
    if (a.hi === b.hi) high = sideAt(a, a.hi) - sideAt(b, b.hi)
    else if (a.hi < b.hi) high = sideAt(a, a.hi)
    else high = -sideAt(b, b.hi)
    const vote = low !== 0 ? low : high
    return vote !== 0 ? vote : a.bundle < b.bundle ? -1 : 1
  }

  const lines = new Map<string, Array<Run>>()
  for (const run of runs) {
    const key = `${run.vertical ? 'v' : 'h'}${run.line}`
    const list = lines.get(key) ?? []
    list.push(run)
    lines.set(key, list)
  }
  for (const [key, list] of lines) {
    const vertical = key.startsWith('v')
    const coordinate = vertical
      ? (xs[Number(key.slice(1))] as number)
      : (ys[Number(key.slice(1))] as number)
    list.sort((a, b) => a.lo - b.lo)
    let cluster: Array<Run> = []
    let reach = Number.NEGATIVE_INFINITY
    const settle = (group: Array<Run>): void => {
      if (group.length < 2) return
      group.sort(compare)
      let lo = Number.NEGATIVE_INFINITY
      let hi = Number.POSITIVE_INFINITY
      for (const run of group)
        for (const edge of run.edges) {
          lo = Math.max(lo, freeLo[edge] as number)
          hi = Math.min(hi, freeHi[edge] as number)
        }
      const n = group.length
      const room = hi - lo - 2 * PAD
      const spacing = Math.max(MIN_LANE, Math.min(LANE, room / (n - 1)))
      let shift = 0
      const first = coordinate - ((n - 1) / 2) * spacing
      const last = coordinate + ((n - 1) / 2) * spacing
      if (last - first <= room) {
        if (first < lo + PAD) shift = lo + PAD - first
        else if (last > hi - PAD) shift = hi - PAD - last
      } else if (Number.isFinite(room)) shift = (lo + hi) / 2 - coordinate
      group.forEach((run, index) => {
        run.offset = (index - (n - 1) / 2) * spacing + shift
      })
    }
    for (const run of list) {
      if (run.lo >= reach) {
        settle(cluster)
        cluster = []
      }
      cluster.push(run)
      reach = Math.max(reach, run.hi)
    }
    settle(cluster)
  }

  const corners = new Map<string, Array<Pt>>()
  for (const end of order) {
    const key = keyOf(end.link)
    const vertices = paths.get(key)
    if (!vertices) continue
    const bundle = end.link.to
    const points: Array<Pt> = [end.out]
    let previous: Readonly<{ vertical: boolean; at: number }> = { vertical: false, at: end.out.y }
    let index = 0
    while (index < vertices.length - 1) {
      const v = vertices[index] as number
      const d = [0, 1, 2, 3].find((dir) => step(v, dir)?.to === vertices[index + 1]) as number
      const edge = (step(v, d) as { edge: number }).edge
      const vertical = d >= 2
      const run = runOf.get(`${edge}:${bundle}`)
      const at = (vertical ? xOf(v) : yOf(v)) + (run?.offset ?? 0)
      let last = index + 1
      while (last < vertices.length - 1) {
        const w = vertices[last] as number
        if (step(w, d)?.to !== vertices[last + 1]) break
        last += 1
      }
      if (vertical === previous.vertical) {
        if (at !== previous.at) {
          points.push({ x: end.out.x + 3, y: previous.at })
          points.push({ x: xOf(v), y: at })
        }
      } else points.push(vertical ? { x: at, y: previous.at } : { x: previous.at, y: at })
      previous = { vertical, at }
      index = last
    }
    if (previous.vertical) points.push({ x: previous.at, y: end.in.y })
    else if (previous.at !== end.in.y) {
      points.push({ x: end.in.x - MARGIN, y: previous.at })
      points.push({ x: end.in.x - 3, y: end.in.y })
    }
    points.push(end.in)
    corners.set(key, points)
  }

  const hops = new Map<string, Array<Pt>>()
  const entries = [...corners]
  for (const [aKey, a] of entries) {
    const aTo = aKey.slice(aKey.indexOf('>') + 1)
    for (const [bKey, b] of entries) {
      if (bKey.slice(bKey.indexOf('>') + 1) === aTo) continue
      for (let i = 1; i < a.length; i += 1) {
        const p = a[i - 1] as Pt
        const q = a[i] as Pt
        if (Math.abs(p.x - q.x) > 0.01) continue
        const top = Math.min(p.y, q.y)
        const bottom = Math.max(p.y, q.y)
        for (let k = 1; k < b.length; k += 1) {
          const r = b[k - 1] as Pt
          const s = b[k] as Pt
          if (Math.abs(r.y - s.y) > 0.01) continue
          const left = Math.min(r.x, s.x)
          const right = Math.max(r.x, s.x)
          if (p.x > left + 1 && p.x < right - 1 && r.y > top + HOP && r.y < bottom - HOP) {
            const list = hops.get(aKey) ?? []
            if (!list.some((hop) => Math.abs(hop.y - r.y) < 1)) list.push({ x: p.x, y: r.y })
            hops.set(aKey, list)
          }
        }
      }
    }
  }

  for (const [key, points] of corners) {
    const path = smooth(points)
    wires.set(key, { path, ...cut(path, hops.get(key) ?? []) })
  }
  return wires
}

const cut = (path: Route, hops: ReadonlyArray<Pt>): Pick<Wire, 'pieces' | 'tunnels'> => {
  if (hops.length === 0) return { pieces: [path], tunnels: [] }
  const spans: Array<[number, number]> = []
  let travelled = 0
  for (let index = 1; index < path.length; index += 1) {
    const point = path[index] as Pt
    const previous = path[index - 1] as Pt
    if (Math.abs(previous.x - point.x) < 0.01)
      for (const hop of hops)
        if (
          Math.abs(hop.x - point.x) < 0.5 &&
          hop.y > Math.min(previous.y, point.y) &&
          hop.y < Math.max(previous.y, point.y)
        ) {
          const at = travelled + Math.abs(hop.y - previous.y)
          spans.push([at - HOP, at + HOP])
        }
    travelled += gap(previous, point)
  }
  spans.sort((a, b) => a[0] - b[0])
  const tunnels: Array<[number, number]> = []
  for (const span of spans) {
    const last = tunnels.at(-1)
    if (last && span[0] - last[1] < SURFACE_MIN_PX) last[1] = Math.max(last[1], span[1])
    else tunnels.push([span[0], span[1]])
  }
  const ends = [0, ...tunnels.flat(), travelled]
  const pieces: Array<Route> = []
  for (let index = 0; index < ends.length; index += 2)
    pieces.push(slice(path, ends[index] as number, ends[index + 1] as number))
  return { pieces, tunnels }
}

const slice = (path: Route, start: number, end: number): Route => {
  const out: Array<Pt> = []
  let travelled = 0
  for (let index = 1; index < path.length; index += 1) {
    const a = path[index - 1] as Pt
    const b = path[index] as Pt
    const span = gap(a, b)
    const at = (d: number): Pt => {
      const k = span > 0 ? (d - travelled) / span : 0
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
    }
    if (travelled + span >= start && travelled <= end) {
      if (out.length === 0) out.push(at(Math.max(start, travelled)))
      out.push(travelled + span <= end ? b : at(end))
    }
    travelled += span
    if (travelled >= end) break
  }
  return out
}
