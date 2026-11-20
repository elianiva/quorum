type Layer =
  | Readonly<{
      kind: 'modes'
      at: number
      partials: ReadonlyArray<number>
      amplitudes: ReadonlyArray<number>
      damping: number
    }>
  | Readonly<{
      kind: 'noise'
      at: number
      attack: number
      decay: number
      gain: number
      filter: BiquadFilterType
      frequency: number
      to: number
      q: number
    }>
  | Readonly<{
      kind: 'tone'
      at: number
      wave: OscillatorType
      frequency: number
      to: number
      attack: number
      hold: number
      decay: number
      gain: number
      cutoff: number
    }>

const SHAPE = {
  bar: [1, 2.78, 5.44, 9, 13.44],
  plate: [1, 1.59, 2.14, 2.3, 2.65, 2.92, 3.5],
  string: [1, 2, 3, 4, 5, 6],
} as const

const MATERIAL = { steel: 0.0015, iron: 0.02, plastic: 0.06, rubber: 0.25 } as const

type Impact = Readonly<{
  at?: number
  size: number
  shape: keyof typeof SHAPE
  material: keyof typeof MATERIAL
  hardness: number
  gain: number
}>

const impact = ({ at = 0, size, shape, material, hardness, gain }: Impact): Array<Layer> => {
  const partials = SHAPE[shape].map((ratio) => size * ratio)
  const slope = -(1 - hardness) * 0.0006
  const raw = partials.map((frequency) => Math.max(0, 1 + slope * (frequency - size)))
  const total = raw.reduce((sum, value) => sum + value, 0)
  return [
    {
      kind: 'modes',
      at,
      partials,
      amplitudes: raw.map((value) => (value / total) * gain),
      damping: MATERIAL[material],
    },
    {
      kind: 'noise',
      at,
      attack: 0.5,
      decay: 4 + 6 * (1 - hardness),
      gain: gain * 0.5 * hardness,
      filter: 'bandpass',
      frequency: 1500 + 6000 * hardness,
      to: 1500 + 6000 * hardness,
      q: 0.8,
    },
  ]
}

const ratchet = (object: Impact, length: number, from: number, to: number): Array<Layer> => {
  const layers: Array<Layer> = []
  for (let time = 0; time < length;) {
    layers.push(...impact({ ...object, at: (object.at ?? 0) + time }))
    time += 1000 / (from + ((to - from) * time) / length)
  }
  return layers
}

const hiss = (
  at: number,
  from: number,
  to: number,
  attack: number,
  decay: number,
  gain: number,
): Layer => ({
  kind: 'noise',
  at,
  attack,
  decay,
  gain,
  filter: 'bandpass',
  frequency: from,
  to,
  q: 1.2,
})

const motor = (at: number, from: number, to: number, length: number, gain: number): Layer => ({
  kind: 'tone',
  at,
  wave: 'sawtooth',
  frequency: from,
  to,
  attack: 10,
  hold: length - 40,
  decay: 30,
  gain,
  cutoff: 900,
})

const thump = (at: number, from: number, to: number, length: number, gain: number): Layer => ({
  kind: 'tone',
  at,
  wave: 'sine',
  frequency: from,
  to,
  attack: 1,
  hold: 0,
  decay: length,
  gain,
  cutoff: 1000,
})

const beep = (at: number, frequency: number, length: number, gain: number, onset = 4): Layer => ({
  kind: 'tone',
  at,
  wave: 'square',
  frequency,
  to: frequency,
  attack: onset,
  hold: length,
  decay: 12,
  gain,
  cutoff: 3200,
})

const TIER = { control: 0.18, gesture: 0.445, notice: 0.978, hero: 0.945 } as const

type Spec = Readonly<{
  tier: keyof typeof TIER
  vary: number
  room: number
  trim: number
  drive: number
  layers: ReadonlyArray<Layer>
}>

const control = (trim: number, layers: ReadonlyArray<Layer>): Spec => ({
  tier: 'control',
  vary: 0.05,
  room: 0.08,
  trim,
  drive: 1,
  layers,
})
const gesture = (trim: number, layers: ReadonlyArray<Layer>): Spec => ({
  tier: 'gesture',
  vary: 0.04,
  room: 0.18,
  trim,
  drive: 1.5,
  layers,
})
const notice = (trim: number, layers: ReadonlyArray<Layer>): Spec => ({
  tier: 'notice',
  vary: 0,
  room: 0.12,
  trim,
  drive: 0,
  layers,
})
const hero = (trim: number, layers: ReadonlyArray<Layer>): Spec => ({
  tier: 'hero',
  vary: 0,
  room: 0.35,
  trim,
  drive: 2,
  layers,
})

