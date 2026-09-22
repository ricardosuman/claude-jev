export type Item = { name: string; price: number; qty: number }

export const TAX_RATE = 0.08

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function subtotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0)
}

export function total(items: Item[], discountPct = 0): number {
  const sub = subtotal(items)
  return round2((sub - (sub * discountPct) / 100) * (1 + TAX_RATE))
}
