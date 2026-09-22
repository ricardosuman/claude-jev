// Writes a 480-product catalog, the pricing module (bulk threshold off by one) and a
// generated spec whose only failing case sits in the middle of a chatty run.
import { mkdirSync, writeFileSync } from 'node:fs'

const N = 480, MID = 240
const catalog = Array.from({ length: N }, (_, i) => {
  const unit = 100 + ((i * 37) % 900)
  return { sku: `SKU-${String(i + 1).padStart(4, '0')}`, unit, bulkQty: 5 + ((i * 13) % 20), bulkUnit: unit - 5 - (i % 10) }
})
const cases = catalog.map((p, i) => {
  const qty = i === MID ? p.bulkQty : i % 2 ? p.bulkQty + 1 + (i % 5) : Math.max(1, p.bulkQty - 1 - (i % 3))
  return [p.sku, qty, (qty >= p.bulkQty ? p.bulkUnit : p.unit) * qty] as const
})

mkdirSync('src', { recursive: true })
writeFileSync('src/catalog.json', JSON.stringify(catalog, null, 1) + '\n')
writeFileSync('src/pricing.ts', `import catalog from './catalog.json'

type Product = { sku: string; unit: number; bulkQty: number; bulkUnit: number }

const log = (line: string) => console.error(\`[pricing] \${line}\`)

/** Price in cents of \`qty\` units of \`sku\`, at the bulk unit price for large orders. */
export function priceCents(sku: string, qty: number): number {
  const product = (catalog as Product[]).find(p => p.sku === sku)
  if (!product) throw new Error(\`unknown sku: \${sku}\`)
  const unit = qty > product.bulkQty ? product.bulkUnit : product.unit
  log(\`sku=\${sku} qty=\${qty} bulkQty=\${product.bulkQty} unit=\${unit}\`)
  return unit * qty
}
`)
writeFileSync('src/pricing.spec.ts', `import { expect, test } from 'bun:test'
import { priceCents } from './pricing'

// sku, qty, expected price in cents
const cases: [string, number, number][] = [
${cases.map(c => `  ${JSON.stringify(c)},`).join('\n')}
]

for (const [sku, qty, cents] of cases) test(\`\${sku} x\${qty}\`, () => expect(priceCents(sku, qty)).toBe(cents))
`)