const key = (at: number, size: number, gain: number) =>
  impact({ at, size, shape: 'bar', material: 'plastic', hardness: 0.8, gain })
const latch = (at: number, size: number, gain: number) =>
  impact({ at, size, shape: 'plate', material: 'iron', hardness: 0.9, gain })

const SOUNDS = {
  clockin: hero(2.5, [
    hiss(0, 2600, 1800, 60, 150, 0.12),
    ...latch(270, 1500, 0.7),
    thump(270, 150, 55, 180, 0.9),
    ...impact({
      at: 272,
      size: 160,
      shape: 'plate',
      material: 'plastic',
      hardness: 0.4,
      gain: 0.6,
    }),
    beep(380, 1200, 60, 0.18),
    beep(480, 1200, 90, 0.18),
  ]),
  burst: gesture(6.5, [
    thump(0, 130, 40, 260, 1.4),
    ...impact({ size: 120, shape: 'plate', material: 'plastic', hardness: 0.5, gain: 1 }),
    ...impact({ size: 1100, shape: 'bar', material: 'iron', hardness: 0.9, gain: 0.25 }),
  ]),
  pop: control(1, [...key(0, 1800, 0.6), thump(0, 240, 120, 50, 0.3)]),
  hover: control(
    3.5,
    impact({ size: 4200, shape: 'bar', material: 'plastic', hardness: 0.3, gain: 0.25 }),
  ),
  choose: control(5, [...key(0, 1400, 0.8), thump(0, 200, 90, 80, 0.5), beep(20, 1320, 50, 0.3)]),

  tick: control(0, [...key(0, 2400, 0.7), thump(0, 260, 140, 35, 0.25)]),
  toggle: control(1, [
    ...latch(0, 1800, 0.6),
    thump(0, 210, 100, 70, 0.45),
    ...impact({ size: 900, shape: 'bar', material: 'plastic', hardness: 0.5, gain: 0.5 }),
    ...latch(28, 2300, 0.35),
  ]),
  open: control(1, [
    hiss(0, 5000, 2000, 10, 140, 0.6),
    ...latch(70, 1400, 0.45),
    thump(70, 170, 65, 130, 1),
  ]),
  close: control(0.5, [
    ...latch(0, 1200, 0.55),
    thump(0, 160, 60, 130, 1),
    hiss(5, 2500, 4500, 2, 110, 0.4),
  ]),
  switch: control(0, [...key(0, 2000, 0.6), thump(0, 240, 130, 40, 0.3), ...key(16, 2600, 0.3)]),
  pick: control(1, [
    ...ratchet(
      { size: 2200, shape: 'bar', material: 'plastic', hardness: 0.6, gain: 0.25 },
      50,
      90,
      140,
    ),
    ...latch(55, 1600, 0.55),
    thump(55, 190, 70, 120, 1),
  ]),

  lift: gesture(6, [motor(0, 140, 260, 70, 0.22), ...key(0, 1900, 0.25)]),
  detent: control(-1, [...key(0, 3200, 0.3), thump(0, 300, 180, 25, 0.15)]),
  drop: gesture(1.5, [
    thump(0, 150, 55, 140, 1),
    ...impact({ size: 180, shape: 'plate', material: 'rubber', hardness: 0.3, gain: 0.9 }),
    ...key(0, 1500, 0.3),
  ]),
  pull: gesture(0, [
    hiss(0, 3000, 2400, 3, 30, 0.25),
    ...impact({ at: 25, size: 700, shape: 'bar', material: 'plastic', hardness: 0.4, gain: 0.5 }),
    thump(25, 180, 90, 70, 0.4),
  ]),
  snap: gesture(0.5, [
    ...impact({ size: 2600, shape: 'bar', material: 'iron', hardness: 0.9, gain: 0.45 }),
    thump(0, 220, 90, 90, 0.7),
    ...key(14, 1700, 0.4),
  ]),
  release: gesture(-0.5, [
    hiss(0, 1800, 900, 5, 80, 0.3),
    ...key(80, 1200, 0.45),
    thump(80, 200, 90, 70, 0.5),
  ]),
  place: gesture(5.5, [
    hiss(0, 1500, 4500, 18, 6, 0.2),
    thump(20, 130, 42, 260, 1.6),
    ...impact({ at: 20, size: 95, shape: 'plate', material: 'plastic', hardness: 0.3, gain: 2.5 }),
    ...impact({ at: 20, size: 620, shape: 'plate', material: 'steel', hardness: 0.9, gain: 0.06 }),
    ...latch(28, 1900, 0.35),
  ]),
  remove: gesture(3, [
    ...latch(0, 1400, 0.45),
    thump(0, 170, 60, 140, 0.7),
    motor(10, 300, 70, 220, 0.25),
  ]),
  connect: gesture(2, [
    ...impact({ size: 2600, shape: 'bar', material: 'iron', hardness: 0.9, gain: 0.45 }),
    ...impact({ size: 180, shape: 'plate', material: 'plastic', hardness: 0.5, gain: 0.4 }),
    thump(0, 200, 75, 120, 0.8),
    beep(45, 1480, 25, 0.12),
    beep(85, 1480, 25, 0.12),
  ]),
  cut: gesture(1, [
    hiss(0, 7000, 4000, 1, 70, 0.45),
    ...impact({ size: 2900, shape: 'bar', material: 'steel', hardness: 1, gain: 0.1 }),
    ...key(0, 1300, 0.4),
    thump(0, 220, 80, 110, 0.9),
  ]),
  upgrade: gesture(5, [
    motor(0, 70, 220, 220, 0.25),
    ...ratchet(
      { size: 1600, shape: 'bar', material: 'plastic', hardness: 0.6, gain: 0.18 },
      220,
      20,
      60,
    ),
    thump(220, 160, 70, 120, 0.6),
    beep(240, 880, 40, 0.14),
    beep(300, 1320, 60, 0.14),
  ]),
  downgrade: gesture(5.5, [
    motor(0, 220, 70, 220, 0.25),
    ...ratchet(
      { size: 1600, shape: 'bar', material: 'plastic', hardness: 0.6, gain: 0.18 },
      220,
      60,
      20,
    ),
    thump(220, 160, 70, 120, 0.6),
    beep(240, 1320, 40, 0.14),
    beep(300, 880, 60, 0.14),
  ]),
  reboot: gesture(3.5, [
    ...latch(0, 1400, 0.45),
    thump(0, 170, 60, 140, 0.7),
    motor(0, 260, 70, 180, 0.22),
    motor(220, 70, 260, 180, 0.22),
    beep(420, 1320, 40, 0.14),
  ]),
  coin: {
    tier: 'gesture',
    vary: 0,
    room: 0.18,
    trim: 2.5,
    drive: 1.5,
    layers: [
      ...key(0, 2000, 0.3),
      thump(0, 200, 80, 120, 0.8),
      ...key(25, 2300, 0.3),
      ...impact({ at: 25, size: 2093, shape: 'bar', material: 'steel', hardness: 0.9, gain: 0.25 }),
    ],
  },
  undo: gesture(0.5, [
    hiss(0, 3000, 1500, 4, 60, 0.3),
    ...key(60, 1500, 0.4),
    thump(60, 190, 90, 70, 0.4),
  ]),

  unlock: hero(0.5, [
    thump(0, 160, 60, 120, 0.6),
    ...ratchet(
      { size: 2600, shape: 'bar', material: 'plastic', hardness: 0.7, gain: 0.2 },
      160,
      35,
      35,
    ),
    beep(190, 880, 60, 0.16),
    beep(270, 1760, 120, 0.16),
  ]),
  ready: notice(3.5, [
    beep(0, 1320, 40, 0.16),
    beep(90, 1320, 40, 0.16),
    beep(180, 1760, 80, 0.16),
  ]),
  fanfare: hero(3.5, [
    ...latch(0, 1500, 0.4),
    thump(0, 140, 45, 250, 1.2),
    {
      kind: 'tone',
      at: 20,
      wave: 'sawtooth',
      frequency: 220,
      to: 220,
      attack: 25,
      hold: 250,
      decay: 160,
      gain: 0.2,
      cutoff: 1400,
    },
    {
      kind: 'tone',
      at: 20,
      wave: 'sawtooth',
      frequency: 330,
      to: 330,
      attack: 25,
      hold: 250,
      decay: 160,
      gain: 0.16,
      cutoff: 1400,
    },
  ]),
  purchase: hero(3.5, [
    ...latch(0, 1500, 0.45),
    thump(0, 150, 45, 260, 1.3),
    hiss(10, 4000, 2000, 20, 120, 0.08),
    ...[1047, 1319, 1568, 2093].flatMap((size, step) =>
      impact({
        at: 90 + step * 80,
        size,
        shape: 'bar',
        material: 'steel',
        hardness: 0.9,
        gain: 0.3,
      }),
    ),
    ...[1047, 1319, 1568, 2093].map((frequency) => ({
      kind: 'tone' as const,
      at: 340,
      wave: 'sine' as const,
      frequency,
      to: frequency,
      attack: 6,
      hold: 120,
      decay: 520,
      gain: 0.09,
      cutoff: 6000,
    })),
  ]),

  settle: notice(-2.5, [beep(0, 1760, 12, 0.08)]),
  refuse: notice(-1, [beep(0, 523, 45, 0.18, 8)]),
  notify: notice(0.5, [beep(0, 880, 70, 0.2)]),
  success: notice(2, [beep(0, 660, 50, 0.18), beep(90, 990, 80, 0.18)]),
  warn: notice(2.5, [
    beep(0, 740, 60, 0.2, 20),
    beep(150, 740, 60, 0.2, 20),
    beep(300, 740, 60, 0.2, 20),
  ]),
  error: notice(-4, [
    thump(0, 120, 50, 120, 0.6),
    thump(130, 120, 50, 120, 0.6),
    {
      kind: 'tone',
      at: 0,
      wave: 'sawtooth',
      frequency: 220,
      to: 220,
      attack: 6,
      hold: 80,
      decay: 20,
      gain: 0.18,
      cutoff: 2000,
    },
    beep(0, 233, 80, 0.12),
    {
      kind: 'tone',
      at: 130,
      wave: 'sawtooth',
      frequency: 220,
      to: 220,
      attack: 6,
      hold: 140,
      decay: 30,
      gain: 0.18,
      cutoff: 2000,
    },
    beep(130, 233, 140, 0.12),
  ]),

  incident: hero(2.5, [
    thump(0, 110, 40, 300, 1.2),
    ...[0, 1, 2, 3, 4, 5].flatMap((step) => {
      const frequency = step % 2 === 0 ? 800 : 600
      return [beep(step * 85, frequency, 60, 0.13), beep(step * 85, frequency * 1.06, 60, 0.08)]
    }),
  ]),
  era: hero(5, [
    thump(0, 90, 30, 600, 1.6),
    ...impact({ size: 70, shape: 'plate', material: 'plastic', hardness: 0.5, gain: 1 }),
    hiss(40, 3000, 2400, 40, 500, 0.1),
    {
      kind: 'tone',
      at: 60,
      wave: 'sawtooth',
      frequency: 233,
      to: 233,
      attack: 50,
      hold: 450,
      decay: 300,
      gain: 0.16,
      cutoff: 1800,
    },
    {
      kind: 'tone',
      at: 60,
      wave: 'sawtooth',
      frequency: 349,
      to: 349,
      attack: 50,
      hold: 450,
      decay: 300,
      gain: 0.13,
      cutoff: 1800,
    },
    {
      kind: 'tone',
      at: 60,
      wave: 'square',
      frequency: 466,
      to: 466,
      attack: 50,
      hold: 450,
      decay: 300,
      gain: 0.06,
      cutoff: 1800,
    },
  ]),
  achievement: hero(3.5, [
    thump(0, 120, 40, 300, 1.4),
    ...impact({ size: 110, shape: 'plate', material: 'plastic', hardness: 0.6, gain: 0.9 }),
    ...latch(0, 1500, 0.3),
    beep(80, 1568, 50, 0.15),
    beep(150, 2093, 120, 0.15),
  ]),
} satisfies Record<string, Spec>

