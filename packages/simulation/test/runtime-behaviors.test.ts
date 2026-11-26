import { Result } from 'effect'
import { describe, expect, test } from 'vitest'
import * as Actions from '../src/actions.ts'
import { GATEWAY_PRICE, GPU_MODELS, LIVE_TUNING, type ResearchId } from '../src/catalog.ts'
import { preseedGame } from '../src/company.ts'
import { RUNNING } from '../src/life.ts'
import { gpuFits } from '../src/rules.ts'
import {
  badDeployChance,
  buildMinutesOf,
  coordinationOf,
  debtGrowthOf,
  effectiveEngineers,
  rampSeconds,
} from '../src/team.ts'
import { certExpired, logLoss } from '../src/lookups.ts'
import { evictionShareOf } from '../src/rules.ts'
import { solveFlow } from '../src/solve.ts'
import { step } from '../src/step.ts'
import { freeSandbox } from '../src/sandbox.ts'
import type { Game, GameNode } from '../src/state.ts'

const ok = (action: Actions.Action): Game => {
  if (Result.isFailure(action)) throw new Error(JSON.stringify(action.failure))
  return action.success
}

const withStack = (framework: GameNode['framework'], runtime: GameNode['runtime']): Game => {
  const game = freeSandbox()
  return {
    ...game,
    nodes: game.nodes.map((node) =>
      node.type === 'server' ? { ...node, runtime, framework } : node,
    ),
  }
}

describe('frameworks', () => {
  test('structure lowers coordination and debt growth, Elysia lowers debt growth, and Express raises it', () => {
    expect(coordinationOf(withStack('symfony', 'php_fpm'))).toBe(0.7)
    expect(coordinationOf(withStack('nestjs', 'node'))).toBe(0.7)
    expect(coordinationOf(withStack('spring-boot', 'tomcat'))).toBe(0.7)
    expect(coordinationOf(withStack('none', 'node'))).toBe(1)
    expect(debtGrowthOf(withStack('express', 'node'))).toBe(1.1)
    expect(debtGrowthOf(withStack('elysia', 'bun'))).toBe(0.85)
    expect(effectiveEngineers(20, 0.7)).toBeGreaterThan(effectiveEngineers(20, 1))
  })

  test('Quarkus halves what a native image adds to a build', () => {
    const plain = buildMinutesOf(withStack('none', 'graal'))
    const quarkus = buildMinutesOf(withStack('quarkus', 'graal'))
    expect(plain).toBe(buildMinutesOf(withStack('none', 'tomcat')) * 3)
    expect(quarkus).toBeLessThan(plain)
  })
})

describe('developer tools', () => {
  const base = freeSandbox()
  const without = (...ids: ReadonlyArray<ResearchId>): Game => ({
    ...base,
    researched: base.researched.filter((id) => !ids.includes(id)),
  })
  const withResearch = (game: Game, ...ids: ReadonlyArray<ResearchId>): Game => ({
    ...game,
    researched: [...game.researched, ...ids],
  })

  test('a shared build cache cuts every build', () => {
    expect(buildMinutesOf(without('build-cache'))).toBeGreaterThan(buildMinutesOf(base))
  })

  test('a reproducible dev environment halves the ramp', () => {
    expect(rampSeconds(without('dev-environment'))).toBeGreaterThan(rampSeconds(base))
  })

  test('static analysis and formal verification lower the bad-deploy chance', () => {
    const none = without('static-analysis', 'formal-verification')
    const staticOnly = withResearch(none, 'static-analysis')
    const formalOnly = withResearch(none, 'formal-verification')
    const both = withResearch(none, 'static-analysis', 'formal-verification')
    expect(badDeployChance(staticOnly)).toBeLessThan(badDeployChance(none))
    expect(badDeployChance(formalOnly)).toBeLessThan(badDeployChance(none))
    expect(badDeployChance(both)).toBeLessThan(badDeployChance(formalOnly))
  })

  test('formal verification slows feature work', () => {
    expect(solveFlow(without('formal-verification')).velocity).toBeGreaterThan(
      solveFlow(base).velocity,
    )
  })
})

