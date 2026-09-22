// Writes data/products.json (400 records, one per line) with one price in the middle
// exported in cents instead of euros, and src/report.ts, which then overstates the value.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const names = ['pen', 'pad', 'stapler', 'folder', 'marker', 'tape', 'binder', 'envelope']
const records = Array.from({ length: 400 }, (_, i) => {
  const cents = 99 + ((i * 7_919) % 4_900)
  const price = i === 200 ? cents : cents / 100
  return JSON.stringify({ id: `P${String(i + 1).padStart(5, '0')}`, name: `${names[i % names.length]} ${1 + (i % 13)}`, price, stock: (i * 31) % 250, warehouse: ['LIS', 'OPO', 'MAD'][i % 3] })
})
mkdirSync('data', { recursive: true })
writeFileSync('data/products.json', `[\n${records.join(',\n')}\n]\n`)
writeFileSync('src/report.ts', `import products from '../data/products.json'

// --dump lists every record before the total
if (process.argv.includes('--dump'))
  for (const p of products) console.log(\`\${p.id}  \${p.name.padEnd(11)} \${p.warehouse}  price \${p.price}  stock \${p.stock}  value \${(p.price * p.stock).toFixed(2)}\`)
const value = products.reduce((sum, p) => sum + p.price * p.stock, 0)
console.log(\`Inventory value: \${value.toFixed(2)}\`)
`)
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
pkg.scripts.inventory = 'bun src/report.ts --dump'
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