export type Sound = keyof typeof SOUNDS
export const SOUND_NAMES = Object.keys(SOUNDS) as ReadonlyArray<Sound>

export type Bus = Readonly<{ dry: AudioNode; room: AudioNode }>

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>()
const noiseOf = (context: BaseAudioContext): AudioBuffer => {
  let buffer = noiseBuffers.get(context)
  if (!buffer) {
    buffer = context.createBuffer(1, context.sampleRate, context.sampleRate)
    const data = buffer.getChannelData(0)
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1
    noiseBuffers.set(context, buffer)
  }
  return buffer
}

const hallOf = (context: BaseAudioContext): AudioBuffer => {
  const rate = context.sampleRate
  const length = Math.round(rate * 1.1)
  const buffer = context.createBuffer(2, length, rate)
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    let low = 0
    for (let index = 0; index < length; index += 1) {
      const fade = index / length
      low += (Math.random() * 2 - 1 - low) * (0.6 - 0.55 * fade)
      data[index] = 0.7 * low * (1 - fade) ** 4 * Math.min(1, index / (rate * 0.02))
    }
    for (const [ms, gain] of [
      [11, 0.5],
      [19, 0.35],
      [29, 0.3],
      [43, 0.2],
    ] as const)
      data[Math.round(((ms + channel * 3) / 1000) * rate)]! += gain
  }
  return buffer
}

