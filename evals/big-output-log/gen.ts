// Writes logs/app.log: a morning of traffic with ~230 routine ERROR lines of many kinds
// and, in the middle, the one checkout error that names the real cause.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const lines: string[] = []
const start = Date.parse('2026-09-18T08:00:00.000Z')
const paths = ['/api/products', '/api/cart', '/api/session', '/api/search?q=pen', '/healthz']
const id = (i: number) => String(10_000 + ((i * 7_919) % 90_000))
const noise: ((i: number) => string)[] = [
  i => `metrics: statsd flush failed: connect ECONNREFUSED 127.0.0.1:8125 (dropped ${20 + (i % 37)} points)`,
  i => `search: upstream timeout after ${3000 + (i % 7) * 250}ms (q="${['pen', 'blue ink', 'a4 pad', 'stapler'][i % 4]}")`,
  i => `http: GET /api/products/P${id(i)} 404 not found`,
  i => `auth: session sess_${id(i)} expired, redirecting to /login`,
  i => `checkout: order ORD-0${id(i)} declined by card issuer (code ${['05', '51', '54'][i % 3]})`,
  i => `mailer: SMTP 451 temporary failure for customer ${id(i)}, will retry in ${1 + (i % 5)}m`,
  i => `cart: stale cart cart_${id(i)} rejected (version ${i % 9} < ${(i % 9) + 1})`,
  i => `checkout: order ORD-0${id(i)} fraud check timed out, retrying`,
  i => `images: thumbnail missing for P${id(i)}, using placeholder`,
]
for (let i = 0; i < 1400; i++) {
  const at = new Date(start + i * 2_417).toISOString()
  const order = `ORD-${String(40_000 + i * 7).padStart(6, '0')}`
  if (i === 700) lines.push(`${at} ERROR checkout: order ${order} failed: bad duration: 1.5s (CHECKOUT_TIMEOUT), payment not attempted`)
  else if (i % 6 === 3) lines.push(`${at} ERROR ${noise[Math.floor(i / 6) % noise.length]!(i)}`)
  else if (i % 6 === 1 || i % 6 === 5) lines.push(`${at} INFO checkout: order ${order} paid in ${180 + ((i * 31) % 700)}ms`)
  else if (i % 50 === 25) lines.push(`${at} WARN http: slow response GET ${paths[i % paths.length]} ${900 + (i % 400)}ms`)
  else lines.push(`${at} INFO http: GET ${paths[i % paths.length]} 200 ${12 + ((i * 17) % 90)}ms`)
}
mkdirSync('logs', { recursive: true })
writeFileSync('logs/app.log', lines.join('\n') + '\n')
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
pkg.scripts.logs = 'cat logs/app.log'
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
