import * as k from '../kit/iso-kit.mjs'
import * as G from '../kit/lathe.mjs'
import { PLATE_H, tools } from '../parts.mjs'
import { draw as cache } from './cache.mjs'
import { draw as database } from './database.mjs'
import { draw as lb } from './lb.mjs'
import { draw as server } from './server.mjs'
import { draw as users } from './users.mjs'

const WIDTH = 640
const HEIGHT = 360
const BENCH = { x: -282, y: -98, w: 564, d: 190, r: 10 }
const BENCH_H = 8
const FOOT_H = 5
const TOP = -PLATE_H
const BOTTOM = TOP - BENCH_H

const MODULES = [
  { name: 'users', tag: 'USERS', draw: users, at: [-222, 24], top: 34, lit: false },
  { name: 'lb', tag: 'LB-01', draw: lb, at: [-114, 18], top: 28, lit: true },
  { name: 'server', tag: 'APP-01', draw: server, at: [14, -48], top: 52, lit: false },
  { name: 'server', tag: 'APP-02', draw: server, at: [14, 50], top: 52, lit: false, left: true },
  { name: 'cache', tag: 'CACHE', draw: cache, at: [124, -14], top: 22, lit: false },
  { name: 'database', tag: 'DB-01', draw: database, at: [230, -22], top: 46, lit: false },
]

const P = k.fitProjection(
  [
    ...k.boxCorners(BENCH, BOTTOM - FOOT_H, TOP),
    ...MODULES.flatMap(({ at: [x, y], top }) =>
      k.boxCorners({ x: x - 46, y: y - 40, w: 92, d: 80 }, 0, top),
    ),
  ],
  WIDTH,
  HEIGHT,
  { pad: 18, azimuth: 45, elevation: 30 },
)

const moved = ([dx, dy]) => ({ ...P, origin: k.iso([dx, dy, 0], P) })

function bench(t) {
  const { S, L, D, at, cyl, slab } = t
  const out = [
    `<path class="iso-halo" d="${k.haloOf(BENCH, BOTTOM - FOOT_H, BENCH_H + FOOT_H, P)}"/>`,
  ]
  const feet = [...k.corners(BENCH, 14), [0, BENCH.y + 14], [0, BENCH.y + BENCH.d - 14]]
  for (const [x, y] of t.byDepth(feet)) {
    out.push(S(cyl(x, y, 7, BOTTOM - FOOT_H, 1.4, 28), { tone: 'lo' }))
    out.push(
      S(cyl(x, y, 5.4, BOTTOM - FOOT_H + 1.4, FOOT_H - 1.4, 28), { tone: 'mid', crease: 'none' }),
    )
  }
  out.push(
    S(slab(BENCH, BOTTOM, BENCH_H, 8, 1.6), {
      tone: 'mid',
      inner: L(k.sideSeam(BENCH, BOTTOM + 2.6, P, 8), { tone: 'faint' }),
    }),
  )
  out.push(L(k.planOutline(k.insetPlan(BENCH, 5), TOP, P, 8), { tone: 'faint' }))
  const screws = [...k.corners(BENCH, 10), [0, BENCH.y + 10], [0, BENCH.y + BENCH.d - 10]]
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2, TOP, P, 16)).join(''), { tone: 'lo' }))
  out.push(
    D(
      screws.map(([x, y]) => at([x, y, TOP])),
      { size: 0.5 },
    ),
  )
  const strip = { x: -262, y: BENCH.y + BENCH.d - 13, w: 210, d: 6, r: 1 }
  out.push(S(slab(strip, TOP, 0.6, 3), { tone: 'lo', crease: 'none' }))
  const ticks = k.topTicks(
    strip.x + 3,
    strip.x + strip.w - 3,
    5,
    5,
    strip.y + 0.6,
    TOP + 0.6,
    [1.8, 3.4],
    P,
  )
  out.push(L(ticks.minor, { tone: 'lo' }), L(ticks.major, { tone: 'mid' }))
  out.push(
    D(
      [
        at([strip.x + 1.6, strip.y + 3, TOP + 0.6]),
        at([strip.x + strip.w - 1.6, strip.y + 3, TOP + 0.6]),
      ],
      { size: 0.45 },
    ),
  )
  return out
}