describe('options', () => {
  test('Auth at the edge takes the token check off the services', () => {
    const game = freeSandbox()
    const server = game.nodes.find((node) => node.type === 'server') as GameNode
    const gateway = ok(Actions.place(game, 'gw', 100, 100))
    const id = gateway.nodes.at(-1)?.id as string
    const edged = ok(Actions.setGatewayOptions(gateway, id, { authEdge: true }))
    const readCost = (board: Game) => solveFlow(board).nodes[server.id]?.receipts.read?.total ?? 0
    expect(readCost(gateway)).toBeGreaterThan(0)
    expect(readCost(edged)).toBeLessThan(readCost(gateway))
  })

  test('periodic restarts need a persistent runtime', () => {
    const game = withStack('none', 'node')
    const server = game.nodes.find((node) => node.type === 'server') as GameNode
    expect(
      ok(Actions.setRecycle(game, server.id, true)).nodes.find((n) => n.id === server.id)?.recycle,
    ).toBe(true)
    const php = withStack('none', 'php_fpm')
    const fpm = php.nodes.find((node) => node.type === 'server') as GameNode
    expect(Result.isFailure(Actions.setRecycle(php, fpm.id, true))).toBe(true)
  })

  test('a model that does not fit in the GPU fails, and a smaller precision fits it', () => {
    const placed = ok(Actions.place(freeSandbox(), 'gpu', 100, 100))
    const id = placed.nodes.at(-1)?.id as string
    const large = ok(Actions.setGpuModel(placed, id, 'large'))
    const node = large.nodes.find((entry) => entry.id === id) as GameNode
    expect(GPU_MODELS.large.gb).toBeGreaterThan(16)
    expect(gpuFits(node)).toBe(false)
    expect(gpuFits({ ...node, gpu: 'a100' })).toBe(true)
  })

  test('a broker with one replica loses everything, and acks=all with replicas loses nothing', () => {
    const placed = ok(Actions.place(freeSandbox(), 'log', 100, 100))
    const node = placed.nodes.at(-1) as GameNode
    expect(logLoss({ ...node, n: 1 })).toBe(1)
    expect(logLoss({ ...node, n: 3, acks: 'all' })).toBe(0)
    expect(logLoss({ ...node, n: 3, acks: '1' })).toBeGreaterThan(0)
  })
})

describe('certificates, evictions and boxes', () => {
  test('a manager issues a certificate to each Node that terminates TLS, and none renews without it', () => {
    let game = { ...freeSandbox(), sandbox: false, stage: 2, cash: 1e9 }
    game = ok(Actions.place(game, 'lb', 100, 100))
    game = ok(Actions.place(game, 'pki', 100, 400))
    game = step(game, 1).game
    const lb = game.nodes.find((node) => node.type === 'lb') as GameNode
    expect(lb.certUntil).not.toBeNull()
    expect(game.nodes.find((node) => node.type === 'pki')?.certUntil).toBeNull()
    const expired = { ...game, time: (lb.certUntil ?? 0) + 1 }
    expect(certExpired(expired, lb)).toBe(true)
  })

  test('a Cache the hot data does not fit evicts, and one that fits does not', () => {
    const game = { ...freeSandbox(), users: 5_000_000 }
    const placed = ok(Actions.place(game, 'cache', 100, 100))
    const cache = placed.nodes.find((node) => node.type === 'cache') as GameNode
    expect(evictionShareOf(placed, cache)).toBeGreaterThan(0)
    expect(evictionShareOf({ ...placed, users: 10 }, cache)).toBe(0)
    expect(solveFlow(placed).nodes[cache.id]?.evictions).not.toBeNull()
  })

  test('boxing two Nodes draws one box, and unboxing keeps the Nodes', () => {
    const base = ok(Actions.place(freeSandbox(), 'lb', 100, 100))
    const game = ok(Actions.place(base, 'dns', 100, 400))
    const ids = game.nodes.slice(-2).map((node) => node.id)
    const boxed = ok(Actions.boxNodes(game, ids))
    expect(boxed.boxes).toHaveLength(1)
    expect(boxed.boxes[0]?.name).toBe('Edge')
    const loose = ok(Actions.unboxNodes(boxed, ids))
    expect(loose.boxes).toHaveLength(0)
    expect(loose.nodes).toHaveLength(game.nodes.length)
    expect(Result.isFailure(Actions.boxNodes(game, ids.slice(0, 1)))).toBe(true)
  })

  test('a mixed box keeps its number', () => {
    const game = ok(Actions.place(freeSandbox(), 'lb', 100, 100))
    const server = game.nodes.find((node) => node.type === 'server') as GameNode
    const lb = game.nodes.find((node) => node.type === 'lb') as GameNode
    const boxed = ok(Actions.boxNodes(game, [server.id, lb.id]))
    expect(boxed.boxes[0]?.name).toBe('Box 1')
  })
})

