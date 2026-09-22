import { expect, test } from 'bun:test'
import { slugify } from './slug'

test('slugify', () => {
  expect(slugify('Hello World')).toBe('hello-world')
  expect(slugify('  A -- B  ')).toBe('a-b')
})