const CABLE_Z = TOP + 1.5
const CABLE_R = 1.5
const CABLE_BEND = 5
const CABLES = {
  users: [
    [-200, 54],
    [-200, 74],
    [-130, 74],
    [-130, 54],
  ],
  serverA: [
    [-76, -6],
    [0, -6],
    [0, -22],
  ],
  serverB: [
    [-76, 4],
    [8, 4],
    [8, 20],
  ],
  cacheA: [
    [44, -22],
    [44, -4],
    [86, -4],
  ],
  cacheB: [
    [52, 20],
    [52, 4],
    [86, 4],
  ],
  database: [
    [150, 18],
    [150, 36],
    [200, 36],
    [200, 14],
  ],
}
const LEAD = [
  [-240, 56, CABLE_Z],
  [-240, 96, CABLE_Z],
  [-240, 96, BOTTOM - 16],
]

const centreline = (points) => G.fillet(points, CABLE_BEND, 7, { P, tube: CABLE_R })

function cables(t) {
  const routes = [
    ...Object.values(CABLES).map((route) => route.map(([x, y]) => [x, y, CABLE_Z])),
    LEAD,
  ]
  return routes.map((points) => t.tube(points, CABLE_R, { tone: 'mid', bend: CABLE_BEND }))
}

const LOOP = 3.6
const START = 2.3
const TRIPS = [
  ['users', 'serverA', 'cacheA', 'database'],
  ['users', 'serverB', 'cacheB', 'database'],
]
const WINDOWS = [
  [0, 0.55],
  [0.75, 1.5],
  [1.7, 2.35],
  [2.55, 3.15],
]

function packet(route, [from, to], begin) {
  const path = centreline(route.map(([x, y]) => [x, y, CABLE_Z]))
    .map((point, i) => {
      const [px, py] = k.iso(point, P)
      return `${i ? 'L' : 'M'}${px.toFixed(2)} ${py.toFixed(2)}`
    })
    .join('')
  const a = (from / LOOP).toFixed(4)
  const b = (to / LOOP).toFixed(4)
  const fadeIn = ((from + 0.06) / LOOP).toFixed(4)
  const fadeOut = ((to - 0.06) / LOOP).toFixed(4)
  const timing = `dur="${LOOP}s" begin="${begin}s" repeatCount="indefinite"`
  return `<g opacity="0"><animate attributeName="opacity" ${timing} keyTimes="0;${a};${fadeIn};${fadeOut};${b};1" values="0;0;1;1;0;0"/><animateMotion ${timing} path="${path}" calcMode="linear" keyPoints="0;0;1;1" keyTimes="0;${a};${b};1"/><circle r="5" fill="var(--anatomy-lit)" opacity=".16"/><circle r="2.2" fill="var(--anatomy-lit)"/></g>`
}

function packets() {
  const out = Object.entries(CABLES).flatMap(([name, route]) =>
    [0, 1, 2, 3].map((n) => {
      const i = TRIPS[n % 2].indexOf(name)
      return i < 0 ? '' : packet(route, WINDOWS[i], START + (n * LOOP) / 4)
    }),
  )
  return `<g class="packets">${out.join('')}</g>`
}

const BURST = 'cubic-bezier(.23,1,.32,1)'
const SETTLE = 'cubic-bezier(.77,0,.175,1)'
const ASSEMBLY = `<style>
.iso :is(.slam,.drop){transform-box:fill-box;transform-origin:center}
.iso .slam{--rise:-10px;animation:iso-pop 480ms both}
.iso .drop{--rise:-6px;animation:iso-pop 360ms both}
.iso .pin{animation:iso-fade 300ms ease both}
.iso .ray{fill:none;stroke:var(--anatomy-lit);stroke-width:1.6;stroke-linecap:round;stroke-dasharray:.5 2;animation:iso-ray 360ms ${BURST} both}
@keyframes iso-pop{
  0%{opacity:0;transform:translateY(0) rotate(var(--tilt)) scale(.3);animation-timing-function:${BURST}}
  45%{opacity:1;transform:translateY(var(--rise)) rotate(calc(var(--tilt) * .5)) scale(1.1);animation-timing-function:${SETTLE}}
  100%{transform:none}}
@keyframes iso-ray{
  0%{opacity:0;stroke-dashoffset:.5}
  10%{opacity:1}
  70%{opacity:1}
  100%{opacity:0;stroke-dashoffset:-1}}
@keyframes iso-fade{from{opacity:0}}
@media (prefers-reduced-motion:reduce){
  .iso :is(.slam,.drop){animation:iso-fade 300ms ease both}
  .iso :is(.packets,.ray){display:none}}
</style>`

let seed = 1
const random = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