describe('routing and the Gateway fee', () => {
  const routed = (): Readonly<{ game: Game; gateway: string; login: string }> => {
    let game: Game = { ...freeSandbox(), stage: 1, seed: 3 }
    const first = game.nodes.find((node) => node.type === 'server') as GameNode
    game = ok(Actions.place(game, 'gw', 200, 280))
    const gateway = game.nodes.at(-1)?.id as string
    game = Actions.disconnect(game, 'users', first.id)
    game = ok(Actions.connect(game, 'users', gateway))
    game = ok(Actions.connect(game, gateway, first.id))
    game = ok(Actions.place(game, 'server', 440, 120))
    const login = game.nodes.at(-1)?.id as string
    const database = game.nodes.find((node) => node.type === 'database') as GameNode
    game = ok(Actions.connect(game, gateway, login))
    game = ok(Actions.connect(game, login, database.id))
    return { game, gateway, login }
  }

  test('an API Gateway routes each request kind on the Links that carry it', () => {
    const { game, gateway, login } = routed()
    const server = game.nodes.find(
      (node) => node.type === 'server' && node.id !== login,
    ) as GameNode
    const at = ok(Actions.setLinkKinds(game, gateway, login, ['login']))
    const parted = ok(Actions.setLinkKinds(at, gateway, server.id, ['page', 'read', 'write']))
    const ledger = solveFlow(parted)
    expect(ledger.nodes[login]?.traffic.login ?? 0).toBeGreaterThan(0)
    expect(ledger.nodes[login]?.traffic.page ?? 0).toBe(0)
    expect(ledger.nodes[server.id]?.traffic.login ?? 0).toBe(0)
    expect(ledger.nodes[server.id]?.traffic.page ?? 0).toBeGreaterThan(0)
  })

  test('only an API Gateway routes by request kind', () => {
    const { game, login } = routed()
    const placed = ok(Actions.place(game, 'lb', 200, 520))
    const loadBalancer = placed.nodes.find((node) => node.type === 'lb') as GameNode
    const linked = ok(Actions.connect(placed, loadBalancer.id, login))
    const refused = Actions.setLinkKinds(linked, loadBalancer.id, login, ['page'])
    expect(Result.isFailure(refused)).toBe(true)
    if (Result.isFailure(refused))
      expect(Actions.describeRefusal(refused.failure)).toBe(
        'Only an API Gateway routes by request kind.',
      )
  })

  test('a Gateway bills each request at its own price, without the Era cost index', () => {
    const { game, gateway } = routed()
    const ledger = solveFlow(game)
    const inbound = ledger.nodes[gateway]?.inbound ?? 0
    expect(inbound).toBeGreaterThan(0)
    expect(ledger.burnLines.requests).toBeCloseTo(inbound * GATEWAY_PRICE, 6)
  })
})

