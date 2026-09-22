import { expect, test } from 'bun:test'
import { weekly, zonedToUtc } from './schedule'

const utc = (local: string, zone: string) => new Date(zonedToUtc(local, zone)).toISOString()

test('zonedToUtc next to a clock change', () => {
  expect(utc('2026-09-26T20:00', 'Pacific/Auckland')).toBe('2026-09-26T08:00:00.000Z')
  expect(utc('2026-03-08T06:00', 'America/New_York')).toBe('2026-03-08T10:00:00.000Z')
  expect(utc('2026-01-15T09:00', 'Asia/Kolkata')).toBe('2026-01-15T03:30:00.000Z')
})

test('weekly keeps the local time across fall back', () => {
  expect(weekly('2026-10-19T09:00', 'America/New_York', 4)).toEqual([
    '2026-10-19T13:00:00.000Z', '2026-10-26T13:00:00.000Z', '2026-11-02T14:00:00.000Z', '2026-11-09T14:00:00.000Z',
  ])
})

test('weekly keeps the local time across spring forward', () => {
  expect(weekly('2026-09-19T20:00', 'Pacific/Auckland', 3)).toEqual(['2026-09-19T08:00:00.000Z', '2026-09-26T08:00:00.000Z', '2026-10-03T07:00:00.000Z'])
  expect(weekly('2026-09-26T20:00', 'Pacific/Auckland', 2)).toEqual(['2026-09-26T08:00:00.000Z', '2026-10-03T07:00:00.000Z'])
  expect(weekly('2026-03-01T06:00', 'America/New_York', 3)).toEqual(['2026-03-01T11:00:00.000Z', '2026-03-08T10:00:00.000Z', '2026-03-15T10:00:00.000Z'])
  expect(weekly('2026-03-23T18:30', 'Europe/London', 2)).toEqual(['2026-03-23T18:30:00.000Z', '2026-03-30T17:30:00.000Z'])
})

test('weekly with a half-hour DST shift', () => {
  expect(weekly('2026-09-29T12:00', 'Australia/Lord_Howe', 2)).toEqual(['2026-09-29T01:30:00.000Z', '2026-10-06T01:00:00.000Z'])
})