const RAY_DELAY = 40
function pop(footprint, z, count, delay) {
  const points = k.boxCorners(footprint, z, z).map((corner) => k.iso(corner, P))
  const xs = points.map(([px]) => px)
  const ys = points.map(([, py]) => py)
  const [cx, cy] = [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ]
  const [rx, ry] = [(Math.max(...xs) - cx) * 0.9, (Math.max(...ys) - cy) * 0.9]
  const out = []
  for (let i = 0; i < count; i++) {
    const angle = ((i + 0.3 + random() * 0.4) / count) * Math.PI * 2
    const [cos, sin] = [Math.cos(angle), Math.sin(angle)]
    const [sx, sy] = [cx + cos * (rx + 4), cy + sin * (ry + 4)]
    const length = (i % 2 ? 9 : 16) + random() * 5
    out.push(
      `<path class="ray" pathLength="1" d="M${sx.toFixed(1)} ${sy.toFixed(1)}l${(cos * length).toFixed(1)} ${(sin * length).toFixed(1)}" style="animation-delay:${Math.round(delay + RAY_DELAY)}ms"/>`,
    )
  }
  return out.join('')
}

const FIRST_MACHINE = 300
const MACHINE_GAP = 170
const PLATE = 260
const PARTS = 420

const TILT = { slam: 5, drop: 9 }
const step = (kind, delay, inner) => {
  const tilt = TILT[kind]
    ? `--tilt:${((random() < 0.5 ? -1 : 1) * TILT[kind] * (0.6 + random() * 0.4)).toFixed(1)}deg;`
    : ''
  return `<g class="${kind}" style="${tilt}animation-delay:${Math.round(delay)}ms">${inner}</g>`
}

const dropAll = (parts, start) => {
  const gap = Math.min(28, PARTS / Math.max(parts.length, 1))
  return parts.map((part, index) => step('drop', start + index * gap, part)).join('')
}

function callout({ at: [x, y], top, tag, left = false }) {
  const [px, py] = k.iso([x, y, top], P)
  const up = py - (left ? 12 : 22)
  const ink = 'var(--callout,var(--anatomy-muted))'
  const text = left ? `x="${(px - 8).toFixed(1)}" text-anchor="end"` : `x="${(px + 8).toFixed(1)}"`
  return `<g class="callout"><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="1.1" style="fill:${ink}"/><path d="M${px.toFixed(1)} ${py.toFixed(1)}V${up.toFixed(1)}h${left ? -6 : 6}" style="fill:none;stroke:${ink};stroke-width:.5"/><text ${text} y="${(up + 2.2).toFixed(1)}" style="fill:${ink};font:500 6.2px var(--anatomy-mono);letter-spacing:.08em">${tag}</text></g>`
}

export function figure() {
  seed = 1
  const t = tools(P)
  const leftToRight = [...MODULES].sort((a, b) => a.at[0] - b.at[0])
  const start = (module) => FIRST_MACHINE + leftToRight.indexOf(module) * MACHINE_GAP
  const [users, lb, serverA, serverB, cache, database] = MODULES.map(start)
  const benchParts = bench(t)
  const body = [
    step('slam', 0, benchParts.slice(0, 14).join('')),
    dropAll(benchParts.slice(14), PLATE),
  ]
  const laid = [lb, serverA, serverB, cache, cache, database, users]
  body.push(...cables(t).map((cable, index) => step('pin', laid[index] + PLATE, cable)))
  body.push(packets())
  const machines = MODULES.map((module) => {
    const at = start(module)
    const [x, y] = module.at
    const [plate, ...parts] = module.draw(moved(module.at), { feet: false, lit: module.lit })
    return {
      depth: k.depthOf([x, y, 0], P),
      svg: `<g data-machine="${module.name}">${step('slam', at, plate)}${dropAll(parts, at + PLATE)}${step('pin', at + PLATE + PARTS + 60, callout(module))}</g>`,
    }
  })
  for (const { svg } of machines.sort((a, b) => a.depth - b.depth)) body.push(svg)
  const pops = [
    pop(BENCH, TOP, 16, 0),
    ...MODULES.map((module) =>
      pop({ x: module.at[0] - 46, y: module.at[1] - 40, w: 92, d: 80 }, 0, 10, start(module)),
    ),
  ]
  body.push(`<g class="pops">${pops.join('')}</g>`)
  return {
    width: WIDTH,
    height: HEIGHT,
    theme: 'dark',
    label:
      'A workbench of machines in a row: phone handsets send requests to a rotary load balancer, which feeds two rack servers; they read from a memory-stick cache and a disk-pack database, all joined by cables.',
    body: [ASSEMBLY, ...body],
  }
}