describe('load-driven server memory', () => {
  const quiet = { ...LIVE_TUNING, firstIncidentAfter: 1e12, incidentGap: 1e12 }
  const serverGame = (users: number, patch: Partial<GameNode>): Game => {
    const game = freeSandbox()
    return {
      ...game,
      stage: 3,
      users,
      nodes: game.nodes.map((node) =>
        node.type === 'server'
          ? { ...node, size: 3, ...patch }
          : node.type === 'database'
            ? { ...node, size: 8 }
            : node,
      ),
    }
  }
  const serverOf = (game: Game) => solveFlow(game).nodes.server!
  const ramShare = (game: Game): number => {
    const { used, total } = serverOf(game).resources.ramGb!
    return used / total
  }
  const usersAt = (utilization: number, patch: Partial<GameNode>): number => {
    let low = 1
    let high = 1e9
    for (let index = 0; index < 50; index += 1) {
      const middle = Math.sqrt(low * high)
      if (serverOf(serverGame(middle, patch)).utilization < utilization) low = middle
      else high = middle
    }
    return low
  }

  test('a persistent runtime holds RAM for each active User, and a shared-nothing one does not', () => {
    const go = { runtime: 'go' } as const
    expect(ramShare(serverGame(20_000, go))).toBeGreaterThan(ramShare(serverGame(5_000, go)) * 1.5)
    const php = { runtime: 'php_fpm' } as const
    expect(ramShare(serverGame(20_000, php))).toBeCloseTo(ramShare(serverGame(5_000, php)), 9)
  })

  test('GOGC trades CPU for RAM: 50 costs capacity, 200 costs memory', () => {
    const users = usersAt(0.8, { runtime: 'go', family: 'compute' })
    const at = (gogc: number) => serverGame(users, { runtime: 'go', family: 'compute', gogc })
    expect(serverOf(at(50)).utilization).toBeGreaterThan(serverOf(at(100)).utilization)
    expect(serverOf(at(100)).utilization).toBeGreaterThan(serverOf(at(200)).utilization)
    expect(ramShare(at(50))).toBeLessThan(ramShare(at(100)))
    expect(ramShare(at(100))).toBeLessThan(ramShare(at(200)))
  })

  test('a JVM that fits on General swaps on Compute, and Memory leaves room', () => {
    const users = usersAt(0.85, { runtime: 'tomcat' })
    const on = (family: GameNode['family']) =>
      serverOf(serverGame(users, { runtime: 'tomcat', family }))
    expect(on('general').swapping).toBe(false)
    expect(on('compute').swapping).toBe(true)
    expect(on('memory').utilization).toBeLessThanOrEqual(on('general').utilization)
  })

  test('shedding leaves a Node under saturation alone and keeps revenue past it', () => {
    const revenue = (users: number, shed: boolean) =>
      solveFlow(serverGame(users, { runtime: 'go', shed })).revenue
    const calm = usersAt(0.95, { runtime: 'go' })
    const overloaded = usersAt(1.5, { runtime: 'go' })
    expect(revenue(calm, true)).toBeCloseTo(revenue(calm, false), 9)
    expect(revenue(overloaded, true)).toBeGreaterThan(revenue(overloaded, false) * 1.3)
  })

  test('a Node leaks with the requests it serves until it recycles', () => {
    const run = (users: number, recycle: boolean): number => {
      let game: Game = {
        ...preseedGame(),
        stage: 3,
        users,
        cash: 1e9,
        nodes: preseedGame().nodes.map((node) =>
          node.type === 'server' ? { ...node, runtime: 'go', size: 3, recycle } : node,
        ),
      }
      for (let second = 0; second < 600; second += 30) game = step(game, 30, quiet).game
      return game.nodes.find((node) => node.type === 'server')!.leak
    }
    expect(run(4_000, false)).toBeGreaterThan(0)
    expect(run(8_000, false)).toBeGreaterThan(run(4_000, false) * 1.5)
    expect(run(8_000, true)).toBe(0)
  })
})

