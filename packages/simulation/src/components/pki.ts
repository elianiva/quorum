import { def } from './define.ts'

export const CERT_DAYS = 90
export const CERT_DAYS_SHORT = 45
export const CERT_FROM_STAGE = 2
export const CERT_SHORT_FROM = 5
export const CERT_RENEW = 2 / 3

export const pkiDef = def({
  id: 'pki',
  code: 'pki',
  name: 'Secrets and Certificates',
  product: "Let's Encrypt",
  group: 'ops',
  blurb:
    'Holds the keys and renews the TLS certificates before they run out. Without it live, the certificate expires on the calendar and the site goes down.',
  cost: 80,
  burn: 0.005,
  latency: 0,
  accepts: [],
  maxOut: 0,
  unlock: 'cert-automation',
})
