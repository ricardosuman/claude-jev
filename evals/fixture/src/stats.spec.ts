import { expect, test } from 'bun:test'
import { mean, median } from './stats'

test('mean', () => {
  expect(mean([1, 2, 3, 6])).toBe(3)
})

test('median of unsorted input', () => {
  expect(median([9, 1, 5])).toBe(5)
  expect(median([4, 1, 3, 2])).toBe(2.5)
})