describe('Database load', () => {
  const databaseGame = (users: number, patch: Partial<GameNode>): Game => {
    const game = freeSandbox()
    return {
      ...game,
      stage: 4,
      users,
      nodes: game.nodes.map((node) =>
        node.type === 'database'
          ? { ...node, size: 7, ...patch }
          : node.type === 'server'
            ? { ...node, runtime: 'tokio', size: 8 }
            : node,
      ),
    }
  }
  const apdex = (users: number, patch: Partial<GameNode>) =>
    solveFlow(databaseGame(users, patch)).apdex

  test('Provisioned IOPS only pays once the disk is the limit', () => {
    expect(apdex(10_000, { iops: 'provisioned' })).toBeCloseTo(apdex(10_000, {}), 2)
    expect(apdex(100_000, { iops: 'provisioned' })).toBeGreaterThan(apdex(100_000, {}) + 0.2)
  })

  test('archiving old rows shrinks the hot set so the working set fits in RAM again', () => {
    const spilled = { size: 3 } as const
    const users = 11_000
    expect(solveFlow(databaseGame(users, spilled)).nodes.database!.disk).toBe(true)
    expect(
      solveFlow(databaseGame(users, { ...spilled, keep: 'archive' })).nodes.database!.disk,
    ).toBe(false)
  })
})

describe('Load Balancer policies', () => {
  const balanced = (policy: GameNode['policy']) => {
    let game = freeSandbox()
    const lb = ok(Actions.place(game, 'lb', 300, 280))
    const lbId = lb.nodes.at(-1)!.id
    const second = ok(Actions.place(lb, 'server', 600, 560))
    const secondId = second.nodes.at(-1)!.id
    const fitted = ok(
      Actions.installRam(ok(Actions.installCpu(second, secondId, 1)), secondId, 'general'),
    )
    game = ok(Actions.connect(Actions.disconnect(fitted, 'users', 'server'), 'users', lbId))
    game = ok(Actions.connect(ok(Actions.connect(game, lbId, 'server')), lbId, secondId))
    game = ok(Actions.connect(game, secondId, 'database'))
    game = {
      ...game,
      users: 20_000,
      nodes: game.nodes.map((node) =>
        node.id === lbId
          ? { ...node, policy, warm: 1 }
          : node.id === secondId
            ? { ...node, warm: 1, family: 'burstable', credits: 0, life: RUNNING }
            : node.type === 'database'
              ? { ...node, size: 8 }
              : node,
      ),
    }
    const ledger = solveFlow(game)
    return {
      split: [ledger.nodes.server!.inbound, ledger.nodes[secondId]!.inbound],
      reads: ledger.nodes.database!.traffic['q-read']!,
    }
  }
  const share = ({ split: [first, second] }: ReturnType<typeof balanced>) =>
    first! / (first! + second!)

  test('two choices and consistent hash route differently from weighted once researched', () => {
    const weighted = share(balanced('weighted'))
    expect(share(balanced('hash'))).toBeCloseTo(0.5, 6)
    expect(share(balanced('p2c'))).toBeGreaterThan(0.5)
    expect(share(balanced('p2c'))).toBeLessThan(weighted)
  })

  test('consistent hash keeps each key on one server, so the Database gets fewer reads', () => {
    expect(balanced('hash').reads).toBeLessThan(balanced('round-robin').reads * 0.9)
  })
})

describe('Cache working set', () => {
  const evicting = (users: number, size: number): number => {
    let game = freeSandbox()
    const placed = ok(Actions.place(game, 'cache', 600, 280))
    const id = placed.nodes.at(-1)!.id
    game = ok(Actions.connect(Actions.disconnect(placed, 'server', 'database'), 'server', id))
    game = ok(Actions.connect(game, id, 'database'))
    return evictionShareOf(
      { ...game, users },
      { ...game.nodes.find((node) => node.id === id)!, size },
    )
  }

  test('the hot set grows slower than the Users, so a bigger Cache keeps up with growth', () => {
    expect(evicting(500_000, 6)).toBe(0)
    expect(evicting(20_000_000, 8)).toBe(0)
    expect(evicting(20_000_000, 6)).toBeGreaterThan(0.5)
  })
})