const driveCurves = new Map<number, Float32Array<ArrayBuffer>>()
const driveCurve = (drive: number): Float32Array<ArrayBuffer> => {
  let curve = driveCurves.get(drive)
  if (!curve) {
    curve = new Float32Array(2049)
    for (let index = 0; index < curve.length; index += 1) {
      const x = (index / 1024 - 1) * 4
      curve[index] = Math.tanh(drive * x) / drive / 4
    }
    driveCurves.set(drive, curve)
  }
  return curve
}

const clipCurve = (() => {
  const curve = new Float32Array(1025)
  for (let index = 0; index < curve.length; index += 1) {
    const x = index / 512 - 1
    curve[index] =
      Math.abs(x) < 0.5 ? x : Math.sign(x) * (0.5 + 0.5 * Math.tanh((Math.abs(x) - 0.5) / 0.5))
  }
  return curve
})()

const busOf = (context: BaseAudioContext, output: AudioNode): Bus => {
  const clipper = context.createWaveShaper()
  clipper.curve = clipCurve
  clipper.oversample = '2x'
  clipper.connect(output)
  const room = context.createConvolver()
  room.buffer = hallOf(context)
  room.connect(clipper)
  return { dry: clipper, room }
}

const SILENT = 0.0005

const schedule = (
  context: BaseAudioContext,
  output: AudioNode,
  layer: Layer,
  start: number,
  pitch: number,
  jitter: () => number,
): number => {
  const at = start + layer.at / 1000
  const nyquist = context.sampleRate / 2
  switch (layer.kind) {
    case 'modes': {
      let end = at
      layer.partials.forEach((partial, index) => {
        const frequency = partial * pitch * (1 + jitter() * 0.01)
        const amplitude = layer.amplitudes[index]!
        if (amplitude <= 0 || frequency >= nyquist * 0.9) return
        const tau = Math.min(frequency < 600 ? 0.35 : 0.15, 1 / (frequency * layer.damping))
        const stop = at + 0.001 + tau * Math.log(amplitude / SILENT)
        const oscillator = context.createOscillator()
        oscillator.frequency.value = frequency
        const gain = context.createGain()
        gain.gain.setValueAtTime(0, at)
        gain.gain.linearRampToValueAtTime(amplitude, at + 0.001)
        gain.gain.setTargetAtTime(0, at + 0.001, tau)
        oscillator.connect(gain).connect(output)
        oscillator.start(at)
        oscillator.stop(stop)
        end = Math.max(end, stop)
      })
      return end
    }
    case 'noise': {
      const attack = layer.attack / 1000
      const stop = at + attack + layer.decay / 1000
      const source = context.createBufferSource()
      source.buffer = noiseOf(context)
      source.loop = true
      const filter = context.createBiquadFilter()
      filter.type = layer.filter
      filter.Q.value = layer.q
      const from = Math.min(layer.frequency * pitch, nyquist * 0.9)
      filter.frequency.setValueAtTime(from, at)
      filter.frequency.exponentialRampToValueAtTime(Math.min(layer.to * pitch, nyquist * 0.9), stop)
      const gain = context.createGain()
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(layer.gain, at + attack)
      gain.gain.exponentialRampToValueAtTime(SILENT, stop)
      source.connect(filter).connect(gain).connect(output)
      source.start(at, Math.random())
      source.stop(stop)
      return stop
    }
    case 'tone': {
      const attack = layer.attack / 1000
      const hold = layer.hold / 1000
      const stop = at + attack + hold + layer.decay / 1000
      const oscillator = context.createOscillator()
      oscillator.type = layer.wave
      oscillator.frequency.setValueAtTime(layer.frequency * pitch, at)
      oscillator.frequency.exponentialRampToValueAtTime(layer.to * pitch, stop)
      const filter = context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = layer.cutoff
      filter.Q.value = 0.7
      const gain = context.createGain()
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(layer.gain, at + attack)
      gain.gain.setValueAtTime(layer.gain, at + attack + hold)
      gain.gain.exponentialRampToValueAtTime(SILENT, stop)
      oscillator.connect(filter).connect(gain).connect(output)
      oscillator.start(at)
      oscillator.stop(stop)
      return stop
    }
  }
}

