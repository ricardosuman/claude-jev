import { expect, test } from 'bun:test'
import { slice, parseFolio, FALLBACK_SPAN, hasMore, foliosFor, emptyFolio, around } from '../src/lib/folios'

test('slice folios from zero', () => {
  const rows = [1, 2, 3, 4, 5]
  expect(slice(rows, 1, 2).items).toEqual([1, 2])
  expect(slice(rows, 2, 2).items).toEqual([3, 4])
  expect(slice(rows, 3, 2).items).toEqual([5])
})

test('parseFolio falls back', () => {
  expect(parseFolio({}).span).toBe(FALLBACK_SPAN)
  expect(parseFolio({ folio: '0', span: '999' }).folio).toBe(1)
})

test('empty list', () => {
  expect(slice([], 1, 10).total).toBe(0)
  expect(slice([], 1, 10).items).toEqual([])
})

test('hasMore and foliosFor', () => {
  const folio = slice([1, 2, 3, 4, 5], 1, 2)
  expect(hasMore(folio)).toBe(true)
  expect(foliosFor(5, 2)).toBe(3)
  expect(foliosFor(0, 10)).toBe(1)
})

test('emptyFolio and around', () => {
  expect(emptyFolio().items).toEqual([])
  expect(emptyFolio(2, 10).folio).toBe(2)
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  expect(around(rows, r => r.id, 'b', 1).map(r => r.id)).toEqual(['a', 'b', 'c'])
  expect(around(rows, r => r.id, 'missing').length).toBe(0)
})

test('slice total matches input length', () => {
  expect(slice([1, 2, 3], 1, 10).total).toBe(3)
  expect(slice([1, 2, 3], 2, 2).items).toEqual([3])
})

test('parseFolio starts at 1', () => {
  expect(parseFolio({}).folio).toBe(1)
})