describe('ARM instances', () => {
  const utilization = (id: string, patch: Partial<GameNode>): number => {
    const game = freeSandbox()
    return solveFlow({
      ...game,
      stage: 3,
      users: 6_000,
      nodes: game.nodes.map((node) =>
        node.id === id
          ? { ...node, size: 3, ...patch }
          : node.type === 'server'
            ? { ...node, runtime: 'go', size: 8 }
            : { ...node, size: 8 },
      ),
    }).nodes[id]!.utilization
  }

  test('a Database on ARM matches General capacity', () => {
    expect(utilization('database', { family: 'arm' })).toBeCloseTo(
      utilization('database', { family: 'general' }),
      9,
    )
  })

  test('ARM costs a PHP server more capacity than a Go one', () => {
    const loss = (runtime: GameNode['runtime']) =>
      utilization('server', { runtime, family: 'arm' }) /
      utilization('server', { runtime, family: 'general' })
    expect(loss('php_fpm')).toBeGreaterThan(loss('go'))
  })
})

describe('GPU serving options', () => {
  const load = (precision: GameNode['precision'], batch: GameNode['batch']): number => {
    const game = freeSandbox()
    const placed = ok(Actions.place(game, 'gpu', 600, 560))
    const id = placed.nodes.at(-1)!.id
    const linked = ok(Actions.connect(placed, 'server', id))
    return solveFlow({
      ...linked,
      stage: 4,
      users: 10_000,
      scenario: { mix: { page: 0.5, read: 0.3, ai: 0.2 } },
      nodes: linked.nodes.map((node) =>
        node.id === id
          ? { ...node, size: 5, gpu: 'h100', precision, batch, warm: 1 }
          : node.type === 'server'
            ? { ...node, runtime: 'tokio', size: 7 }
            : node.type === 'database'
              ? { ...node, size: 8 }
              : node,
      ),
    }).nodes[id]!.utilization
  }

  test('INT4 serves most one request at a time, and INT8 wins once requests are batched', () => {
    expect(load('int4', 1)).toBeLessThan(load('int8', 1))
    expect(load('int8', 32)).toBeLessThan(load('int4', 32))
    expect(load('int8', 1)).toBeLessThan(load('fp16', 1))
  })
})

describe('Worker concurrency', () => {
  const worker = (concurrency: number) => {
    const game = freeSandbox()
    const queue = ok(Actions.place(game, 'queue', 400, 100))
    const queueId = queue.nodes.at(-1)!.id
    const placed = ok(
      Actions.place(ok(Actions.connect(queue, 'server', queueId)), 'worker', 600, 100),
    )
    const workerId = placed.nodes.at(-1)!.id
    const wired = ok(
      Actions.connect(ok(Actions.connect(placed, queueId, workerId)), workerId, 'database'),
    )
    return solveFlow({
      ...wired,
      stage: 4,
      users: 10_000,
      scenario: { mix: { page: 0.2, read: 0.2, job: 0.6 } },
      nodes: wired.nodes.map((node) =>
        node.id === workerId
          ? {
              ...node,
              runtime: 'go',
              size: 1,
              family: 'compute',
              concurrency,
              replicas: 1,
              warm: 1,
            }
          : node.id === queueId
            ? { ...node, depth: 1_000_000, warm: 1 }
            : node,
      ),
    }).nodes[workerId]!
  }

  test('concurrency caps how many tasks one copy runs at once', () => {
    const low = worker(1)
    const high = worker(50)
    expect(low.resources.slots?.total).toBe(1)
    expect(high.resources.slots?.total).toBe(50)
    expect(low.capacity).toBeLessThan(high.capacity)
    expect(low.limit).toBe('workers')
  })

  test('each in-flight task holds RAM, so a deep concurrency crowds a small Worker', () => {
    const share = (concurrency: number): number => {
      const { used, total } = worker(concurrency).resources.ramGb!
      return used / total
    }
    expect(share(100)).toBeGreaterThan(share(10) * 3)
    expect(share(10)).toBeGreaterThan(share(1))
  })
})