const render = (
  context: BaseAudioContext,
  bus: Bus,
  sound: Sound,
  { pitch = 1, pan = 0, start = context.currentTime, random = Math.random } = {},
): number => {
  const spec: Spec = SOUNDS[sound]
  const jitter = () => (spec.vary > 0 ? random() * 2 - 1 : 0)
  const level = context.createGain()
  level.gain.value = TIER[spec.tier] * 10 ** (spec.trim / 20) * (1 + jitter() * spec.vary * 2)
  const panner = context.createStereoPanner()
  panner.pan.value = pan
  const send = context.createGain()
  send.gain.value = spec.room
  let input: AudioNode = level
  if (spec.drive > 0) {
    const quarter = context.createGain()
    quarter.gain.value = 0.25
    const shaper = context.createWaveShaper()
    shaper.curve = driveCurve(spec.drive)
    shaper.oversample = '4x'
    const restore = context.createGain()
    restore.gain.value = 4
    input = quarter
    quarter.connect(shaper).connect(restore).connect(level)
  }
  level.connect(panner)
  panner.connect(bus.dry)
  panner.connect(send).connect(bus.room)
  const varied = pitch * (1 + jitter() * spec.vary)
  return spec.layers.reduce(
    (end, layer) => Math.max(end, schedule(context, input, layer, start, varied, jitter)),
    start,
  )
}

