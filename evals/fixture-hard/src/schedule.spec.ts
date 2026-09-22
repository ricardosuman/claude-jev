import { expect, test } from 'bun:test'
import { weekly, zonedToUtc } from './schedule'

test('zonedToUtc', () => {
  expect(new Date(zonedToUtc('2026-01-15T09:00', 'America/New_York')).toISOString()).toBe('2026-01-15T14:00:00.000Z')
  expect(new Date(zonedToUtc('2026-01-15T09:00', 'Asia/Kolkata')).toISOString()).toBe('2026-01-15T03:30:00.000Z')
})

test('weekly', () => {
  expect(weekly('2026-01-05T10:00', 'Europe/Paris', 3)).toEqual([
    '2026-01-05T09:00:00.000Z',
    '2026-01-12T09:00:00.000Z',
    '2026-01-19T09:00:00.000Z',
  ])
})
