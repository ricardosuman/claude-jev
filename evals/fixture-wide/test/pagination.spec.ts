import { expect, test } from 'bun:test'
import { slice, parsePage, DEFAULT_LIMIT, hasMore, pagesFor, emptyPage, around } from '../src/lib/pagination'

test('slice pages from zero', () => {
  const rows = [1, 2, 3, 4, 5]
  expect(slice(rows, 1, 2).items).toEqual([1, 2])
  expect(slice(rows, 2, 2).items).toEqual([3, 4])
  expect(slice(rows, 3, 2).items).toEqual([5])
})

test('parsePage falls back', () => {
  expect(parsePage({}).limit).toBe(DEFAULT_LIMIT)
  expect(parsePage({ page: '0', limit: '999' }).page).toBe(1)
})

test('empty list', () => {
  expect(slice([], 1, 10).total).toBe(0)
  expect(slice([], 1, 10).items).toEqual([])
})

test('hasMore and pagesFor', () => {
  const page = slice([1, 2, 3, 4, 5], 1, 2)
  expect(hasMore(page)).toBe(true)
  expect(pagesFor(5, 2)).toBe(3)
  expect(pagesFor(0, 10)).toBe(1)
})

test('emptyPage and around', () => {
  expect(emptyPage().items).toEqual([])
  expect(emptyPage(2, 10).page).toBe(2)
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  expect(around(rows, r => r.id, 'b', 1).map(r => r.id)).toEqual(['a', 'b', 'c'])
  expect(around(rows, r => r.id, 'missing').length).toBe(0)
})

test('slice total matches input length', () => {
  expect(slice([1, 2, 3], 1, 10).total).toBe(3)
  expect(slice([1, 2, 3], 2, 2).items).toEqual([3])
})

test('parsePage default page is 1', () => {
  expect(parsePage({}).page).toBe(1)
})