const REPEAT_GAP_MS = 40
const lastPlayed = new Map<Sound, number>()

const MASTER = 0.5

let volume = 1

let live: Readonly<{ context: AudioContext; master: GainNode; bus: Bus }> | undefined

let pointerPan = 0
if (typeof window !== 'undefined') {
  addEventListener(
    'pointerdown',
    (event) => (pointerPan = (event.clientX / Math.max(1, innerWidth)) * 2 - 1),
    true,
  )
  addEventListener('keydown', () => (pointerPan = 0), true)
}

let muted = false

let audioUnavailable = false

export const setMuted = (value: boolean): void => {
  muted = value
}

export const setVolume = (percent: number): void => {
  volume = Math.min(1, Math.max(0, percent / 100))
  if (live) live.master.gain.setTargetAtTime(MASTER * volume, live.context.currentTime, 0.02)
}

const canPlay = (): boolean => !audioUnavailable && typeof AudioContext !== 'undefined'

export const play = (sound: Sound, pitch = 1, spatial = false): void => {
  if (muted || !canPlay()) return
  if (!(navigator.userActivation?.hasBeenActive ?? true)) return
  const now = performance.now()
  if (now - (lastPlayed.get(sound) ?? -Infinity) < REPEAT_GAP_MS) return
  lastPlayed.set(sound, now)
  if (!live) {
    try {
      const context = new AudioContext({ latencyHint: 'interactive' })
      const master = context.createGain()
      master.gain.value = MASTER * volume
      master.connect(context.destination)
      live = { context, master, bus: busOf(context, master) }
    } catch {
      audioUnavailable = true
      return
    }
  }
  if (live.context.state === 'suspended') void live.context.resume()
  render(live.context, live.bus, sound, { pitch, pan: spatial ? pointerPan * 0.35 : 0 })
}
