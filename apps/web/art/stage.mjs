import * as k from './kit/iso-kit.mjs'

export const WIDTH = 240
export const HEIGHT = 200
export const FOOTPRINT = { x: -50, y: -50, w: 100, d: 100, r: 0 }
export const FLOOR = -8
export const CEILING = 50

export const P = k.fitProjection(k.boxCorners(FOOTPRINT, FLOOR, CEILING), WIDTH, HEIGHT, {
  pad: 10,
  azimuth: 45,
  elevation: 30,
})