describe('Cache engines', () => {
  const capacity = (engine: GameNode['engine'], size: number): number => {
    const game = freeSandbox()
    const placed = ok(Actions.place(game, 'cache', 600, 280))
    const id = placed.nodes.at(-1)!.id
    const linked = ok(
      Actions.connect(
        ok(Actions.connect(Actions.disconnect(placed, 'server', 'database'), 'server', id)),
        id,
        'database',
      ),
    )
    return solveFlow({
      ...linked,
      stage: 4,
      users: 20_000,
      nodes: linked.nodes.map((node) =>
        node.id === id ? { ...node, engine, size, warm: 1 } : node,
      ),
    }).nodes[id]!.capacity
  }

  test('Memcached is a fifth faster at one core and pulls ahead as it gains threads, but Redis scales too', () => {
    expect(capacity('memcached', 3) / capacity('redis', 3)).toBeCloseTo(1.2, 5)
    expect(capacity('memcached', 6) / capacity('redis', 6)).toBeGreaterThan(1.5)
    expect(capacity('redis', 6)).toBeGreaterThan(capacity('redis', 3))
  })
})

describe('Redis keeps what Memcached gives up', () => {
  const cacheGame = (): Readonly<{ game: Game; id: string }> => {
    const placed = ok(Actions.place(freeSandbox(), 'cache', 600, 280))
    return { game: placed, id: placed.nodes.at(-1)!.id }
  }

  test('Memcached refuses write-behind and a standby, and Redis takes both', () => {
    const { game, id } = cacheGame()
    const memcached = ok(Actions.setCacheEngine(game, id, 'memcached'))
    expect(Result.isFailure(Actions.setCacheStrategy(memcached, id, 'write-behind'))).toBe(true)
    expect(Result.isFailure(Actions.setStandby(memcached, id, true))).toBe(true)
    ok(Actions.setCacheStrategy(game, id, 'write-behind'))
    ok(Actions.setStandby(game, id, true))
  })

  test('a Cache with write-behind or a standby cannot switch to Memcached', () => {
    const { game, id } = cacheGame()
    expect(
      Result.isFailure(
        Actions.setCacheEngine(
          ok(Actions.setCacheStrategy(game, id, 'write-behind')),
          id,
          'memcached',
        ),
      ),
    ).toBe(true)
    expect(
      Result.isFailure(
        Actions.setCacheEngine(ok(Actions.setStandby(game, id, true)), id, 'memcached'),
      ),
    ).toBe(true)
  })

  test('Memcached holds more of the hot set in the same RAM', () => {
    const { game, id } = cacheGame()
    const node = game.nodes.find((entry) => entry.id === id)!
    const big = { ...game, users: 200_000 }
    expect(evictionShareOf(big, { ...node, engine: 'memcached', size: 3 })).toBeLessThan(
      evictionShareOf(big, { ...node, engine: 'redis', size: 3 }),
    )
  })
})

describe('Porting to ARM', () => {
  const server = (runtime: GameNode['runtime'], devHours: number, sandbox = false): Game => {
    const game = preseedGame()
    return {
      ...game,
      sandbox,
      devHours,
      researched: [...game.researched, 'arm-instances'],
      nodes: game.nodes.map((node) => (node.type === 'server' ? { ...node, runtime } : node)),
    }
  }

  test('the first move to ARM spends Dev Hours by language, and a dearer port is refused when short', () => {
    const go = ok(Actions.setFamily(server('go', 100), 'server', 'arm'))
    const php = ok(Actions.setFamily(server('php_fpm', 100), 'server', 'arm'))
    expect(100 - go.devHours).toBe(4)
    expect(100 - php.devHours).toBe(16)
    expect(Result.isFailure(Actions.setFamily(server('php_fpm', 10), 'server', 'arm'))).toBe(true)
    expect(Result.isSuccess(Actions.setFamily(server('go', 10), 'server', 'arm'))).toBe(true)
  })

  test('a guided Sandbox ports for free', () => {
    const moved = ok(Actions.setFamily(server('php_fpm', 0, true), 'server', 'arm'))
    expect(moved.devHours).toBe(0)
  })
})
