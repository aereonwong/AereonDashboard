// Unit tests for privacy mode's text scrubbing (lib/privacy-text.ts). Run: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { scrubText, scrubAmounts } from '../lib/privacy-text.ts'

test('currency codes and symbols are blanked in titles', () => {
  assert.equal(scrubText('Shoot RM 1,234.50 + USD 2.5K'), 'Shoot RM 0 + USD 0')
  assert.equal(scrubText('Uber HK$78.00, ads $1,200 and €230'), 'Uber HK$ 0, ads $ 0 and € 0')
})

test('titles keep plain numbers (years, order ids, units)', () => {
  assert.equal(scrubText('Campaign 2026 order 489778 unit 12'), 'Campaign 2026 order 489778 unit 12')
})

test('notes also lose bare, grouped and labelled amounts', () => {
  assert.equal(scrubAmounts('paid 1,234.50 late'), 'paid 0 late')
  assert.equal(scrubAmounts('balance owing 1,234.50'), 'balance owing 0.00')
  assert.equal(scrubAmounts('deposit 5,000 held'), 'deposit 0 held')
  assert.equal(scrubAmounts('Rent: 1800 from March'), 'Rent: 0 from March')
  assert.equal(scrubAmounts('deposit 5000'), 'deposit 0')
})

test('notes keep dates and plain references', () => {
  assert.equal(scrubAmounts('Moved in 2026-03-01, unit 12, ref 4897'), 'Moved in 2026-03-01, unit 12, ref 4897')
  assert.equal(scrubAmounts('Cost 70mai review'), 'Cost 70mai review')
  assert.equal(scrubAmounts(null), null)
})
